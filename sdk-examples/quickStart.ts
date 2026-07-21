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
 * - Set an LLM credential in .env: GOOGLE_API_KEY, ANTHROPIC_API_KEY,
 *   OPENAI_API_KEY, or SHIPLIGHT_API_TOKEN (Shiplight LLM proxy)
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { createAgent, configureSdk } from '@shiplightai/sdk';

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

async function quickStart() {
  console.log('=== Quick Start Example ===');
  console.log('Model: gemini-3-flash-preview\n');

  // Create an agent
  const agent = createAgent({
    model: 'gemini-3-flash-preview',
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
