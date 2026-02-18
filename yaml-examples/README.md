# YAML Test Examples

Runnable YAML test examples for [shiplightai](https://www.npmjs.com/package/shiplightai). Each file demonstrates specific features of the YAML test format.

All examples target the public [Sauce Labs demo site](https://www.saucedemo.com/) — no account required.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env and add your API key
```

## Run

```bash
# Run all examples (except auth, which needs globalSetup)
npx playwright test --project saucedemo

# Run a single example
npx playwright test saucedemo/01-basic.test.yaml

# Run authenticated examples
npx playwright test --project saucedemo-auth

# Run everything
npx playwright test
```

## Examples

| File | Features |
|------|----------|
| [`01-basic.test.yaml`](./saucedemo/01-basic.test.yaml) | `goal`, `url`, draft statements, inline `VERIFY` |
| [`02-verify-assertions.test.yaml`](./saucedemo/02-verify-assertions.test.yaml) | Multiple `VERIFY` assertions |
| [`03-actions.test.yaml`](./saucedemo/03-actions.test.yaml) | `action_entity` with `locator`/`xpath`, `click`, `input_text`, `press`, `clear_input`, `select_dropdown_option`, `scroll`, `verify` |
| [`04-steps-and-control-flow.test.yaml`](./saucedemo/04-steps-and-control-flow.test.yaml) | `STEP` grouping, `IF`/`ELSE` (AI + `js:` conditions) |
| [`05-fixtures-and-tags.test.yaml`](./saucedemo/05-fixtures-and-tags.test.yaml) | `name`, `tags`, `use:` (viewport, locale) |
| [`06-variables.test.yaml`](./saucedemo/06-variables.test.yaml) | `{{VAR_NAME}}` in action_entity kwargs |
| [`07-teardown-and-navigation.test.yaml`](./saucedemo/07-teardown-and-navigation.test.yaml) | `teardown`, `go_back`, `go_to_url`, `reload_page`, `save_variable` |
| [`08-authenticated-test.test.yaml`](./saucedemo-auth/08-authenticated-test.test.yaml) | `storageState` via globalSetup, `shiplight.config.json` |
| [`09-templates.test.yaml`](./09-templates.test.yaml) | `template:` with params, env var pass-through |
| [`10-custom-functions.test.yaml`](./10-custom-functions.test.yaml) | `function` action with `file#export` |

### Supporting files

| File | Purpose |
|------|---------|
| [`templates/login.yaml`](./templates/login.yaml) | Reusable login template with params |
| [`helpers/cart.ts`](./helpers/cart.ts) | TypeScript helper for function action example |
| [`saucedemo-auth/shiplight.config.json`](./saucedemo-auth/shiplight.config.json) | Credentials for auth example |

### Illustrative (syntax reference)

The [`illustrative/`](./illustrative/) directory contains examples that demonstrate YAML syntax features but may not run against saucedemo.com. See [`illustrative/README.md`](./illustrative/README.md) for details.

## Authentication

The `saucedemo-auth/` project demonstrates Playwright's `globalSetup` pattern for apps that require login. The flow:

1. `global-setup.ts` runs before tests, using AI to log in
2. Cookies are saved to `.auth/storage-state.json`
3. The `saucedemo-auth` project loads this state so tests start authenticated

## Documentation

- [shiplightai CLI README](https://github.com/ShiplightAI/monots/tree/main/apps/cli) — full YAML format reference
- [Shiplight Docs](https://docs.shiplight.ai) — platform documentation
