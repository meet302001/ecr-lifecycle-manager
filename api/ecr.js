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

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query.action;

  try {
    if (action === "connect") {
      const { accessKeyId, secretAccessKey, region } = req.body;
      const client = makeClient({ accessKeyId, secretAccessKey, region });
      const repos = [];
      let nextToken;
      do {
        const data = await client.send(new DescribeRepositoriesCommand({ nextToken }));
        repos.push(...data.repositories.map((r) => r.repositoryName));
        nextToken = data.nextToken;
      } while (nextToken);
      return res.json({ repos });
    }

    if (action === "dry-run-start") {
      const { credentials, repos, policy } = req.body;
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
      return res.json({ started, failed });
    }

    if (action === "dry-run-results") {
      const { credentials, repos } = req.body;
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
      return res.json({ results: output });
    }

    if (action === "apply") {
      const { credentials, repos, policy } = req.body;
      const client = makeClient(credentials);
      const policyText = JSON.stringify(policy);
      const results = await Promise.allSettled(
        repos.map((repo) => client.send(new PutLifecyclePolicyCommand({ repositoryName: repo, lifecyclePolicyText: policyText })))
      );
      const output = results.map((r, i) => ({
        repo: repos[i],
        status: r.status === "fulfilled" ? "success" : "failed",
        error: r.status === "rejected" ? r.reason.message : undefined,
      }));
      return res.json({ results: output });
    }

    if (action === "verify") {
      const { credentials, repos } = req.body;
      const client = makeClient(credentials);
      const results = await Promise.allSettled(
        repos.map((repo) => client.send(new GetLifecyclePolicyCommand({ repositoryName: repo })))
      );
      const output = results.map((r, i) => ({ repo: repos[i], hasPolicy: r.status === "fulfilled" }));
      return res.json({ results: output });
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
