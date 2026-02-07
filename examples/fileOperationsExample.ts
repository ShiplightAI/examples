/**
 * File Upload Example for @shiplightai/sdk
 *
 * This example demonstrates file upload with the agent:
 * - The agent can upload files using natural language instructions
 * - Files are resolved from the testDataDir option
 *
 * Test site: https://the-internet.herokuapp.com/upload
 *
 * Prerequisites:
 * - Set GOOGLE_API_KEY in .env file or environment variable
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Load .env BEFORE importing playwright (PWDEBUG must be set before playwright loads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env') });

// Dynamic import to ensure PWDEBUG is set before playwright initializes
const { chromium } = await import('playwright');
const { createAgent, configureSdk } = await import('@shiplightai/sdk');

// Configure SDK with API key
const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('❌ Error: GOOGLE_API_KEY not set');
  console.log('   Add to .env file or get your key from: https://aistudio.google.com/app/apikey');
  process.exit(1);
}
configureSdk({ env: { GOOGLE_API_KEY: apiKey } });

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
    model: 'gemini-2.5-pro',
    testDataDir: testDir,
  });

  try {
    console.log('=== File Upload Example ===');
    console.log('Model: gemini-2.5-pro\n');

    console.log('1. Navigating to upload test page...');
    await page.goto('https://the-internet.herokuapp.com/upload');
    console.log('   ✓ Upload page loaded\n');

    // Use the agent to upload a file with natural language
    // The agent finds the file input and uploads the file from testDataDir
    console.log('2. Uploading file using agent...');
    console.log('   Instruction: "Upload the file test-upload.txt"');
    await agent.act(page, 'Upload the file test-upload.txt');
    console.log('   ✓ File selected\n');

    console.log('3. Submitting upload...');
    await agent.act(page, 'Click the Upload button');
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
    console.log('  • Set testDataDir in createAgent() to specify where files are located');
    console.log('  • Use agent.act() with natural language: "Upload the file <filename>"');
    console.log('  • The agent automatically finds file inputs and handles the upload');

  } catch (error) {
    console.error('File upload example failed:', error);
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

fileUploadExample().catch(console.error);
