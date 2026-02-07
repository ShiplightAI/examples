# @shiplightai/sdk Examples

Examples demonstrating AI-powered browser automation with the Shiplight SDK.

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/ShiplightAI/sdk-examples.git
cd sdk-examples
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 4. Configure API Key

Copy the example env file and add your API key:

```bash
cp .env.example .env
```

Edit `.env` and add at least one API key:

```
# For Claude examples (quickStart, login, customActions, extraction)
ANTHROPIC_API_KEY=your-anthropic-api-key

# For Gemini examples (basicUsage, selfHealing, variables, fileOperations)
GOOGLE_API_KEY=your-google-api-key

PWDEBUG=console
```

Get your keys from:
- Anthropic: https://console.anthropic.com/settings/keys
- Google AI: https://aistudio.google.com/app/apikey

## Running Examples

```bash
# Quick start - recommended first example
npm run quickstart

# Or run any example directly
npx tsx examples/quickStart.ts
npx tsx examples/basicUsage.ts
npx tsx examples/loginExample.ts
```

## Examples

| Example | Model | Description | Run |
|---------|-------|-------------|-----|
| `quickStart.ts` | Claude | Basic SDK usage - login, assert, extract | `npm run quickstart` |
| `basicUsage.ts` | Gemini | Core features - act, assert, evaluate, extract | `npm run basic` |
| `loginExample.ts` | Claude | Smart login with 2FA support | `npm run login` |
| `selfHealingExample.ts` | Gemini | Self-healing with `step()` | `npm run self-healing` |
| `customActions.ts` | Claude | Extend agent with custom actions | `npm run custom-actions` |
| `variablesExample.ts` | Gemini | Variable management | `npm run variables` |
| `fileOperationsExample.ts` | Gemini | File upload | `npm run file-upload` |
| `extractionExample.ts` | Claude | Data extraction patterns | `npm run extraction` |

## Test Site

Examples use the Sauce Labs demo site (public):
- URL: https://www.saucedemo.com/
- Username: `standard_user`
- Password: `secret_sauce`

## Quick Reference

### Creating an Agent

```typescript
import { createAgent, configureSdk } from '@shiplightai/sdk';

// Use Claude
configureSdk({
  env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
});
const agent = createAgent({ model: 'claude-haiku-4-5' });

// Or use Gemini
configureSdk({
  env: { GOOGLE_API_KEY: process.env.GOOGLE_API_KEY },
});
const agent = createAgent({ model: 'gemini-2.5-pro' });
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
