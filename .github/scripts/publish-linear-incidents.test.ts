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

test("buildIncident keeps dedup metadata out of the visible description", () => {
  const incident = buildIncident(verdict, verdict.failures[0]);

  assert.equal(
    incident.legacyMarker,
    "<!-- shiplight-ci-triage-dedup:v1:ShiplightAI%2Fexamples:Demo%20Tests:demo%2Flogin.test.yaml:app_regression -->",
  );
  assert.equal(
    incident.dedupUrl,
    "https://github.com/ShiplightAI/examples/actions#shiplight-ci-triage=v1%3AShiplightAI%252Fexamples%3ADemo%2520Tests%3Ademo%252Flogin.test.yaml%3Aapp_regression",
  );
  assert.match(incident.title, /^\[CI\]\[app regression\] /);
  assert.doesNotMatch(
    incident.description,
    /shiplight-ci-triage-dedup|Integration key/,
  );
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
    if (query.includes("FindIncidentAttachment")) {
      return { attachmentsForURL: { nodes: [] } };
    }
    if (query.includes("FindLegacyIncident")) {
      return { issues: { nodes: [] } };
    }
    if (query.includes("CreateIncident")) {
      return {
        issueCreate: {
          success: true,
          issue: {
            id: "issue-42",
            identifier: "ENG-42",
            url: "https://linear.app/acme/issue/ENG-42",
          },
        },
      };
    }
    if (query.includes("UpsertIncidentAttachment")) {
      return {
        attachmentCreate: {
          success: true,
          attachment: { id: "attachment-42" },
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
  const attachment = operations.find(({ query }) =>
    query.includes("UpsertIncidentAttachment"),
  );
  assert.deepEqual(attachment?.variables.input, {
    issueId: "issue-42",
    title: "CI failure: demo/login.test.yaml",
    subtitle: "Demo Tests · app regression",
    url: buildIncident(verdict, verdict.failures[0]).dedupUrl,
    metadata: {
      dedupKey: verdict.failures[0].dedup_key,
      workflow: "Demo Tests",
      test: "demo/login.test.yaml",
      classification: "app_regression",
    },
  });
});

test("publishLinearIncidents updates an open incident found by attachment URL", async () => {
  const operations: Array<{
    query: string;
    variables: Record<string, unknown>;
  }> = [];
  const request: GraphqlRequest = async (query, variables) => {
    operations.push({ query, variables });
    if (query.includes("ResolveTeam")) {
      return { teams: { nodes: [{ id: "team-1", key: "ENG" }] } };
    }
    if (query.includes("FindIncidentAttachment")) {
      return {
        attachmentsForURL: {
          nodes: [
            {
              id: "attachment-1",
              issue: {
                id: "issue-1",
                identifier: "ENG-7",
                url: "https://linear.app/acme/issue/ENG-7",
                state: { type: "started" },
                team: { id: "team-1" },
              },
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
    if (query.includes("UpsertIncidentAttachment")) {
      return {
        attachmentCreate: { success: true, attachment: { id: "attachment-1" } },
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
  assert.equal(
    operations.filter(({ query }) => query.includes("FindLegacyIncident"))
      .length,
    0,
  );
});

test("publishLinearIncidents migrates an open marker-based incident without duplicating it", async () => {
  const operations: Array<{
    query: string;
    variables: Record<string, unknown>;
  }> = [];
  const request: GraphqlRequest = async (query, variables) => {
    operations.push({ query, variables });
    if (query.includes("ResolveTeam")) {
      return { teams: { nodes: [{ id: "team-1", key: "ENG" }] } };
    }
    if (query.includes("FindIncidentAttachment")) {
      return { attachmentsForURL: { nodes: [] } };
    }
    if (query.includes("FindLegacyIncident")) {
      return {
        issues: {
          nodes: [
            {
              id: "legacy-1",
              identifier: "ENG-5",
              url: "https://linear.app/ENG-5",
            },
          ],
        },
      };
    }
    if (query.includes("UpdateIncident")) {
      return { issueUpdate: { success: true, issue: { identifier: "ENG-5" } } };
    }
    if (query.includes("UpsertIncidentAttachment")) {
      return {
        attachmentCreate: { success: true, attachment: { id: "attachment-5" } },
      };
    }
    throw new Error("unexpected operation");
  };

  const result = await publishLinearIncidents(verdict, "ENG", request);

  assert.deepEqual(result, { created: 0, updated: 1, skipped: 1 });
  assert.equal(
    operations.filter(({ query }) => query.includes("CreateIncident")).length,
    0,
  );
  const update = operations.find(({ query }) =>
    query.includes("UpdateIncident"),
  );
  const input = update?.variables.input as { description: string };
  assert.doesNotMatch(
    input.description,
    /shiplight-ci-triage-dedup|Integration key/,
  );
});

test("publishLinearIncidents ignores attachments on completed incidents", async () => {
  const operations: string[] = [];
  const request: GraphqlRequest = async (query) => {
    operations.push(query);
    if (query.includes("ResolveTeam")) {
      return { teams: { nodes: [{ id: "team-1", key: "ENG" }] } };
    }
    if (query.includes("FindIncidentAttachment")) {
      return {
        attachmentsForURL: {
          nodes: [
            {
              id: "attachment-old",
              issue: {
                id: "issue-old",
                state: { type: "completed" },
                team: { id: "team-1" },
              },
            },
          ],
        },
      };
    }
    if (query.includes("FindLegacyIncident")) return { issues: { nodes: [] } };
    if (query.includes("CreateIncident")) {
      return { issueCreate: { success: true, issue: { id: "issue-new" } } };
    }
    if (query.includes("UpsertIncidentAttachment")) {
      return {
        attachmentCreate: {
          success: true,
          attachment: { id: "attachment-new" },
        },
      };
    }
    throw new Error("unexpected operation");
  };

  assert.deepEqual(await publishLinearIncidents(verdict, "ENG", request), {
    created: 1,
    updated: 0,
    skipped: 1,
  });
  assert.equal(
    operations.filter((query) => query.includes("CreateIncident")).length,
    1,
  );
});

test("publishLinearIncidents rejects an unknown or ambiguous team key", async () => {
  const request: GraphqlRequest = async () => ({ teams: { nodes: [] } });

  await assert.rejects(
    publishLinearIncidents(verdict, "MISSING", request),
    /exactly one Linear team/,
  );
});
