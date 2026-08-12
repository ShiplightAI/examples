import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type SlackMessageContext = {
  workflow: string;
  branch: string;
  runUrl: string;
  triageUrl: string;
  conclusion: string;
};

export type AutofixResult = {
  skipped: boolean;
  test: string;
  has_changes: boolean;
  pr_url: string;
  run_url: string;
  verification: {
    status: string;
    pass_count: number;
  };
};

type FetchOptions = {
  method: string;
  headers: Record<string, string>;
  body: string;
};

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type FetchLike = (
  url: string,
  init: FetchOptions,
) => Promise<FetchResponse>;

const slackEndpoint = "https://slack.com/api/chat.postMessage";
const missingReportMessage =
  ":warning: Triage produced no report. Check the triage run for the cause — a missing model credential fails every engine and still exits green.";

function formatAutofixOutcome(result: AutofixResult): string | undefined {
  if (result.skipped) return undefined;
  if (result.pr_url) {
    return `:wrench: <${result.pr_url}|Auto-fix PR> for \`${result.test}\` — verification: *${result.verification.status}* (${result.verification.pass_count}/2)`;
  }
  if (result.has_changes === false) {
    return `:information_source: Auto-fix made no change for \`${result.test}\` — the agent judged the application at fault.`;
  }
  return `:warning: Auto-fix changed \`${result.test}\` but opened no PR — see <${result.run_url}|the autofix run>.`;
}

export function buildSlackMessage(
  context: SlackMessageContext,
  triageReport: string | undefined,
  autofixResults: AutofixResult[],
): string {
  const header = `:x: *${context.workflow}* ${context.conclusion} on \`${context.branch}\` — <${context.runUrl}|failed run> · <${context.triageUrl}|triage run>`;
  const autofixSummary = autofixResults
    .map(formatAutofixOutcome)
    .filter((line): line is string => line !== undefined)
    .join("\n");
  const body = autofixSummary
    ? `${triageReport || missingReportMessage}\n\n${autofixSummary}`
    : triageReport || missingReportMessage;

  return `${header}\n\n${body}`;
}

export async function postSlackMessage(
  token: string,
  channel: string,
  text: string,
  fetchRequest: FetchLike,
): Promise<void> {
  const response = await fetchRequest(slackEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });
  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(
      `Slack returned an invalid response (HTTP ${response.status}).`,
    );
  }
  const payload = parsed as Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    throw new Error(
      `Slack rejected the message: ${String(payload.error ?? "unknown")}`,
    );
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}

async function readTriageReport(path: string): Promise<string | undefined> {
  try {
    const report = await readFile(path, "utf8");
    if (report.length === 0) return undefined;
    return report.replace(/\n+$/, "");
  } catch (error: unknown) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
}

async function findAutofixResults(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const paths: string[] = [];
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) paths.push(...(await findAutofixResults(path)));
      if (entry.isFile() && entry.name === "autofix-result.json")
        paths.push(path);
    }
    return paths;
  } catch (error: unknown) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

async function loadAutofixResults(directory: string): Promise<AutofixResult[]> {
  const paths = await findAutofixResults(directory);
  return Promise.all(
    paths.map(
      async (path) => JSON.parse(await readFile(path, "utf8")) as AutofixResult,
    ),
  );
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main(): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL;
  if (!token || !channel) {
    console.log(
      "SLACK_RELEASE_BOT_TOKEN (org secret) or SLACK_ISSUE_CHANNEL_ID (org variable) is unset — skipping the Slack post.",
    );
    return;
  }

  const context: SlackMessageContext = {
    workflow: requiredEnvironment("WORKFLOW"),
    branch: requiredEnvironment("BRANCH"),
    runUrl: requiredEnvironment("RUN_URL"),
    triageUrl: requiredEnvironment("TRIAGE_URL"),
    conclusion: requiredEnvironment("CONCLUSION"),
  };
  const triageReport = await readTriageReport(
    process.argv[2] ?? "/tmp/triage-context/triage.md",
  );
  const autofixResults = await loadAutofixResults(
    process.argv[3] ?? "/tmp/autofix",
  );
  const message = buildSlackMessage(context, triageReport, autofixResults);
  const fetchRequest: FetchLike = async (url, init) => fetch(url, init);

  await postSlackMessage(token, channel, message, fetchRequest);
  console.log(`Posted to ${channel}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
