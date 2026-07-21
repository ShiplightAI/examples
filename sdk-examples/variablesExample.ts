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

async function variablesExample() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create agent with initial variables
  const agent = createAgent({
    model: 'gemini-3-flash-preview',
    variables: {
      username: 'standard_user',
      password: 'secret_sauce',
    },
    sensitiveKeys: ['password'], // Password will be masked in logs
  });

  try {
    console.log('=== Variables Example ===');
    console.log('Model: gemini-3-flash-preview\n');

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
