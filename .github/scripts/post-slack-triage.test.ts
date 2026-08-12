import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildSlackMessage,
  postSlackMessage,
  type AutofixResult,
  type FetchLike,
  type SlackMessageContext,
} from "./post-slack-triage.ts";

const context: SlackMessageContext = {
  workflow: "Demo Tests",
  branch: "main",
  runUrl: "https://github.com/ShiplightAI/examples/actions/runs/123",
  triageUrl: "https://github.com/ShiplightAI/examples/actions/runs/456",
  conclusion: "failure",
};

test("buildSlackMessage preserves the triage report verbatim", () => {
  const report =
    "```\nlogin   app_regression   needs human\n```\n*login* — redirect failed.";

  assert.equal(
    buildSlackMessage(context, report, []),
    ":x: *Demo Tests* failure on `main` — <https://github.com/ShiplightAI/examples/actions/runs/123|failed run> · <https://github.com/ShiplightAI/examples/actions/runs/456|triage run>\n\n" +
      report,
  );
});

test("buildSlackMessage supplies a fallback and summarizes non-skipped autofix outcomes", () => {
  const outcomes: AutofixResult[] = [
    {
      skipped: true,
      test: "ignored.test.yaml",
      has_changes: false,
      pr_url: "",
      run_url: "https://github.com/runs/1",
      verification: { status: "not_run", pass_count: 0 },
    },
    {
      skipped: false,
      test: "fixed.test.yaml",
      has_changes: true,
      pr_url: "https://github.com/ShiplightAI/examples/pull/10",
      run_url: "https://github.com/runs/2",
      verification: { status: "verified", pass_count: 2 },
    },
    {
      skipped: false,
      test: "app.test.yaml",
      has_changes: false,
      pr_url: "",
      run_url: "https://github.com/runs/3",
      verification: { status: "not_run", pass_count: 0 },
    },
    {
      skipped: false,
      test: "unpublished.test.yaml",
      has_changes: true,
      pr_url: "",
      run_url: "https://github.com/runs/4",
      verification: { status: "failed", pass_count: 0 },
    },
  ];

  const message = buildSlackMessage(context, undefined, outcomes);

  assert.match(message, /Triage produced no report/);
  assert.doesNotMatch(message, /ignored\.test\.yaml/);
  assert.match(
    message,
    /<https:\/\/github\.com\/ShiplightAI\/examples\/pull\/10\|Auto-fix PR>/,
  );
  assert.match(message, /verification: \*verified\* \(2\/2\)/);
  assert.match(message, /Auto-fix made no change for `app\.test\.yaml`/);
  assert.match(message, /<https:\/\/github\.com\/runs\/4\|the autofix run>/);
});

test("postSlackMessage sends the expected JSON payload and accepts ok=true", async () => {
  const calls: Array<{ url: string; init?: Parameters<FetchLike>[1] }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };

  await postSlackMessage("token", "C123", "hello", fetch);

  assert.equal(calls[0].url, "https://slack.com/api/chat.postMessage");
  assert.equal(
    calls[0].init?.headers &&
      (calls[0].init.headers as Record<string, string>).Authorization,
    "Bearer token",
  );
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    channel: "C123",
    text: "hello",
    unfurl_links: false,
  });
});

test("postSlackMessage rejects Slack errors returned with HTTP 200", async () => {
  const fetch: FetchLike = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: false, error: "channel_not_found" }),
  });

  await assert.rejects(
    postSlackMessage("token", "missing", "hello", fetch),
    /channel_not_found/,
  );
});
