const jwt = require("jsonwebtoken");
const {
  ECRClient,
  DescribeRepositoriesCommand,
  StartLifecyclePolicyPreviewCommand,
  GetLifecyclePolicyPreviewCommand,
  PutLifecyclePolicyCommand,
  GetLifecyclePolicyCommand,
} = require("@aws-sdk/client-ecr");

const SECRET = process.env.SESSION_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:5173";

// In-memory dry-run gate (per cold-start instance)
const dryRunCompleted = new Set();

function makeClient({ accessKeyId, secretAccessKey, region }) {
  return new ECRClient({ region, credentials: { accessKeyId, secretAccessKey } });
}

function send(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

function sanitizeError(err) {
  if (err.name === "InvalidSignatureException" || err.name === "InvalidClientTokenId")
    return "Invalid credentials. Check your Access Key ID and Secret.";
  if (err.name === "ExpiredTokenException")
    return "Credentials have expired. Please reconnect.";
  if (err.name === "AccessDeniedException" || err.Code === "AccessDenied")
    return "Access denied. Ensure the IAM user has the required ECR permissions.";
  if (err.name === "RepositoryNotFoundException")
    return "One or more repositories were not found in the specified region.";
  return "AWS API error. Check your credentials, region, and IAM permissions.";
}

function getSession(req, res) {
  if (!SECRET) { send(res, 500, { error: "Server misconfiguration: SESSION_SECRET not set." }); return null; }
  const auth = req.headers?.authorization;
  if (!auth?.startsWith("Bearer ")) { send(res, 401, { error: "Missing authorization token. Please reconnect." }); return null; }
  try {
    return jwt.verify(auth.slice(7), SECRET);
  } catch {
    send(res, 401, { error: "Session expired. Please reconnect." });
    return null;
  }
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") { res.statusCode = 200; return res.end(); }
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  if (!SECRET) return send(res, 500, { error: "Server misconfiguration: SESSION_SECRET not set." });

  const action = req.query?.action;

  try {
    const body = await parseBody(req);

    if (action === "connect") {
      const { accessKeyId, secretAccessKey, region } = body;
      if (!accessKeyId || !secretAccessKey || !region)
        return send(res, 400, { error: "Missing credentials" });

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
        return send(res, 200, { token, repos });
      } catch (err) {
        return send(res, 401, { error: sanitizeError(err) });
      }
    }

    if (action === "dry-run-start") {
      const session = getSession(req, res);
      if (!session) return;
      const { repos, policy } = body;
      const client = makeClient(session);
      const policyText = JSON.stringify(policy);
      const results = await Promise.allSettled(
        repos.map((repo) => client.send(new StartLifecyclePolicyPreviewCommand({ repositoryName: repo, lifecyclePolicyText: policyText })))
      );
      const started = [], failed = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") started.push(repos[i]);
        else failed.push({ repo: repos[i], error: "Preview could not be started for this repository." });
      });
      return send(res, 200, { started, failed });
    }

    if (action === "dry-run-results") {
      const session = getSession(req, res);
      if (!session) return;
      const { repos } = body;
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
      const tokenId = req.headers.authorization.slice(7);
      if (output.every((r) => r.status === "COMPLETE" || r.status === "FAILED")) dryRunCompleted.add(tokenId);
      return send(res, 200, { results: output });
    }

    if (action === "apply") {
      const session = getSession(req, res);
      if (!session) return;
      const tokenId = req.headers.authorization.slice(7);
      if (!dryRunCompleted.has(tokenId))
        return send(res, 403, { error: "A dry run must be completed before applying policies." });
      const { repos, policy } = body;
      const client = makeClient(session);
      const policyText = JSON.stringify(policy);
      const results = await Promise.allSettled(
        repos.map((repo) => client.send(new PutLifecyclePolicyCommand({ repositoryName: repo, lifecyclePolicyText: policyText })))
      );
      const output = results.map((r, i) => ({
        repo: repos[i],
        status: r.status === "fulfilled" ? "success" : "failed",
        error: r.status === "rejected" ? sanitizeError(r.reason) : undefined,
      }));
      return send(res, 200, { results: output });
    }

    if (action === "verify") {
      const session = getSession(req, res);
      if (!session) return;
      const { repos } = body;
      const client = makeClient(session);
      const results = await Promise.allSettled(
        repos.map((repo) => client.send(new GetLifecyclePolicyCommand({ repositoryName: repo })))
      );
      return send(res, 200, { results: results.map((r, i) => ({ repo: repos[i], hasPolicy: r.status === "fulfilled" })) });
    }

    return send(res, 400, { error: "Unknown action" });
  } catch (err) {
    return send(res, 500, { error: "An unexpected server error occurred." });
  }
};
