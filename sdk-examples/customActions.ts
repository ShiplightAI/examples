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
 * Prerequisites:
 * - Set ANTHROPIC_API_KEY in .env file or environment variable
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Page } from 'playwright';

// Load .env BEFORE importing playwright (PWDEBUG must be set before playwright loads)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '.env') });

// Dynamic import to ensure PWDEBUG is set before playwright initializes
const { chromium } = await import('playwright');
const { createAgent, z, configureSdk } = await import('@shiplightai/sdk');

// Configure SDK with API key
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY not set');
  console.log('   Add to .env file or get your key from: https://console.anthropic.com/settings/keys');
  process.exit(1);
}
configureSdk({ env: { ANTHROPIC_API_KEY: apiKey } });

async function customActionsExample() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const agent = createAgent({
    model: 'claude-haiku-4-5',
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
      // In a real implementation, this would call an email API
      console.log(`Checking email for: ${args.email_address}`);

      // Simulate fetching email and extracting code
      const code = '123456';

      // Store the code in a variable for later use
      ctx.variableStore.set('verificationCode', code);

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
    console.log('Model: claude-haiku-4-5\n');

    await page.goto('https://example.com');

    // Test 1: Ask the agent to get an email verification code
    console.log('\n--- Test 1: Email Verification ---');
    console.log('Instruction: "Get the verification code for {{ testEmail }}"');
    await agent.act(page, 'Get the verification code for {{ testEmail }}');

    const verificationCode = agent.getVariable('verificationCode');
    console.log(`  Variable 'verificationCode' set: ${verificationCode ? `Yes (${verificationCode})` : 'No'}`);

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

  } finally {
    await browser.close();
  }
}

customActionsExample().catch(console.error);
