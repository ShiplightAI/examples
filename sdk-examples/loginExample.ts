/**
 * Login Flow Example for @shiplightai/sdk
 *
 * This example demonstrates the agent's smart login capability:
 * - Automatically finds login fields on the page
 * - Handles username/password authentication
 * - Supports 2FA with TOTP
 *
 * Test site: Sauce Labs Demo (public test site for automation)
 * - URL: https://www.saucedemo.com/
 * - Username: standard_user
 * - Password: secret_sauce
 *
 * Prerequisites:
 * - Set GOOGLE_API_KEY in .env file or environment variable
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { createAgent, configureSdk } from '@shiplightai/sdk';

// Configure SDK with API key
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('Error: GOOGLE_API_KEY not set');
  console.log('   Add to .env file or get your key from: https://aistudio.google.com/apikey');
  process.exit(1);
}
configureSdk({ env: { GOOGLE_API_KEY: apiKey } });

async function loginExample() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const agent = createAgent({
    model: 'gemini-2.5-pro',
  });

  try {
    console.log('=== Login Example ===');
    console.log('Model: gemini-2.5-pro\n');

    // Use the agent's smart login - it handles everything automatically
    console.log('1. Performing smart login...');
    const success = await agent.login(page, {
      url: 'https://www.saucedemo.com/',
      username: 'standard_user',
      password: 'secret_sauce',
    });

    if (!success) {
      throw new Error('Login failed');
    }
    console.log('   Login successful!\n');

    // Verify we're on the inventory page
    console.log('2. Verifying login...');
    await agent.assert(page, 'The inventory page is displayed with products');
    console.log('   Inventory page verified!\n');

    // Extract some data to confirm we have access
    console.log('3. Extracting data from authenticated page...');
    await agent.extract(page, 'the first product name', 'firstProduct');
    const firstProduct = agent.getVariable('firstProduct');
    console.log(`   First product: ${firstProduct}\n`);

    console.log('=== Login Example Complete ===');
    console.log('\nKey points:');
    console.log('  - agent.login() handles the entire login flow');
    console.log('  - Automatically finds username/password fields');
    console.log('  - Supports 2FA with totpSecret option');

  } catch (error) {
    console.error('Login example failed:', error);
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

loginExample().catch(console.error);
