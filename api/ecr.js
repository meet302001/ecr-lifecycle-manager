const {
  ECRClient,
  DescribeRepositoriesCommand,
  StartLifecyclePolicyPreviewCommand,
  GetLifecyclePolicyPreviewCommand,
  PutLifecyclePolicyCommand,
  GetLifecyclePolicyCommand,
} = require("@aws-sdk/client-ecr");

function makeClient({ accessKeyId, secretAccessKey, region }) {
  return new ECRClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function send(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  const action = req.query?.action;

  try {
    const body = await parseBody(req);

    if (action === "connect") {
      const { accessKeyId, secretAccessKey, region } = body;
      if (!accessKeyId || !secretAccessKey || !region)
        return send(res, 400, { error: "Missing credentials" });

      const client = makeClient({ accessKeyId, secretAccessKey, region });
      const repos = [];
      let nextToken;
      do {
        const data = await client.send(new DescribeRepositoriesCommand({ nextToken }));
        repos.push(...data.repositories.map((r) => r.repositoryName));
        nextToken = data.nextToken;
      } while (nextToken);
      return send(res, 200, { repos });
    }

    if (action === "dry-run-start") {
      const { credentials, repos, policy } = body;
      const client = makeClient(credentials);
      const policyText = JSON.stringify(policy);
      const results = await Promise.allSettled(
        repos.map((repo) =>
          client.send(new StartLifecyclePolicyPreviewCommand({ repositoryName: repo, lifecyclePolicyText: policyText }))
        )
      );
      const started = [], failed = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") started.push(repos[i]);
        else failed.push({ repo: repos[i], error: r.reason.message });
      });
      return send(res, 200, { started, failed });
    }

    if (action === "dry-run-results") {
      const { credentials, repos } = body;
      const client = makeClient(credentials);
      const results = await Promise.allSettled(
        repos.map((repo) => client.send(new GetLifecyclePolicyPreviewCommand({ repositoryName: repo })))
      );
      const output = results.map((r, i) => {
        if (r.status === "rejected") return { repo: repos[i], status: "FAILED", error: r.reason.message, images: [] };
        return {
          repo: repos[i],
          status: r.value.status,
          summary: r.value.summary,
          images: (r.value.previewResults || [])
            .filter((img) => img.action?.type === "EXPIRE")
            .map((img) => ({ tags: img.imageTags, digest: img.imageDigest, pushedAt: img.imagePushedAt })),
        };
      });
      return send(res, 200, { results: output });
    }

    if (action === "apply") {
      const { credentials, repos, policy } = body;
      const client = makeClient(credentials);
      const policyText = JSON.stringify(policy);
      const results = await Promise.allSettled(
        repos.map((repo) =>
          client.send(new PutLifecyclePolicyCommand({ repositoryName: repo, lifecyclePolicyText: policyText }))
        )
      );
      const output = results.map((r, i) => ({
        repo: repos[i],
        status: r.status === "fulfilled" ? "success" : "failed",
        error: r.status === "rejected" ? r.reason.message : undefined,
      }));
      return send(res, 200, { results: output });
    }

    if (action === "verify") {
      const { credentials, repos } = body;
      const client = makeClient(credentials);
      const results = await Promise.allSettled(
        repos.map((repo) => client.send(new GetLifecyclePolicyCommand({ repositoryName: repo })))
      );
      const output = results.map((r, i) => ({ repo: repos[i], hasPolicy: r.status === "fulfilled" }));
      return send(res, 200, { results: output });
    }

    return send(res, 400, { error: `Unknown action: ${action}` });
  } catch (err) {
    return send(res, 500, { error: err.message });
  }
};
