# @shiplightai/sdk Examples

TypeScript examples demonstrating AI-powered browser automation with the Shiplight SDK.

## Setup

### 1. Install Dependencies

From the repository root:

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3. Configure API Key

Copy the example env file and add your API key:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
ANTHROPIC_API_KEY=your-anthropic-api-key
```

Get your key from: https://console.anthropic.com/settings/keys

## Running Examples

```bash
# Quick start - recommended first example
npm run quickstart

# Or run any example directly
npx tsx quickStart.ts
npx tsx basicUsage.ts
npx tsx loginExample.ts
```

## Examples

| Example | Description | Run |
|---------|-------------|-----|
| `quickStart.ts` | Basic SDK usage - login, assert, extract | `npm run quickstart` |
| `basicUsage.ts` | Core features - act, assert, evaluate, extract | `npm run basic` |
| `loginExample.ts` | Smart login with 2FA support | `npm run login` |
| `selfHealingExample.ts` | Self-healing with `step()` | `npm run self-healing` |
| `customActions.ts` | Extend agent with custom actions | `npm run custom-actions` |
| `variablesExample.ts` | Variable management | `npm run variables` |
| `fileOperationsExample.ts` | File upload | `npm run file-upload` |
| `extractionExample.ts` | Data extraction patterns | `npm run extraction` |

## Test Site

Examples use the Sauce Labs demo site (public):
- URL: https://www.saucedemo.com/
- Username: `standard_user`
- Password: `secret_sauce`

## Quick Reference

### Creating an Agent

```typescript
import { createAgent, configureSdk } from '@shiplightai/sdk';

configureSdk({
  env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
});
const agent = createAgent({ model: 'claude-haiku-4-5' });
```

### Core Methods

```typescript
// Single action
await agent.act(page, 'Click the submit button');

// Multi-step task
await agent.run(page, 'Complete the checkout process');

// Assert (throws on failure)
await agent.assert(page, 'Order confirmation is visible');

// Evaluate (returns boolean)
const isLoggedIn = await agent.evaluate(page, 'User is logged in');

// Extract data
await agent.extract(page, 'the order total', 'orderTotal');
const total = agent.getVariable('orderTotal');

// Smart login
await agent.login(page, {
  url: 'https://example.com/login',
  username: 'user@example.com',
  password: 'secret',
});
```

### Self-Healing

Wrap Playwright code with automatic recovery:

```typescript
const result = await agent.step(
  page,
  async () => {
    await page.click('#submit-btn');
  },
  'Click the submit button'
);

if (!result.success) {
  console.error('Failed:', result.details);
}
```

### Custom Actions

```typescript
import { createAgent, z } from '@shiplightai/sdk';

agent.registerAction({
  name: 'get_otp_code',
  description: 'Fetch OTP from email inbox',
  schema: z.object({
    email: z.string(),
  }),
  async execute(args, ctx) {
    const code = await fetchEmailOTP(args.email);
    ctx.variableStore.set('otp', code);
    return { success: true, message: 'OTP retrieved' };
  },
});
```

## Documentation

Full documentation: https://docs.shiplight.ai/sdk
