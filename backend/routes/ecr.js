const express = require("express");
const jwt = require("jsonwebtoken");
const {
  ECRClient,
  DescribeRepositoriesCommand,
  StartLifecyclePolicyPreviewCommand,
  GetLifecyclePolicyPreviewCommand,
  PutLifecyclePolicyCommand,
  GetLifecyclePolicyCommand,
} = require("@aws-sdk/client-ecr");

const router = express.Router();
const SECRET = process.env.SESSION_SECRET;
if (!SECRET) throw new Error("SESSION_SECRET environment variable is required");

// Tracks which sessions have completed a dry run (in-memory, single instance)
const dryRunCompleted = new Set();

function makeClient({ accessKeyId, secretAccessKey, region }) {
  return new ECRClient({ region, credentials: { accessKeyId, secretAccessKey } });
}

function getSession(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token. Please reconnect." });
    return null;
  }
  try {
    return jwt.verify(auth.slice(7), SECRET);
  } catch {
    res.status(401).json({ error: "Session expired. Please reconnect." });
    return null;
  }
}

function sanitizeError(err) {
  // Strip ARNs, account IDs, and resource names from AWS SDK errors
  const msg = err.message || "An unexpected error occurred";
  if (err.name === "InvalidSignatureException" || err.name === "InvalidClientTokenId") {
    return "Invalid credentials. Check your Access Key ID and Secret.";
  }
  if (err.name === "ExpiredTokenException") {
    return "Credentials have expired. Please reconnect.";
  }
  if (err.name === "AccessDeniedException" || err.Code === "AccessDenied") {
    return "Access denied. Ensure the IAM user has the required ECR permissions.";
  }
  if (err.name === "RepositoryNotFoundException") {
    return "One or more repositories were not found in the specified region.";
  }
  // Generic fallback — don't expose raw AWS message
  return "AWS API error. Check your credentials, region, and IAM permissions.";
}

// Connect: validate credentials, issue session token
router.post("/connect", async (req, res) => {
  const { accessKeyId, secretAccessKey, region } = req.body;
  if (!accessKeyId || !secretAccessKey || !region)
    return res.status(400).json({ error: "Missing credentials" });

  const client = makeClient({ accessKeyId, secretAccessKey, region });
  try {
    const repos = [];
    let nextToken;
    do {
      const data = await client.send(new DescribeRepositoriesCommand({ nextToken }));
      repos.push(...data.repositories.map((r) => r.repositoryName));
      nextToken = data.nextToken;
    } while (nextToken);

    const token = jwt.sign({ accessKeyId, secretAccessKey, region }, SECRET, { expiresIn: "2h" });
    res.json({ token, repos });
  } catch (err) {
    res.status(401).json({ error: sanitizeError(err) });
  }
});

// Start dry-run preview
router.post("/dry-run/start", async (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { repos, policy } = req.body;
  const client = makeClient(session);
  const policyText = JSON.stringify(policy);

  const results = await Promise.allSettled(
    repos.map((repo) =>
      client.send(new StartLifecyclePolicyPreviewCommand({ repositoryName: repo, lifecyclePolicyText: policyText }))
    )
  );

  const started = [], failed = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") started.push(repos[i]);
    else failed.push({ repo: repos[i], error: "Preview could not be started for this repository." });
  });

  res.json({ started, failed });
});

// Poll dry-run results
router.post("/dry-run/results", async (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { repos } = req.body;
  const client = makeClient(session);

  const results = await Promise.allSettled(
    repos.map((repo) => client.send(new GetLifecyclePolicyPreviewCommand({ repositoryName: repo })))
  );

  const output = results.map((r, i) => {
    if (r.status === "rejected")
      return { repo: repos[i], status: "FAILED", error: "Preview failed for this repository.", images: [] };
    return {
      repo: repos[i],
      status: r.value.status,
      summary: r.value.summary,
      images: (r.value.previewResults || [])
        .filter((img) => img.action?.type === "EXPIRE")
        .map((img) => ({ tags: img.imageTags, digest: img.imageDigest, pushedAt: img.imagePushedAt })),
    };
  });

  // Mark dry-run complete for this session
  const tokenId = req.headers.authorization.slice(7);
  const allDone = output.every((r) => r.status === "COMPLETE" || r.status === "FAILED");
  if (allDone) dryRunCompleted.add(tokenId);

  res.json({ results: output });
});

// Apply lifecycle policies
router.post("/apply", async (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  // Enforce server-side dry-run gate
  const tokenId = req.headers.authorization.slice(7);
  if (!dryRunCompleted.has(tokenId)) {
    return res.status(403).json({ error: "A dry run must be completed before applying policies." });
  }

  const { repos, policy } = req.body;
  const client = makeClient(session);
  const policyText = JSON.stringify(policy);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  for (const repo of repos) {
    try {
      await client.send(new PutLifecyclePolicyCommand({ repositoryName: repo, lifecyclePolicyText: policyText }));
      res.write(`data: ${JSON.stringify({ repo, status: "success" })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ repo, status: "failed", error: sanitizeError(err) })}\n\n`);
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// Verify repos have a policy
router.post("/verify", async (req, res) => {
  const session = getSession(req, res);
  if (!session) return;

  const { repos } = req.body;
  const client = makeClient(session);

  const results = await Promise.allSettled(
    repos.map((repo) => client.send(new GetLifecyclePolicyCommand({ repositoryName: repo })))
  );

  const output = results.map((r, i) => ({ repo: repos[i], hasPolicy: r.status === "fulfilled" }));
  res.json({ results: output });
});

module.exports = router;
