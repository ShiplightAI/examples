/**
 * Self-Healing Example for @shiplightai/sdk
 *
 * This example demonstrates the agent.step() method with self-healing:
 * - Wrapping Playwright code with automatic recovery
 * - Using maxSteps to control recovery attempts
 * - How the agent recovers from selector failures
 *
 * Prerequisites:
 * - Set GOOGLE_API_KEY in .env file or environment variable
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
const { createAgent, configureSdk } = await import('@shiplightai/sdk');

// Configure SDK with API key
const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error('Error: GOOGLE_API_KEY not set');
  console.log('   Add to .env file or get your key from: https://aistudio.google.com/app/apikey');
  process.exit(1);
}
configureSdk({ env: { GOOGLE_API_KEY: apiKey } });

async function selfHealingExample() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create agent with default selfHealingStrategy: 'single'
  const agent = createAgent({
    model: 'gemini-2.5-pro',
  });

  try {
    console.log('=== Self-Healing Example ===');
    console.log('Model: gemini-2.5-pro\n');

    // ================================
    // PART 1: Basic Self-Healing (maxSteps: 1)
    // ================================
    console.log('--- Part 1: Single-Step Self-Healing (maxSteps: 1) ---\n');

    await page.goto('https://www.wikipedia.org');
    console.log('1. Loaded Wikipedia homepage\n');

    // Try to click with a wrong selector - agent will find the correct element
    console.log('2. Attempting to click search with wrong selector...');
    console.log('   Code: page.click("#wrong-search-selector")');
    console.log('   Description: "Click the search input field"');

    const result1 = await agent.step(
      page,
      async () => {
        // This selector doesn't exist - will fail and trigger self-healing
        await page.click('#wrong-search-selector', { timeout: 2000 });
      },
      'Click the search input field',
      { maxSteps: 1 }
    );
    console.log(`   result.success: ${result1.success}`);
    if (result1.success) {
      console.log('   Agent successfully found and clicked the search input!\n');
    } else {
      console.log(`   Self-healing failed: ${result1.details}\n`);
    }

    // ================================
    // PART 2: Multi-Step Self-Healing (maxSteps: 3)
    // ================================
    console.log('--- Part 2: Multi-Step Self-Healing (maxSteps: 3) ---\n');

    await page.goto('https://www.saucedemo.com/');
    console.log('3. Loaded Sauce Demo login page\n');

    // Try a more complex action with wrong selectors
    console.log('4. Attempting login with wrong selectors...');
    console.log('   Description: "Enter username standard_user and password secret_sauce, then click login"');

    const result2 = await agent.step(
      page,
      async () => {
        // These selectors are wrong - agent will find correct ones
        await page.fill('#wrong-username', 'standard_user', { timeout: 2000 });
        await page.fill('#wrong-password', 'secret_sauce', { timeout: 2000 });
        await page.click('#wrong-login-btn', { timeout: 2000 });
      },
      'Enter username standard_user and password secret_sauce, then click login',
      { maxSteps: 3 }
    );
    console.log(`   result.success: ${result2.success}`);
    if (result2.success) {
      console.log('   Agent successfully completed the login!\n');
    } else {
      console.log(`   Self-healing failed: ${result2.details}\n`);
    }

    // Verify we're logged in
    console.log('5. Verifying login success...');
    const isLoggedIn = await agent.evaluate(page, 'The inventory page is displayed with products');
    console.log(`   Logged in: ${isLoggedIn ? 'YES' : 'NO'}\n`);

    // ================================
    // PART 3: Disabled Self-Healing (maxSteps: 0)
    // ================================
    console.log('--- Part 3: Disabled Self-Healing (maxSteps: 0) ---\n');

    console.log('6. Attempting action with self-healing disabled...');
    console.log('   With maxSteps: 0, returns failure immediately without agent recovery\n');

    const result3 = await agent.step(
      page,
      async () => {
        await page.click('#non-existent-element', { timeout: 2000 });
      },
      'Click a button',
      { maxSteps: 0 }
    );
    console.log(`   result.success: ${result3.success}`);
    console.log(`   result.details: ${result3.details?.substring(0, 50)}...`);
    console.log('   No agent recovery attempted (maxSteps: 0)\n');

    // ================================
    // PART 4: Negative Example - Self-Healing Fails
    // ================================
    console.log('--- Part 4: Negative Example (Self-Healing Fails) ---\n');

    await page.goto('https://www.wikipedia.org');
    console.log('7. Back to Wikipedia homepage\n');

    // Try to do something impossible - agent cannot find this element
    console.log('8. Attempting impossible action...');
    console.log('   Description: "Click the rocket launch button" (does not exist)');

    const result4 = await agent.step(
      page,
      async () => {
        await page.click('#rocket-launch-button', { timeout: 2000 });
      },
      'Click the rocket launch button',
      { maxSteps: 1 }
    );
    console.log(`   result.success: ${result4.success}`);
    if (!result4.success) {
      console.log(`   result.details: ${result4.details?.substring(0, 80)}...`);
      console.log('   Agent could not find the element (as expected)\n');
    }

    // ================================
    // Summary
    // ================================
    console.log('=== Self-Healing Summary ===\n');
    console.log('agent.step() returns AgentStepResult:');
    console.log('  - success: true  -> original code or agent recovery succeeded');
    console.log('  - success: false -> both original code and agent recovery failed');
    console.log('');
    console.log('maxSteps controls recovery behavior:');
    console.log('  maxSteps: 0  - No self-healing, failure returned immediately');
    console.log('  maxSteps: 1  - Single agent retry');
    console.log('  maxSteps: >1 - Multi-step agent recovery');
    console.log('');
    console.log('The "description" parameter tells the agent what to accomplish');
    console.log('when the original code fails.\n');

  } catch (error) {
    console.error('Self-healing example failed:', error);
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

selfHealingExample().catch(console.error);
