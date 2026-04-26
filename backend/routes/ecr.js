const express = require("express");
const {
  ECRClient,
  DescribeRepositoriesCommand,
  StartLifecyclePolicyPreviewCommand,
  GetLifecyclePolicyPreviewCommand,
  PutLifecyclePolicyCommand,
  GetLifecyclePolicyCommand,
} = require("@aws-sdk/client-ecr");

const router = express.Router();

function makeClient(credentials) {
  return new ECRClient({
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

// Validate credentials + list repos
router.post("/connect", async (req, res) => {
  const { accessKeyId, secretAccessKey, region } = req.body;
  if (!accessKeyId || !secretAccessKey || !region)
    return res.status(400).json({ error: "Missing credentials" });

  const client = makeClient({ accessKeyId, secretAccessKey, region });
  try {
    const repos = [];
    let nextToken;
    do {
      const cmd = new DescribeRepositoriesCommand({ nextToken });
      const data = await client.send(cmd);
      repos.push(...data.repositories.map((r) => r.repositoryName));
      nextToken = data.nextToken;
    } while (nextToken);

    res.json({ repos });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Start dry run preview for a list of repos
router.post("/dry-run/start", async (req, res) => {
  const { credentials, repos, policy } = req.body;
  const client = makeClient(credentials);
  const policyText = JSON.stringify(policy);

  const results = await Promise.allSettled(
    repos.map((repo) =>
      client.send(
        new StartLifecyclePolicyPreviewCommand({
          repositoryName: repo,
          lifecyclePolicyText: policyText,
        })
      )
    )
  );

  const started = [];
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") started.push(repos[i]);
    else failed.push({ repo: repos[i], error: r.reason.message });
  });

  res.json({ started, failed });
});

// Poll dry run results for a list of repos
router.post("/dry-run/results", async (req, res) => {
  const { credentials, repos } = req.body;
  const client = makeClient(credentials);

  const results = await Promise.allSettled(
    repos.map((repo) =>
      client.send(new GetLifecyclePolicyPreviewCommand({ repositoryName: repo }))
    )
  );

  const output = results.map((r, i) => {
    if (r.status === "rejected")
      return { repo: repos[i], status: "FAILED", error: r.reason.message, images: [] };

    const data = r.value;
    return {
      repo: repos[i],
      status: data.status,
      summary: data.summary,
      images: (data.previewResults || [])
        .filter((img) => img.action?.type === "EXPIRE")
        .map((img) => ({
          tags: img.imageTags,
          digest: img.imageDigest,
          pushedAt: img.imagePushedAt,
        })),
    };
  });

  res.json({ results: output });
});

// Apply policy to selected repos
router.post("/apply", async (req, res) => {
  const { credentials, repos, policy } = req.body;
  const client = makeClient(credentials);
  const policyText = JSON.stringify(policy);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  for (const repo of repos) {
    try {
      await client.send(
        new PutLifecyclePolicyCommand({
          repositoryName: repo,
          lifecyclePolicyText: policyText,
        })
      );
      res.write(`data: ${JSON.stringify({ repo, status: "success" })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ repo, status: "failed", error: err.message })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// Check which repos already have a policy
router.post("/verify", async (req, res) => {
  const { credentials, repos } = req.body;
  const client = makeClient(credentials);

  const results = await Promise.allSettled(
    repos.map((repo) =>
      client.send(new GetLifecyclePolicyCommand({ repositoryName: repo }))
    )
  );

  const output = results.map((r, i) => ({
    repo: repos[i],
    hasPolicy: r.status === "fulfilled",
  }));

  res.json({ results: output });
});

module.exports = router;
