/**
 * Variables Example for @shiplightai/sdk
 *
 * This example demonstrates the variable store features:
 * - Setting initial variables via createAgent()
 * - Marking sensitive variables (masked in logs)
 * - Using variables in instructions with $variableName
 * - Getting/setting variables programmatically
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
configureSdk({ env: { ANTHROPIC_API_KEY: apiKey } });

async function variablesExample() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create agent with initial variables
  const agent = createAgent({
    model: 'claude-haiku-4-5',
    variables: {
      username: 'standard_user',
      password: 'secret_sauce',
    },
    sensitiveKeys: ['password'], // Password will be masked in logs
  });

  try {
    console.log('=== Variables Example ===');
    console.log('Model: claude-haiku-4-5\n');

    // Step 1: Show initial variables set via createAgent
    console.log('1. Initial variables (set via createAgent):');
    console.log(`   username: "${agent.getVariable('username')}"`);
    console.log(`   password: "${agent.getVariable('password')}" (sensitive - masked in logs)\n`);

    // Step 2: Set variables programmatically
    console.log('2. Setting variables programmatically:');
    agent.setVariable('greeting', 'Hello World');
    agent.setVariable('apiKey', 'sk-secret-12345', true); // Mark as sensitive
    console.log(`   agent.setVariable('greeting', 'Hello World')`);
    console.log(`   agent.setVariable('apiKey', 'sk-secret-12345', true)`);
    console.log(`   greeting: "${agent.getVariable('greeting')}"`);
    console.log(`   apiKey: "${agent.getVariable('apiKey')}" (sensitive)\n`);

    // Step 3: Use variables in agent instructions (two syntaxes supported)
    console.log('3. Using variables in instructions:');
    await page.goto('https://www.saucedemo.com/');

    // Syntax 1: $variableName
    console.log('   Syntax 1: $variableName');
    console.log('   Instruction: "Type $username in the username field"');
    await agent.act(page, 'Type $username in the username field');
    await agent.assert(page, 'The username field contains "standard_user"');
    console.log('   ✓ Used $username\n');

    // Syntax 2: {{ variableName }}
    console.log('   Syntax 2: {{ variableName }}');
    console.log('   Instruction: "Type {{ password }} in the password field"');
    await agent.act(page, 'Type {{ password }} in the password field');
    console.log('   ✓ Used {{ password }} (value masked in logs)\n');

    console.log('=== Variables Example Complete ===');
    console.log('\nKey points:');
    console.log('  - Set initial variables: createAgent({ variables: {...} })');
    console.log('  - Mark sensitive: createAgent({ sensitiveKeys: ["password"] })');
    console.log('  - Set at runtime: agent.setVariable(name, value, sensitive?)');
    console.log('  - Get value: agent.getVariable(name)');
    console.log('  - Use in instructions: $variableName or {{ variableName }}');

  } catch (error) {
    console.error('Variables example failed:', error);
    throw error;
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

variablesExample().catch(console.error);
