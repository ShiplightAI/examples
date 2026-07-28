/**
 * File Upload Example for @shiplightai/sdk
 *
 * This example demonstrates file upload with the agent:
 * - The agent can upload files using natural language instructions
 * - Files are resolved from the testDataDir option
 *
 * Test site: https://static.shiplight.ai/testing/files/upload.html
 *
 * Prerequisites:
 * - Set an LLM credential in .env: GOOGLE_API_KEY, ANTHROPIC_API_KEY,
 *   OPENAI_API_KEY, or SHIPLIGHT_API_TOKEN (Shiplight LLM proxy)
 */

import 'dotenv/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { chromium } from 'playwright';
import { createAgent, configureSdk } from '@shiplightai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure SDK credentials. Set the key matching your model provider
// (GOOGLE_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY), or SHIPLIGHT_API_TOKEN
// to route any provider through the Shiplight LLM proxy.
const credentials: Record<string, string> = {};
for (const key of ['GOOGLE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'SHIPLIGHT_API_TOKEN']) {
  const value = process.env[key];
  if (value) credentials[key] = value;
}
if (Object.keys(credentials).length === 0) {
  console.error('Error: no LLM credentials set');
  console.log('   Set GOOGLE_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or SHIPLIGHT_API_TOKEN in .env');
  process.exit(1);
}
configureSdk({ env: credentials });

async function fileUploadExample() {
  // Create a test file for upload
  const testDir = resolve(__dirname, 'test-files');
  const testFilePath = resolve(testDir, 'test-upload.txt');

  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }
  writeFileSync(testFilePath, 'This is a test file for upload demonstration.\nCreated by Shiplight SDK example.');
  console.log(`Created test file: ${testFilePath}\n`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create agent with testDataDir - files referenced in instructions are resolved from here
  const agent = createAgent({
    model: 'gemini-3-flash-preview',
    testDataDir: testDir,
  });

  try {
    console.log('=== File Upload Example ===');
    console.log('Model: gemini-3-flash-preview\n');

    console.log('1. Navigating to upload test page...');
    await page.goto('https://static.shiplight.ai/testing/files/upload.html');
    console.log('   ✓ Upload page loaded\n');

    // agent.act() performs ONE action. Phrase each instruction as a single
    // action and check result.success — an instruction the agent reads as
    // multi-step ("upload the file", meaning select *and* submit) is reported
    // as incomplete and nothing is executed.
    console.log('2. Selecting file using agent...');
    console.log('   Instruction: "Select the file test-upload.txt in the upload area"');
    const selected = await agent.act(page, 'Select the file test-upload.txt in the upload area');
    if (!selected.success) {
      throw new Error(`File selection failed: ${selected.details}`);
    }
    console.log('   ✓ File selected\n');

    console.log('3. Submitting upload...');
    const submitted = await agent.act(page, 'Click the Upload Files button');
    if (!submitted.success) {
      throw new Error(`Upload submission failed: ${submitted.details}`);
    }
    console.log('   ✓ Upload submitted\n');

    // Verify upload success
    console.log('4. Verifying upload success...');
    await agent.assert(page, 'The page shows "File Uploaded!" message');
    console.log('   ✓ Upload verified\n');

    // Extract uploaded filename
    await agent.extract(page, 'the uploaded filename shown on the page', 'uploadedFile');
    const uploadedFile = agent.getVariable('uploadedFile');
    console.log(`   Uploaded file: ${uploadedFile}\n`);

    console.log('=== File Upload Example Complete ===');
    console.log('\nKey points:');
    console.log('  - Set testDataDir in createAgent() to specify where files are located');
    console.log('  - agent.act() runs a single action - give it one action per call');
    console.log('  - Check result.success: a failed action does not throw');
    console.log('  - The agent automatically finds file inputs and handles the upload');

  } catch (error) {
    console.error('File upload example failed:', error);
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

fileUploadExample().catch(console.error);
