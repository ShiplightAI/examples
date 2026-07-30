/**
 * Custom Actions Example for @shiplightai/sdk
 *
 * This example demonstrates how to extend the agent with custom actions.
 * Custom actions allow you to add domain-specific capabilities that the
 * agent can automatically invoke when needed.
 *
 * Use cases:
 * - Email verification (fetch OTP codes from email)
 * - SMS verification (receive and parse SMS codes)
 * - External API calls (payment processing, notifications)
 * - Database operations (check user state, reset data)
 * - File operations (upload, download validation)
 *
 * Note on variables: when an action argument contains a `{{ variable }}` placeholder, the SDK
 * resolves it before calling your handler, so `args` holds the real value. Test 1 below asserts
 * this, since a handler that silently received "{{ testEmail }}" would query a nonexistent
 * address.
 *
 * Requires an SDK build that resolves custom action arguments. 0.1.9 does not - it passes the
 * raw placeholder through, and Test 1 will fail loudly if you run against it.
 *
 * Prerequisites:
 * - Set an LLM credential in .env: GOOGLE_API_KEY, ANTHROPIC_API_KEY,
 *   OPENAI_API_KEY, or SHIPLIGHT_API_TOKEN (Shiplight LLM proxy)
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { createAgent, z, configureSdk } from '@shiplightai/sdk';

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

async function customActionsExample() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const agent = createAgent({
    model: 'gemini-3-flash-preview',
    variables: {
      testEmail: 'user@example.com',
    },
  });

  // Register a custom action to get verification code from email
  agent.registerAction({
    name: 'get_email_verification_code',
    description: 'Fetch the latest verification code from email inbox',
    schema: z.object({
      email_address: z.string().describe('Email address to check'),
      timeout_seconds: z.number().optional().describe('How long to wait for email'),
    }),
    async execute(args, ctx) {
      // The agent wrote "{{ testEmail }}" for this argument; the SDK resolved it before
      // calling us, so args.email_address is the real address and is safe to use directly.
      console.log(`  args.email_address: "${args.email_address}"`);

      // In a real implementation, this would call an email API
      console.log(`Checking email for: ${args.email_address}`);

      // Simulate fetching email and extracting code
      const code = '123456';

      // Store the code in a variable for later use
      ctx.variableStore.set('verificationCode', code);
      // Recorded so Test 1 can verify what the handler actually received.
      ctx.variableStore.set('receivedEmail', args.email_address);

      return {
        success: true,
        message: `Found verification code: ${code}`,
      };
    },
  });

  // Register a custom action to send SMS verification
  agent.registerAction({
    name: 'send_sms_code',
    description: 'Send an SMS verification code to a phone number',
    schema: z.object({
      phone_number: z.string().describe('Phone number to send SMS to'),
    }),
    async execute(args, ctx) {
      // In a real implementation, use Twilio or similar SMS API
      console.log(`Sending SMS to: ${args.phone_number}`);

      // Simulate sending SMS and getting the code
      const smsCode = '987654';
      ctx.variableStore.set('smsCode', smsCode);

      return {
        success: true,
        message: `SMS code sent to ${args.phone_number}`,
      };
    },
  });

  // Register a custom action to check database state
  agent.registerAction({
    name: 'check_user_status',
    description: 'Check if user is verified in the database',
    schema: z.object({
      user_id: z.string().describe('User ID to check'),
    }),
    async execute(args, ctx) {
      // In a real implementation, query your database
      console.log(`Checking user status for: ${args.user_id}`);

      const isVerified = true;
      ctx.variableStore.set('userVerified', String(isVerified));

      return {
        success: true,
        message: `User verified: ${isVerified}`,
      };
    },
  });

  try {
    console.log('=== Custom Actions Example ===');
    console.log('Model: gemini-3-flash-preview\n');

    await page.goto('https://example.com');

    // Test 1: Ask the agent to get an email verification code
    console.log('\n--- Test 1: Email Verification ---');
    console.log('Instruction: "Get the verification code for {{ testEmail }}"');
    await agent.act(page, 'Get the verification code for {{ testEmail }}');

    const verificationCode = agent.getVariable('verificationCode');
    console.log(`  Variable 'verificationCode' set: ${verificationCode ? `Yes (${verificationCode})` : 'No'}`);

    // The agent wrote "{{ testEmail }}"; check the SDK resolved it before our handler ran.
    const receivedEmail = agent.getVariable('receivedEmail');
    if (receivedEmail !== 'user@example.com') {
      throw new Error(
        `The custom action received "${receivedEmail}" instead of "user@example.com". ` +
          'The SDK did not resolve the {{ testEmail }} placeholder in the action argument. ' +
          'This example needs an SDK build that resolves custom action arguments; 0.1.9 does not.'
      );
    }
    console.log(`  SDK resolved the placeholder before the handler ran: "${receivedEmail}"`);

    // Test 2: Ask the agent to check user status
    console.log('\n--- Test 2: Database Check ---');
    console.log('Instruction: "Check if user abc123 is verified in the database"');
    await agent.act(page, 'Check if user abc123 is verified in the database');

    const userVerified = agent.getVariable('userVerified');
    console.log(`  Variable 'userVerified' set: ${userVerified ? `Yes (${userVerified})` : 'No'}`);

    // Test 3: Ask the agent to send an SMS
    console.log('\n--- Test 3: SMS Verification ---');
    console.log('Instruction: "Send an SMS verification code to +1234567890"');
    await agent.act(page, 'Send an SMS verification code to +1234567890');

    const smsCode = agent.getVariable('smsCode');
    console.log(`  Variable 'smsCode' set: ${smsCode ? `Yes (${smsCode})` : 'No'}`);

    // Summary
    console.log('\n--- Summary ---');
    const actionsSucceeded = [verificationCode, userVerified, smsCode].filter(Boolean).length;
    console.log(`Custom actions successfully executed: ${actionsSucceeded}/3`);
    if (actionsSucceeded !== 3) {
      throw new Error(`Only ${actionsSucceeded}/3 custom actions succeeded`);
    }

    console.log('\nKey points:');
    console.log('  - agent.registerAction() adds an action the LLM can invoke by name');
    console.log('  - Use ctx.variableStore.set() to hand values back to the test');
    console.log('  - When an action argument contains "{{ name }}", the SDK resolves it');
    console.log('    before your handler runs, so args holds the real value - use it directly.');

  } finally {
    await browser.close();
  }
}

customActionsExample().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
