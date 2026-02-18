# Shiplight Examples

Example projects for [Shiplight](https://shiplight.ai) — AI-powered browser testing.

## [SDK Examples](./sdk-examples/)

TypeScript examples using `@shiplightai/sdk` for programmatic browser automation. Write scripts that drive a browser with natural language instructions, extract data, and self-heal when the UI changes.

```bash
npm install
npm run quickstart
```

## [YAML Examples](./yaml-examples/)

Playwright-native YAML test examples using `shiplightai`. Write tests in YAML with natural language steps and run them with `npx playwright test` — no custom tooling needed.

```bash
cd yaml-examples
npm install
npx playwright install chromium
npx playwright test
```

## Test Site

Both example sets target the public [Sauce Labs demo site](https://www.saucedemo.com/) — no account needed.
