/**
 * Quick Start Example for @shiplightai/sdk
 *
 * This is the runnable version of the Quick Start example from the README.
 * It demonstrates:
 * - Configuring the SDK with API key
 * - Creating an agent
 * - Using agent.login() for authentication
 * - Using agent.assert() to verify conditions
 * - Using agent.extract() to get data from the page
 *
 * Test site: Sauce Labs Demo (public test site for automation)
 * - URL: https://www.saucedemo.com/
 * - Username: standard_user
 * - Password: secret_sauce
 *
 * Prerequisites:
 * - Set ANTHROPIC_API_KEY in .env file or environment variable
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env BEFORE importing playwright (PWDEBUG must be set before playwright loads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '.env') });

// Dynamic import to ensure PWDEBUG is set before playwright initializes
const { chromium } = await import('playwright');
const { createAgent, configureSdk } = await import('@shiplightai/sdk');

// Configure SDK with API key
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY not set');
  console.log('   Add to .env file or get your key from: https://console.anthropic.com/settings/keys');
  process.exit(1);
}
configureSdk({
  env: { ANTHROPIC_API_KEY: apiKey },
});

async function quickStart() {
  console.log('=== Quick Start Example ===');
  console.log('Model: claude-haiku-4-5\n');

  // Create an agent
  const agent = createAgent({
    model: 'claude-haiku-4-5',
  });

  // Use with Playwright
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Login using the Sauce Labs demo site (public test site)
    console.log('1. Logging in to Sauce Labs Demo...');
    await agent.login(page, {
      url: 'https://www.saucedemo.com/',
      username: 'standard_user',
      password: 'secret_sauce',
    });
    console.log('   Login successful!\n');

    // Verify login succeeded
    console.log('2. Verifying login...');
    await agent.assert(page, 'Products page is visible');
    console.log('   Products page verified!\n');

    // Extract data from the page
    console.log('3. Extracting product data...');
    await agent.extract(page, 'the first product name', 'productName');
    const productName = agent.getVariable('productName');
    console.log(`   First product: ${productName}\n`);

    console.log('=== Quick Start Complete ===');
    console.log('\nThis example demonstrated:');
    console.log('  - configureSdk() to set API key');
    console.log('  - createAgent() to create an agent');
    console.log('  - agent.login() to authenticate');
    console.log('  - agent.assert() to verify conditions');
    console.log('  - agent.extract() to get data from the page');

  } catch (error) {
    console.error('Quick start failed:', error);
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

quickStart().catch(console.error);
