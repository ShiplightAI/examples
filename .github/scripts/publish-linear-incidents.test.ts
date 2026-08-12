import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildIncident,
  createLinearRequest,
  exchangeClientCredentials,
  publishLinearIncidents,
  type FetchLike,
  type GraphqlRequest,
  type Verdict,
} from "./publish-linear-incidents.ts";

const verdict: Verdict = {
  schema_version: "1.0",
  repository: "ShiplightAI/examples",
  workflow: "Demo Tests",
  run_id: "123",
  run_url: "https://github.com/ShiplightAI/examples/actions/runs/123",
  commit: "0123456789abcdef",
  branch: "main",
  conclusion: "failure",
  failures: [
    {
      test: "demo/login.test.yaml",
      classification: "app_regression",
      fixable: false,
      confidence: "high",
      target_file: "",
      fix_summary: "Login no longer redirects to the inventory page.",
      dedup_key:
        "v1:ShiplightAI%2Fexamples:Demo%20Tests:demo%2Flogin.test.yaml:app_regression",
    },
    {
      test: "demo/search.test.yaml",
      classification: "spec_issue",
      fixable: true,
      confidence: "high",
      target_file: "demo/search.test.yaml",
      fix_summary: "Update the stale button label.",
      dedup_key:
        "v1:ShiplightAI%2Fexamples:Demo%20Tests:demo%2Fsearch.test.yaml:spec_issue",
    },
  ],
};

test("buildIncident carries the stable dedup marker and latest run context", () => {
  const incident = buildIncident(verdict, verdict.failures[0]);

  assert.equal(
    incident.marker,
    "<!-- shiplight-ci-triage-dedup:v1:ShiplightAI%2Fexamples:Demo%20Tests:demo%2Flogin.test.yaml:app_regression -->",
  );
  assert.match(incident.title, /^\[CI\]\[app regression\] /);
  assert.match(
    incident.description,
    /\[Failed GitHub Actions run\]\(https:\/\/github\.com\/ShiplightAI\/examples\/actions\/runs\/123\)/,
  );
  assert.match(incident.description, /`0123456789ab`/);
});

test("exchangeClientCredentials requests an app actor token", async () => {
  const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "app-token",
        token_type: "Bearer",
        expires_in: 2_591_999,
        scope: "read write",
      }),
    };
  };

  assert.equal(
    await exchangeClientCredentials("client-id", "client-secret", fetch),
    "app-token",
  );
  assert.equal(calls[0].url, "https://api.linear.app/oauth/token");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(
    calls[0].init.headers.Authorization,
    `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
  );
  assert.equal(
    calls[0].init.headers["Content-Type"],
    "application/x-www-form-urlencoded",
  );
  assert.equal(
    String(calls[0].init.body),
    "grant_type=client_credentials&scope=read%2Cwrite",
  );
});

test("exchangeClientCredentials rejects OAuth errors", async () => {
  const fetch: FetchLike = async () => ({
    ok: false,
    status: 401,
    json: async () => ({
      error: "invalid_client",
      error_description: "Bad credentials",
    }),
  });

  await assert.rejects(
    exchangeClientCredentials("bad", "secret", fetch),
    /invalid_client.*Bad credentials/,
  );
});

test("createLinearRequest authenticates GraphQL requests with the app bearer token", async () => {
  const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { viewer: { id: "app" } } }),
    };
  };

  const request = createLinearRequest("app-token", fetch);
  assert.deepEqual(await request("query Viewer { viewer { id } }", {}), {
    viewer: { id: "app" },
  });
  assert.equal(calls[0].init.headers.Authorization, "Bearer app-token");
});

test("publishLinearIncidents creates only non-fixable incidents", async () => {
  const operations: Array<{
    query: string;
    variables: Record<string, unknown>;
  }> = [];
  const request: GraphqlRequest = async (query, variables) => {
    operations.push({ query, variables });
    if (query.includes("ResolveTeam")) {
      return { teams: { nodes: [{ id: "team-1", key: "ENG" }] } };
    }
    if (query.includes("FindIncident")) {
      return { issues: { nodes: [] } };
    }
    if (query.includes("CreateIncident")) {
      return {
        issueCreate: {
          success: true,
          issue: {
            identifier: "ENG-42",
            url: "https://linear.app/acme/issue/ENG-42",
          },
        },
      };
    }
    throw new Error("unexpected operation");
  };

  const result = await publishLinearIncidents(verdict, "ENG", request);

  assert.deepEqual(result, { created: 1, updated: 0, skipped: 1 });
  assert.equal(
    operations.filter(({ query }) => query.includes("CreateIncident")).length,
    1,
  );
});

test("publishLinearIncidents updates an existing open incident", async () => {
  const operations: Array<{
    query: string;
    variables: Record<string, unknown>;
  }> = [];
  const request: GraphqlRequest = async (query, variables) => {
    operations.push({ query, variables });
    if (query.includes("ResolveTeam")) {
      return { teams: { nodes: [{ id: "team-1", key: "ENG" }] } };
    }
    if (query.includes("FindIncident")) {
      return {
        issues: {
          nodes: [
            {
              id: "issue-1",
              identifier: "ENG-7",
              url: "https://linear.app/acme/issue/ENG-7",
            },
          ],
        },
      };
    }
    if (query.includes("UpdateIncident")) {
      return {
        issueUpdate: {
          success: true,
          issue: {
            identifier: "ENG-7",
            url: "https://linear.app/acme/issue/ENG-7",
          },
        },
      };
    }
    throw new Error("unexpected operation");
  };

  const result = await publishLinearIncidents(verdict, "ENG", request);

  assert.deepEqual(result, { created: 0, updated: 1, skipped: 1 });
  const update = operations.find(({ query }) =>
    query.includes("UpdateIncident"),
  );
  assert.equal(update?.variables.issueId, "issue-1");
});

test("publishLinearIncidents rejects an unknown or ambiguous team key", async () => {
  const request: GraphqlRequest = async () => ({ teams: { nodes: [] } });

  await assert.rejects(
    publishLinearIncidents(verdict, "MISSING", request),
    /exactly one Linear team/,
  );
});
