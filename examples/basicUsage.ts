/**
 * Basic Usage Example for @shiplightai/sdk
 *
 * This example demonstrates the core features of the Shiplight SDK:
 * - Creating an agent with configuration
 * - Using act() for single actions
 * - Using variables (including sensitive ones)
 * - Making assertions and evaluations
 * - Extracting data from the page
 *
 * Key methods demonstrated:
 * - agent.act() - Execute a single action
 * - agent.assert() - Assert a condition (throws on failure)
 * - agent.evaluate() - Evaluate a condition (returns boolean)
 * - agent.extract() - Extract data into a variable
 *
 * Prerequisites:
 * - Set GOOGLE_API_KEY in .env file or environment variable
 * - Install playwright: pnpm add playwright
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env BEFORE importing playwright (PWDEBUG must be set before playwright loads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env') });

// Dynamic import to ensure PWDEBUG is set before playwright initializes
const { chromium } = await import('playwright');
const { createAgent, configureSdk, LogLevel } = await import('@shiplightai/sdk');

// Configure SDK with API key
const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('❌ Error: GOOGLE_API_KEY not set');
  console.log('   Add to .env file or get your key from: https://aistudio.google.com/app/apikey');
  process.exit(1);
}
configureSdk({
  logLevel: LogLevel.INFO,
  env: { GOOGLE_API_KEY: apiKey },
});

async function basicExample() {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create an agent with variables
  const agent = createAgent({
    model: 'gemini-2.5-pro',
    variables: {
      username: 'testuser@example.com',
      password: 'secret123',
    },
    sensitiveKeys: ['password'], // Password will be masked in logs
  });

  try {
    console.log('=== Basic Usage Example ===');
    console.log('Model: gemini-2.5-pro\n');

    // Navigate to a website
    await page.goto('https://example.com');

    // Execute a single action using act()
    await agent.act(page, 'Click on the "Learn More" link');

    // Assert a condition (throws if false)
    await agent.assert(page, 'The page shows information about IANA');

    // Evaluate a condition (returns boolean)
    const hasHeader = await agent.evaluate(page, 'Page has a header element');
    console.log('Has header:', hasHeader);

    // Run another single action using act()
    await agent.act(page, 'Scroll down to the bottom of the page');

    // Extract data from the page into a variable
    await agent.extract(page, 'the page title', 'pageTitle');

    // Access the extracted value
    const pageTitle = agent.getVariable('pageTitle');
    console.log('Extracted page title:', pageTitle);

    // Demonstrate that assert throws on failure
    console.log('\nTesting failed assertion (should throw):');
    try {
      await agent.assert(page, 'The page shows a shopping cart with items');
      console.log('Assertion passed (unexpected)');
    } catch (error: any) {
      console.log('Assertion failed as expected:\n', error.message);
    }

  } finally {
    await browser.close();
  }
}

basicExample().catch(console.error);
