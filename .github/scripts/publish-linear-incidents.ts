import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

type Failure = {
  test: string;
  classification: string;
  fixable: boolean;
  confidence: string;
  target_file: string;
  fix_summary: string;
  dedup_key: string;
};

export type Verdict = {
  schema_version: string;
  repository: string;
  workflow: string;
  run_id: string;
  run_url: string;
  commit: string;
  branch: string;
  conclusion: string;
  failures: Failure[];
};

export type GraphqlRequest = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

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

type Incident = {
  marker: string;
  title: string;
  description: string;
};

type PublishResult = {
  created: number;
  updated: number;
  skipped: number;
};

const graphqlEndpoint = "https://api.linear.app/graphql";
const tokenEndpoint = "https://api.linear.app/oauth/token";

function inlineCode(value: string): string {
  return value.replaceAll("`", "'");
}

function markdownText(value: string): string {
  return value.replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function dedupKey(verdict: Verdict, failure: Failure): string {
  if (failure.dedup_key) return failure.dedup_key;

  return [
    "v1",
    verdict.repository,
    verdict.workflow,
    failure.test || failure.target_file,
    failure.classification || "unknown",
  ]
    .map(encodeURIComponent)
    .join(":");
}

export function buildIncident(verdict: Verdict, failure: Failure): Incident {
  const key = dedupKey(verdict, failure);
  const marker = `<!-- shiplight-ci-triage-dedup:${key} -->`;
  const classification = failure.classification.replaceAll("_", " ");
  const rawTitle = `[CI][${classification}] ${failure.test}`;
  const title =
    rawTitle.length > 240 ? `${rawTitle.slice(0, 237)}...` : rawTitle;
  const commit = inlineCode(verdict.commit.slice(0, 12));
  const repositoryUrl = `https://github.com/${encodeURI(verdict.repository)}`;

  const description = [
    marker,
    "Automated incident from Shiplight CI failure triage.",
    "",
    `- **Test:** \`${inlineCode(failure.test)}\``,
    `- **Classification:** ${markdownText(classification)}`,
    `- **Confidence:** ${markdownText(failure.confidence)}`,
    `- **Workflow:** ${markdownText(verdict.workflow)}`,
    `- **Branch:** \`${inlineCode(verdict.branch)}\``,
    `- **Commit:** [\`${commit}\`](${repositoryUrl}/commit/${encodeURIComponent(verdict.commit)})`,
    `- **Latest failure:** [Failed GitHub Actions run](${verdict.run_url})`,
    "",
    "### Triage finding",
    "",
    failure.fix_summary || "The triage agent did not provide a summary.",
    "",
    `_Integration key: \`${inlineCode(key)}\`_`,
  ].join("\n");

  return { marker, title, description };
}

function getNodes(
  data: Record<string, unknown>,
  connectionName: string,
): Array<Record<string, unknown>> {
  const connection = data[connectionName];
  if (typeof connection !== "object" || connection === null) return [];
  const nodes = (connection as Record<string, unknown>).nodes;
  return Array.isArray(nodes)
    ? nodes.filter(
        (node): node is Record<string, unknown> =>
          typeof node === "object" && node !== null,
      )
    : [];
}

function mutationSucceeded(
  data: Record<string, unknown>,
  name: string,
): boolean {
  const payload = data[name];
  return (
    typeof payload === "object" &&
    payload !== null &&
    (payload as Record<string, unknown>).success === true
  );
}

export async function publishLinearIncidents(
  verdict: Verdict,
  teamKey: string,
  request: GraphqlRequest,
): Promise<PublishResult> {
  const teamData = await request(
    `query ResolveTeam($teamKey: String!) {
      teams(first: 2, filter: { key: { eqIgnoreCase: $teamKey } }) {
        nodes { id key }
      }
    }`,
    { teamKey },
  );
  const teams = getNodes(teamData, "teams");
  if (teams.length !== 1 || typeof teams[0].id !== "string") {
    throw new Error(
      `Expected exactly one Linear team for key "${teamKey}", found ${teams.length}.`,
    );
  }
  const teamId = teams[0].id;
  const result: PublishResult = { created: 0, updated: 0, skipped: 0 };

  for (const failure of verdict.failures) {
    if (failure.fixable) {
      result.skipped += 1;
      continue;
    }

    const incident = buildIncident(verdict, failure);
    const existingData = await request(
      `query FindIncident($teamId: ID!, $marker: String!) {
        issues(
          first: 2
          filter: {
            team: { id: { eq: $teamId } }
            description: { contains: $marker }
            state: { type: { nin: ["completed", "canceled"] } }
          }
        ) {
          nodes { id identifier url }
        }
      }`,
      { teamId, marker: incident.marker },
    );
    const existing = getNodes(existingData, "issues");

    if (existing.length > 1) {
      throw new Error(
        `Found multiple open Linear incidents for ${failure.dedup_key}.`,
      );
    }

    if (existing.length === 1) {
      const issueId = existing[0].id;
      if (typeof issueId !== "string")
        throw new Error("Linear returned an incident without an id.");
      const updated = await request(
        `mutation UpdateIncident($issueId: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $issueId, input: $input) {
            success
            issue { identifier url }
          }
        }`,
        {
          issueId,
          input: { title: incident.title, description: incident.description },
        },
      );
      if (!mutationSucceeded(updated, "issueUpdate")) {
        throw new Error(
          `Linear did not update the incident for ${failure.test}.`,
        );
      }
      result.updated += 1;
      console.log(`Updated Linear incident for ${failure.test}.`);
      continue;
    }

    const created = await request(
      `mutation CreateIncident($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { identifier url }
        }
      }`,
      {
        input: {
          teamId,
          title: incident.title,
          description: incident.description,
        },
      },
    );
    if (!mutationSucceeded(created, "issueCreate")) {
      throw new Error(
        `Linear did not create the incident for ${failure.test}.`,
      );
    }
    result.created += 1;
    console.log(`Created Linear incident for ${failure.test}.`);
  }

  return result;
}

function objectPayload(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${context} returned an invalid response.`);
  }
  return value as Record<string, unknown>;
}

export async function exchangeClientCredentials(
  clientId: string,
  clientSecret: string,
  fetchRequest: FetchLike,
): Promise<string> {
  const response = await fetchRequest(tokenEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "read,write",
    }).toString(),
  });
  const payload = objectPayload(await response.json(), "Linear OAuth");
  if (!response.ok || typeof payload.access_token !== "string") {
    const code = String(payload.error ?? `HTTP ${response.status}`);
    const description = String(
      payload.error_description ?? "no error description",
    );
    throw new Error(
      `Linear OAuth token exchange failed: ${code}: ${description}`,
    );
  }
  return payload.access_token;
}

export function createLinearRequest(
  accessToken: string,
  fetchRequest: FetchLike,
): GraphqlRequest {
  return async (query, variables) => {
    const response = await fetchRequest(graphqlEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const payload = objectPayload(await response.json(), "Linear GraphQL");
    if (!response.ok || Array.isArray(payload.errors)) {
      throw new Error(
        `Linear GraphQL request failed: ${JSON.stringify(payload.errors ?? payload)}`,
      );
    }
    const data = payload.data;
    if (typeof data !== "object" || data === null) {
      throw new Error("Linear GraphQL response contained no data.");
    }
    return data as Record<string, unknown>;
  };
}

async function main(): Promise<void> {
  const verdictPath = process.argv[2];
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  const teamKey = process.env.LINEAR_TEAM_KEY;
  if (!verdictPath)
    throw new Error("Usage: publish-linear-incidents.ts <verdict.json>");
  if (!clientId) throw new Error("LINEAR_CLIENT_ID is required.");
  if (!clientSecret) throw new Error("LINEAR_CLIENT_SECRET is required.");
  if (!teamKey) throw new Error("LINEAR_TEAM_KEY is required.");

  const parsed: unknown = JSON.parse(await readFile(verdictPath, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as Record<string, unknown>).failures)
  ) {
    throw new Error(`${verdictPath} is not a valid ci-triage verdict.`);
  }

  const fetchRequest: FetchLike = async (url, init) => fetch(url, init);
  const accessToken = await exchangeClientCredentials(
    clientId,
    clientSecret,
    fetchRequest,
  );
  const result = await publishLinearIncidents(
    parsed as Verdict,
    teamKey,
    createLinearRequest(accessToken, fetchRequest),
  );
  console.log(
    `Linear publishing complete: ${result.created} created, ${result.updated} updated, ${result.skipped} fixable skipped.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
