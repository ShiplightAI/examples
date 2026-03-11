# YAML Test Language Specification

**Version:** 1.3.0
**Status:** Living document — source of truth for the Shiplight YAML test format

> **Design principle:** This YAML format is designed for **coding agents to read and write**. The syntax is for humans to **read and understand**, not intended for humans to write directly.

---

## Table of Contents

1. [Overview](#1-overview)
2. [File Conventions](#2-file-conventions)
3. [Top-Level Keys](#3-top-level-keys)
4. [Statements](#4-statements)
   - [DRAFT](#41-draft)
   - [ACTION](#42-action)
   - [VERIFY](#43-verify-shorthand)
   - [URL](#44-url-shorthand)
   - [STEP](#45-step)
   - [IF_ELSE](#46-if_else)
   - [WHILE_LOOP](#47-while_loop)
   - [CODE](#48-code-shorthand)
5. [Templates](#5-templates)
6. [Functions](#6-functions)
7. [Variables](#7-variables)
8. [Teardown](#8-teardown)
9. [Test Suites](#9-test-suites)
10. [Lifecycle Hooks](#10-lifecycle-hooks)
11. [Parameterized Tests](#11-parameterized-tests)
12. [Complete Examples](#12-complete-examples)

---

## 1. Overview

A Shiplight YAML test file (`.test.yaml`) defines one or more end-to-end tests. A file can be either a **single-test file** (one test) or a **suite file** (multiple tests grouped with shared config and hooks). The transpiler converts it into a Playwright test file (`.yaml.spec.ts`) that uses the `shiplightai` fixture for AI-powered and deterministic browser automation.

**Key concepts:**
- **DRAFT** statements are natural language instructions resolved by AI at runtime (~5-10s each).
- **ACTION** statements are enriched DRAFTs with a `desc` (intent) and a cache (`action:`/`locator:` or `js:`) for deterministic replay (<1s each). When the cache fails, the agent auto-heals using the description.
- **Suites** group multiple tests in one file with shared hooks and sequential execution.
- **Lifecycle hooks** (`beforeAll`, `afterAll`, `beforeEach`, `afterEach`) handle setup and cleanup.
- **Parameterized tests** generate multiple test instances from data sets using `<<variable>>` substitution.
- The transpiler produces standalone Playwright tests — no runtime YAML dependency.

---

## 2. File Conventions

| Convention | Value |
|---|---|
| Test file extension | `*.test.yaml` |
| Generated output | `*.yaml.spec.ts` (sibling of YAML source) |
| Template files | Any `.yaml` — no naming restriction |
| Discovery | `**/*.test.yaml`, excluding `node_modules` |
| Max file size | 1 MB |

---

## 3. Top-Level Keys

A file must be either a **single-test file** (with `goal`/`statements`) or a **suite file** (with `suite`). Having both is an error. The `goal` field is auto-derived from `name` if not explicitly provided.

### Required Keys (Single-Test Files)

| Key | Type | Description |
|---|---|---|
| `goal` | `string` | Test objective. Becomes the Playwright test title if `name` is not set. Auto-derived from `name` if omitted. |
| `statements` | `Statement[]` | Ordered list of test steps. See [Statements](#5-statements). |

### Required Keys (Suite Files)

| Key | Type | Description |
|---|---|---|
| `suite` | `object` | Suite definition. See [Test Suites](#9-test-suites). Mutually exclusive with `goal`/`statements`. |

### Optional Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `test_case_id` | `number` | — | Links to a cloud test case for sync. |
| `name` | `string` | — | Test title override (single-test) or suite name (suite). If set on a single-test file without `goal`, `goal` is auto-derived from `name`. |
| `tags` | `string[]` | — | Playwright tags for `--grep` filtering. Each tag is prefixed with `@` in the test name. |
| `use` | `object` | — | Playwright `test.use()` config. Supports all Playwright use options (`baseURL`, `viewport`, `storageState`, `locale`, `timezoneId`, `httpCredentials`, etc.). |
| `teardown` | `Statement[]` | — | Cleanup steps that run in a `finally` block, even if the test fails. Single-test only. |
| `beforeEach` | `Statement[]` | — | Statements to run before each test. Single-test files only. See [Lifecycle Hooks](#10-lifecycle-hooks). |
| `afterEach` | `Statement[]` | — | Statements to run after each test. Single-test files only. See [Lifecycle Hooks](#10-lifecycle-hooks). |
| `parameters` | `ParameterSet[]` | — | Data sets for parameterized test generation. See [Parameterized Tests](#11-parameterized-tests). |
| `timeout` | `number` | — | Per-test timeout in milliseconds. Transpiles to `test.setTimeout()`. |
| `skip` | `boolean \| string` | — | Skip test. `true` skips unconditionally; a string skips with a reason message. Prefer string form (`skip: "Bug #123"`) so reason is visible in reports. |
| `fail` | `boolean \| string` | — | Mark test as expected failure. `true` or a reason string. Prefer string form (`fail: "Known issue"`) so reason is visible in reports. |
| `only` | `boolean` | — | Focus: run only this test. Transpiles to `test.only()`. |
| `slow` | `boolean` | — | Triple the test timeout. Transpiles to `test.slow()`. |
| `final_feedback` | `string` | — | Runtime field. Final execution feedback from the last run. |

---

## 4. Statements

Statements are the building blocks of a test. Each statement has a `type` (inferred from YAML syntax) and a system-generated `uid` (UUID v4, assigned during parsing).

### Core Statement Types

| Type | Enriched? | Description |
|---|---|---|
| `DRAFT` | No | Natural language instruction. Requires AI agent execution at runtime. |
| `ACTION` | Yes | Enriched with a cache (`action:`/`locator:` or `js:`) for deterministic replay. |
| `STEP` | Yes | A multi-action container — groups multiple child statements (ACTIONs, DRAFTs, etc.). |

A DRAFT is not yet enriched. When the AI agent executes a DRAFT, it enriches into either an ACTION (single action produced) or a STEP (multiple actions produced). ACTIONs and STEPs are already enriched and replay deterministically.

### Statement Type Inference

| YAML Syntax | Inferred Type | Description |
|---|---|---|
| `VERIFY: ...` | `ACTION` | Assertion shorthand |
| `URL: ...` | `ACTION` (go_to_url) | Navigation shorthand (auto-generates `action_entity`) |
| `desc` only | `DRAFT` | Natural language instruction in object form |
| Object with `desc` + `js` | `ACTION` | Deterministic action with Playwright code cache. Self-heals via `desc` when `js` fails. |
| Object with `action` key | `ACTION` | Deterministic browser action |
| `STEP: ...` + `statements:` | `STEP` | Group of related statements |
| `IF: ...` + `THEN: ...` | `IF_ELSE` | Conditional execution |
| `WHILE: ...` + `DO: ...` | `WHILE_LOOP` | Loop with timeout |
| `CODE: ...` | `ACTION` | Inline JavaScript/code block |
| `template: ...` | *(inlined)* | Expanded before parsing — not a statement type |
| `call: "file#export"` | `ACTION` | Calls a custom function — see [Functions](#6-functions) |

---

### 4.1 DRAFT

A natural language instruction that requires AI agent execution at runtime. The agent interprets the instruction and produces concrete browser actions. After execution, a DRAFT is enriched into an ACTION (single action produced) or a STEP (multiple actions produced).

**Syntax:**

```yaml
statements:
  - desc: Click the login button
```

**Performance:** ~5-10 seconds per DRAFT (AI resolution).

---

### 4.2 ACTION

An enriched browser action that replays deterministically (<1s). Every ACTION has a `desc` that serves as the **intent** — it defines _what_ the action does. The `action`/`locator` or `js` fields are **caches** of _how_ to do it. When a cache fails (stale locator, changed DOM), the agent self-heals by using the description to re-inspect the page and regenerate the action.

Two syntax forms. In YAML, the presence of `action` or `js` key distinguishes an ACTION from a DRAFT — a `desc`-only object is parsed as a DRAFT.

**`js:` shorthand** — a complete, executable Playwright statement. `page`, `agent`, and `expect` are available in scope.

```yaml
statements:
  - desc: Click the login button
    js: "await page.getByRole('button', { name: 'Login' }).first().click({ timeout: 5000 })"

  - desc: Press Escape to close dialog
    js: "await page.keyboard.press('Escape')"
```

**Structured format** — named action with parameters. All fields other than `desc`, `action`, `locator`, `xpath` are passed as arguments to the action. See `shiplight://schemas/action-entity` for available actions and their parameters.

```yaml
statements:
  - desc: Enter email address
    action: input_text
    locator: "getByPlaceholder('Email')"
    text: "user@example.com"

  - desc: Select country
    action: select_dropdown_option
    locator: "getByRole('combobox')"
    text: "United States"
```

**Fields:**

| Field | Type | Required | Description |
|---|---|---|---|
| `desc` | `string` | Yes | Human-readable description (intent for self-healing). |
| `js` | `string` | `js:` form | Complete, executable Playwright statement. |
| `action` | `string` | Structured form | Action name. See `shiplight://schemas/action-entity` for available actions. |
| `locator` | `string` | No | Playwright locator string. |
| `xpath` | `string` | No | XPath selector. Only needed when an ACTION has neither `locator` nor `js`. |

**Performance:** ~1 second (deterministic replay).

---

### 4.3 VERIFY (Shorthand)

Shorthand for assertions.

**Syntax:**

```yaml
statements:
  # Draft (AI-only, no cache)
  - VERIFY: The dashboard heading is visible
  - VERIFY: Shopping cart shows 3 items

  # Enriched (with JS code cache — quote values containing { } : or other special YAML chars)
  - VERIFY: button ABC is visible
    js: "await expect(page.getByRole('button', { name: 'ABC' })).toBeVisible({ timeout: 2000 })"
```

When the optional `js` sibling key is present, it acts as a code cache for the assertion.

**Execution behavior:**
- **`statement` only (draft):** AI evaluates the natural language assertion (~5-10s).
- **`js` only:** Runs the JS assertion directly (<1s). No AI fallback.
- **Both `js` and `statement` (enriched):** Runs `js` first. If it fails, falls back to AI evaluation of `statement` (self-healing). The `js` cache is written by AI agents during enrichment, not by humans.

**Quoting rules:** Same as `CODE:` and `IF:`/`WHILE:` — quote the value when it contains special YAML characters (`{`, `}`, `:`, `#`, etc.).

---

### 4.4 URL (Shorthand)

Shorthand for page navigation.

**Syntax:**

```yaml
statements:
  # Plain URL
  - URL: /inventory.html
  - URL: https://app.example.com/login

  # With optional arguments
  - URL: /dashboard
    new_tab: true
    timeout_seconds: 30
```

**Optional sibling keys:**

| Key | Type | Default | Description |
|---|---|---|---|
| `new_tab` | `boolean` | `false` | Open the URL in a new browser tab. |
| `timeout_seconds` | `number` | — | Navigation timeout in seconds. |

**Notes:**
- Relative URLs (e.g., `/path`) resolve against Playwright's `baseURL` config.

---

### 4.5 STEP

A multi-action container that groups related child statements. A STEP is the enriched form when a DRAFT produces multiple actions, or it can be authored directly to organize logically related statements.

**Syntax:**

```yaml
statements:
  - STEP: Complete checkout
    statements:
      - Enter shipping address
      - Select payment method
      - Click Place Order
```

**Rules:**
- `STEP` (string, required): Description of what this group does.
- `statements` (array, required): Child statements (any type, including nested STEPs).

---

### 4.6 IF_ELSE

Conditional execution with an optional ELSE branch.

**Syntax — AI condition (default):**

```yaml
statements:
  - IF: cookie consent dialog is visible
    THEN:
      - Click Accept All
    ELSE:
      - VERIFY: no cookie dialog blocking
```

**Syntax — JavaScript condition:**

```yaml
statements:
  - IF: "js: document.querySelector('.modal') !== null"
    THEN:
      - Close the modal
```

**Condition types:**

| Prefix | Type | Evaluation |
|---|---|---|
| *(none)* | `AI_MODE` | Natural language, evaluated by the AI agent at runtime |
| `js:` | `JS_CODE` | JavaScript expression, evaluated in browser context. Must return truthy/falsy. |

**Rules:**
- `IF` (string, required): Condition expression.
- `THEN` (array, required): Statements to execute if condition is true.
- `ELSE` (array, optional): Statements to execute if condition is false.

---

### 4.7 WHILE_LOOP

Repeats statements until the condition is false or timeout is exceeded.

**Syntax:**

```yaml
statements:
  - WHILE: there are more pages of results
    DO:
      - Click the Next button
      - VERIFY: new results loaded
    timeout_ms: 60000
```

**Syntax — JavaScript condition:**

```yaml
statements:
  - WHILE: "js: document.querySelectorAll('.item').length < 10"
    DO:
      - Scroll down
```

**Rules:**
- `WHILE` (string, required): Condition expression (same `AI_MODE`/`JS_CODE` rules as IF_ELSE).
- `DO` (array, required): Statements to execute each iteration.
- `timeout_ms` (number, optional): Maximum loop duration. Default: `180000` (3 minutes).

---

### 4.8 CODE (Shorthand)

An ergonomic shorthand for inline code execution. Useful for network mocking, localStorage manipulation, and other page-level scripting. No self-healing — if the code fails, it fails.

**Syntax — single-line:**

```yaml
statements:
  - CODE: "await page.route('**/api', r => r.abort())"
```

**Syntax — multiline (block scalar):**

```yaml
statements:
  - CODE: |
      await page.route('**/api/users', (route) => route.fulfill({
        status: 200,
        body: JSON.stringify([{ name: 'John' }]),
      }));
```

**Notes:**
- The code runs in the Playwright test context (Node.js), not in the browser. Use `page.evaluate()` for browser-context code.
- `page`, `agent`, and `expect` are available in scope.

---

## 5. Templates

Templates extract reusable statement groups into separate YAML files.

### 5.1 Template File Format

```yaml
params:
  - username
  - password
statements:
  - desc: Enter username
    action: input_text
    locator: "getByPlaceholder('Username')"
    text: "<<username>>"
  - desc: Enter password
    action: input_text
    locator: "getByPlaceholder('Password')"
    text: "<<password>>"
  - desc: Click login
    js: "await page.getByRole('button', { name: 'Log in' }).first().click({ timeout: 5000 })"
```

### 5.2 Using Templates

```yaml
statements:
  - template: ./templates/login.yaml
    params:
      username: admin@test.com
      password: "{{TEST_PASSWORD}}"
  - VERIFY: Dashboard is visible
```

### 5.3 Template Rules

| Rule | Detail |
|---|---|
| Path resolution | Relative to the importing YAML file |
| Required params | All params listed in the template's `params` array must be provided |
| Substitution | `<<paramName>>` in template statements replaced with provided values |
| Nesting | Templates can reference other templates (max depth: **5**) |
| Circular references | Detected and rejected with an error |
| Inlining | Template statements are inlined — the `template:` reference itself is not a statement type |
| Cache invalidation | Changes to template files trigger re-transpilation of importing test files |

---

## 6. Functions

Functions let you call custom TypeScript/JavaScript code from YAML tests. Like templates, functions are a reuse mechanism — but while templates inline YAML statements at compile time, functions import and call code at runtime.

### 6.1 Syntax

```yaml
statements:
  - desc: Greet the user
    call: "../helpers/utils.ts#greet"
    args: [page, "hello"]
```

The `call` field is all that's needed — no `action: function` required. The transpiler infers it's a function action from the `call` key.

### 6.2 Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `desc` | `string` | Yes | Human-readable description (intent for self-healing). |
| `call` | `string` | Yes | `filePath#exportName` reference. Path is relative to the test file. |
| `args` | `string[]` | No | Arguments to pass to the function. Reads like the function's call signature. |

### 6.3 Function File Format

```typescript
// helpers/cart.ts
import { Page } from '@playwright/test';

export async function clearCart(page: Page): Promise<void> {
  // actual code here
}
```

### 6.4 Argument Value Rules

Each value in `args` is transpiled based on what it looks like:

| Value | Treatment | Example output |
|---|---|---|
| `page`, `request`, `testContext` | Passed as the Playwright/system object (unquoted) | `page` |
| `null`, `undefined`, `true`, `false` | Passed as JavaScript literals | `null` |
| Numeric strings | Passed as numbers | `42` |
| `$variableName` | Resolved from the variable store | `agent.agentServices.readVariable('variableName')` |
| Anything else | Passed as a quoted string | `"hello"` |

### 6.5 Rules

| Rule | Detail |
|---|---|
| Path resolution | Relative to the test file, not the project root |
| Extension stripping | `.ts`/`.js`/`.mjs` is stripped in the generated import |
| Async | Functions should be `async` — they are always `await`ed |
| Statement type | Parsed as an `ACTION` — not a separate statement type |

---

## 7. Variables

Variables store and reuse dynamic values throughout test execution. They come from pre-defined config or are created dynamically during execution.

### 7.1 Variable Types

| Type | Scope | Description |
|---|---|---|
| Pre-defined | Per-project | Configured in `shiplight.config.json` under the `variables` key. Loaded into the agent's `VariableStore` at test start. |
| Dynamic | Single test run | Created during execution (Extract action, natural language like "Save the order number to orderId"). Reset each run. |

### 7.2 Configuring Variables

Variables are defined in `shiplight.config.json` (searched upward from the test file directory):

```json
{
  "variables": {
    "SAUCE_USER": "standard_user",
    "SAUCE_PASS": { "value": "secret_sauce", "sensitive": true }
  }
}
```

Sensitive variables are masked in logs and screenshots.

### 7.3 Using Variables in YAML

The `{{variableName}}` syntax references a variable. In YAML, the `{{VAR}}` placeholder is preserved as a literal string in the transpiled code. At action execution time, the agent resolves it from the `VariableStore` via `replaceVariables()`.

```yaml
statements:
  - desc: Enter email
    action: input_text
    locator: "getByPlaceholder('Email')"
    text: "{{userEmail}}"
```

The transpiled code keeps `"{{userEmail}}"` as-is. When the `input_text` action executes, the agent substitutes `{{userEmail}}` with the value from the `VariableStore`.

### 7.4 Template Params vs Runtime Variables

- **Template params** use `<<paramName>>` syntax and are substituted at compile time (template expansion / parameterized tests).
- **Runtime variables** use `{{VAR}}` syntax and are resolved by the agent at runtime from the `VariableStore`.
- The two syntaxes are distinct — `<<param>>` is always resolved before parsing, `{{VAR}}` always passes through to runtime.
- Param values can contain `{{RUNTIME_VAR}}` — these pass through template expansion unchanged and get resolved at runtime.

---

## 8. Teardown

Cleanup statements that execute in a `finally` block, even if the main test fails.

```yaml
goal: Create and verify user
statements:
  - Create a new user named TestUser
  - VERIFY: TestUser appears in the user list
teardown:
  - Delete user TestUser
  - VERIFY: TestUser is removed from the list
```

**Rules:**
- Teardown uses the same statement syntax as `statements` (DRAFT, ACTION, VERIFY, URL, STEP, IF_ELSE, WHILE_LOOP, CODE, js:, template).
- Teardown always runs, regardless of test success or failure.
- Teardown is separate from lifecycle hooks (see [Lifecycle Hooks](#10-lifecycle-hooks)).

---

## 9. Test Suites

A suite groups multiple tests in a single file with shared configuration and lifecycle hooks. Suites transpile to a `test.describe()` block.

### 9.1 Suite Structure

```yaml
name: Inventory Browsing Suite
tags: [smoke, suite]

suite:
  tests:
    - name: Sort products by price
      statements:
        - desc: Sort by price low to high
          action: select_dropdown_option
          locator: "getByRole('combobox')"
          text: "Price (low to high)"
        - VERIFY: Products are sorted by price ascending

    - name: View product details
      statements:
        - desc: Click the first product name
          js: "await page.locator('.inventory_item_name').first().click({ timeout: 5000 })"
        - VERIFY: The product detail page is displayed
```

### 9.2 Suite Keys

| Key | Type | Required | Description |
|---|---|---|---|
| `tests` | `SuiteTest[]` | Yes | Array of test definitions (at least one). |
| `beforeAll` | `Statement[]` | No | Runs once before all tests. See [Lifecycle Hooks](#10-lifecycle-hooks). |
| `afterAll` | `Statement[]` | No | Runs once after all tests. |
| `beforeEach` | `Statement[]` | No | Runs before each test. |
| `afterEach` | `Statement[]` | No | Runs after each test. |

### 9.3 Suite Test Keys

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Test name. Becomes the Playwright `test()` title. |
| `statements` | `Statement[]` | Yes | Ordered list of test steps. |
| `teardown` | `Statement[]` | No | Cleanup steps in a `finally` block for this test. |
| `parameters` | `ParameterSet[]` | No | Data sets for parameterized variants. See [Parameterized Tests](#11-parameterized-tests). |
| `timeout` | `number` | No | Per-test timeout in milliseconds. |
| `skip` | `boolean \| string` | No | Skip this test. `true` or a reason string. |
| `fail` | `boolean \| string` | No | Expected failure. `true` or a reason string. |
| `only` | `boolean` | No | Focus: run only this test. |
| `slow` | `boolean` | No | Triple the test timeout. |

### 9.4 Suite Transpilation Notes

- Suites always transpile to `test.describe.serial()` (sequential execution). For parallel tests, use separate test files.
- Tags go on the describe block name, not individual tests
- `test.use()` is placed outside the describe block
- Each test gets its own `test()` function with `{ page, agent }` fixtures

### 9.5 Validation Rules

- A file cannot have both `suite` and top-level `goal`/`statements`
- `suite.tests` must be a non-empty array
- Each suite test must have `name` (string) and `statements` (array)

---

## 10. Lifecycle Hooks

> **Note:** `beforeAll`/`afterAll` run without an agent. DRAFT and AI actions are silently skipped.

Hooks run setup/cleanup code around tests. They are available in both single-test and suite files.

### 10.1 Single-Test Hooks

Single-test files support `beforeEach` and `afterEach` at the top level:

```yaml
name: Login test
goal: Verify login flow

beforeEach:
  - URL: https://app.example.com/login

afterEach:
  - URL: https://app.example.com/logout

statements:
  - desc: Enter credentials and submit
  - VERIFY: dashboard is visible
```

### 10.2 Suite Hooks

Suite files support all four hooks inside the `suite` block:

```yaml
name: Cart Management Suite
tags: [e2e, hooks]

suite:
  beforeAll:
    - URL: /inventory.html

  beforeEach:
    - URL: /inventory.html
    - desc: Add item to cart
      js: "await page.locator('[data-test=\"add-to-cart-sauce-labs-backpack\"]').first().click({ timeout: 5000 })"

  afterEach:
    - desc: Remove item from cart
      js: "await page.locator('[data-test=\"remove-sauce-labs-backpack\"]').first().click({ timeout: 5000 })"

  afterAll:
    - URL: /inventory.html

  tests:
    - name: Verify cart badge
      statements:
        - VERIFY: The shopping cart badge shows 1 item
```

### 10.3 Hook Fixture Scoping

| Hook | Fixture | Notes |
|---|---|---|
| `beforeEach` | `{ page, agent }` | Same page instance as the test. Full agent available. |
| `afterEach` | `{ page, agent }` | Same page instance as the test. Full agent available. |
| `beforeAll` | `{ browser }` | Worker-scoped. Creates a temporary page via `browser.newPage()`, closes it after hook completes. **No agent available.** |
| `afterAll` | `{ browser }` | Worker-scoped. Creates a temporary page via `browser.newPage()`, closes it after hook completes. **No agent available.** |

### 10.4 beforeAll/afterAll Limitations (noAgent Mode)

Since `beforeAll` and `afterAll` use worker-scoped fixtures without an agent, the following restrictions apply:

- **DRAFT statements** are skipped with a comment (they require the agent)
- **AI actions** (e.g., `verify`) are skipped with a comment
- **Navigation actions** (`go_to_url`, `go_back`, `go_forward`) are transpiled to direct Playwright calls (`page.goto()`, `page.goBack()`, `page.goForward()`)
- **DOM actions** with locators (`click`, `input_text`, `select_dropdown_option`) are transpiled to direct Playwright locator calls

### 10.5 Hook Statement Types

Hook statement arrays use the same syntax as regular `statements`. Templates are expanded in hooks. All statement types (DRAFT, ACTION, VERIFY, URL, STEP, IF_ELSE, WHILE_LOOP, CODE, js:, template) are syntactically valid, though DRAFT and AI-based statements are skipped in `beforeAll`/`afterAll`.

---

## 11. Parameterized Tests

Parameters generate multiple test instances from data sets. Each parameter set produces a separate `test()` with `<<variable>>` placeholders substituted.

### 11.1 Single-Test Parameters

```yaml
name: Add product to cart
tags: [e2e, parameterized]

parameters:
  - name: backpack
    values:
      product_selector: "[data-test=\"add-to-cart-sauce-labs-backpack\"]"
      product_name: Sauce Labs Backpack
  - name: bike light
    values:
      product_selector: "[data-test=\"add-to-cart-sauce-labs-bike-light\"]"
      product_name: Sauce Labs Bike Light

statements:
  - desc: Add product to cart
    js: "await page.locator('<<product_selector>>').first().click({ timeout: 5000 })"
  - VERIFY: <<product_name>> is in the cart
```

### 11.2 Suite Test Parameters

Individual tests within a suite can also have parameters:

```yaml
suite:
  tests:
    - name: Login with role
      parameters:
        - name: admin
          values: { username: admin@test.com }
        - name: editor
          values: { username: editor@test.com }
      statements:
        - "Enter <<username>>"
        - VERIFY: logged in successfully
```

### 11.3 ParameterSet Structure

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Variant name. Appended to test title as `[name]`. |
| `values` | `Record<string, string>` | Yes | Key-value pairs. Keys match `<<key>>` placeholders. |

### 11.4 Substitution Rules

- Substitution happens at transpile time, before code generation
- The entire TestFlow is serialized → `<<key>>` replaced with the value → deserialized back
- Each parameter set produces a completely independent test instance
- `{{VAR}}` placeholders are unaffected by parameter substitution — they are resolved at runtime by the agent's `VariableStore` (see [Variables](#7-variables))

### 11.5 Validation Rules

- Each parameter set must have `name` (string) and `values` (object)
- `values` must be a non-empty object
- Parameter names should be unique within the `parameters` array

---

## 12. Complete Examples

### 12.1 Single-Test File

```yaml
test_case_id: 303
name: Checkout flow with login
tags: [e2e, checkout, critical]

use:
  storageState: auth/user.json
  viewport: { width: 1280, height: 720 }

goal: Complete checkout for authenticated user

statements:
  # Template: reusable login flow
  - template: ./templates/login.yaml
    params:
      email: "{{TEST_USER_EMAIL}}"
      password: "{{TEST_USER_PASSWORD}}"

  # Assertion
  - VERIFY: Product catalog is visible

  # DRAFT: AI resolves at runtime
  - desc: Click on the first product

  # ACTION: js: shorthand
  - desc: Click Add to Cart
    js: "await page.getByRole('button', { name: 'Add to Cart' }).first().click({ timeout: 5000 })"

  # ACTION: structured format
  - desc: Enter address
    action: input_text
    locator: "getByPlaceholder('Address')"
    text: 123 Main St

  # STEP: grouped actions
  - STEP: Fill shipping info
    statements:
      - desc: Enter address
        action: input_text
        locator: "getByPlaceholder('Address')"
        text: 123 Main St
      - desc: Select shipping method
        action: select_dropdown_option
        locator: "getByRole('combobox', { name: 'Shipping' })"
        option: Standard Shipping

  # Conditional
  - IF: promo code field is visible
    THEN:
      - desc: Enter promo code
        action: input_text
        locator: "getByPlaceholder('Promo Code')"
        text: SAVE10
      - Click Apply
    ELSE:
      - VERIFY: no promo code field displayed

  # Loop
  - WHILE: there are more items to review
    DO:
      - desc: Scroll down
      - VERIFY: next item is visible
    timeout_ms: 60000

  - desc: Click Place Order
  - VERIFY: Order confirmation page is displayed

teardown:
  - IF: Cancel Order button is visible
    THEN:
      - desc: Click Cancel Order
      - desc: Click Confirm
```

### 12.2 Suite with Hooks

```yaml
name: Cart Management Suite
tags: [e2e, hooks]

suite:
  beforeAll:
    - URL: /inventory.html

  beforeEach:
    - URL: /inventory.html
    - desc: Add Sauce Labs Backpack to cart
      js: "await page.locator('[data-test=\"add-to-cart-sauce-labs-backpack\"]').first().click({ timeout: 5000 })"

  afterEach:
    - desc: Remove Backpack from cart if present
      js: "await page.locator('[data-test=\"remove-sauce-labs-backpack\"]').first().click({ timeout: 5000 })"

  afterAll:
    - URL: /inventory.html

  tests:
    - name: Verify cart badge shows item count
      statements:
        - VERIFY: The shopping cart badge shows 1 item

    - name: Verify remove button appears after adding to cart
      statements:
        - VERIFY: A Remove button is visible for Sauce Labs Backpack
```

### 12.3 Parameterized Test

```yaml
name: Add product to cart
tags: [e2e, parameterized]

parameters:
  - name: backpack
    values:
      product_selector: "[data-test=\"add-to-cart-sauce-labs-backpack\"]"
      product_name: Sauce Labs Backpack
  - name: bike light
    values:
      product_selector: "[data-test=\"add-to-cart-sauce-labs-bike-light\"]"
      product_name: Sauce Labs Bike Light

statements:
  - desc: Add product to cart
    js: "await page.locator('<<product_selector>>').first().click({ timeout: 5000 })"

  - desc: Click cart icon
    js: "await page.locator('[data-test=\"shopping-cart-link\"]').first().click({ timeout: 5000 })"

  - VERIFY: <<product_name>> is in the cart
```
