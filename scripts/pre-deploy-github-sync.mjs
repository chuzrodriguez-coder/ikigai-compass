#!/usr/bin/env node
/**
 * pre-deploy-github-sync.mjs
 *
 * Mandatory pre-deployment gate: pushes all git-tracked source files to GitHub
 * before any artifact is built. Only uploads files whose content has changed
 * since the last sync, keeping GitHub API usage well within rate limits.
 * Exits non-zero on failure, which blocks the deploy.
 *
 * Requirements:
 *   - GITHUB_PERSONAL_ACCESS_TOKEN env var: a GitHub PAT with `repo` scope.
 *   - git remote "origin" pointing at the GitHub repository.
 *
 * No external npm dependencies — uses only Node.js built-ins and global fetch.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// 1. Validate prerequisites
// ---------------------------------------------------------------------------

const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("[pre-deploy] ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set.");
  console.error("[pre-deploy] Add a GitHub Personal Access Token (classic, repo scope) as the GITHUB_PERSONAL_ACCESS_TOKEN secret.");
  process.exit(1);
}

let owner, repoName;
try {
  const remoteUrl = execSync("git remote get-url origin", { encoding: "utf8" }).trim();
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) throw new Error(`Unrecognised remote URL format: ${remoteUrl}`);
  [, owner, repoName] = match;
} catch (e) {
  console.error(`[pre-deploy] ERROR: Could not determine GitHub repo from 'origin' remote: ${e.message}`);
  process.exit(1);
}

console.log(`[pre-deploy] Syncing to GitHub: ${owner}/${repoName}`);

// ---------------------------------------------------------------------------
// 2. GitHub API helpers
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";
const HEADERS = {
  Authorization: `token ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
  "User-Agent": "ikigai-compass-deploy-sync/1.0",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gh(method, path, body, { allow404 = false, retries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers: HEADERS,
      body: body != null ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return null;
    if (res.status === 404 && allow404) return null;

    const data = await res.json();

    if (res.status === 403 || res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(60000 * attempt, 180000);
      console.log(`[pre-deploy]   Rate limited (${res.status}). Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/${retries}...`);
      await sleep(waitMs);
      lastErr = new Error(`GitHub API ${method} ${path} -> ${res.status}: ${data.message ?? "rate limited"}`);
      continue;
    }

    if (!res.ok) {
      throw new Error(
        `GitHub API ${method} ${path} -> ${res.status}: ${data.message ?? JSON.stringify(data).slice(0, 200)}`
      );
    }
    return data;
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// 3. Resolve current GitHub state
// ---------------------------------------------------------------------------

let currentCommitSha = null;
let currentTreeSha = null;
const remoteBlobs = {}; // path -> sha (from current GitHub tree)

try {
  const ref = await gh("GET", `/repos/${owner}/${repoName}/git/refs/heads/main`, null, { allow404: true });
  if (ref) {
    currentCommitSha = ref.object.sha;
    const commit = await gh("GET", `/repos/${owner}/${repoName}/git/commits/${currentCommitSha}`);
    currentTreeSha = commit.tree.sha;
    console.log(`[pre-deploy] Current GitHub main: ${currentCommitSha.slice(0, 8)}`);

    // Walk the full recursive tree to know current blob SHAs
    const tree = await gh("GET", `/repos/${owner}/${repoName}/git/trees/${currentTreeSha}?recursive=1`);
    for (const item of tree.tree) {
      if (item.type === "blob") remoteBlobs[item.path] = item.sha;
    }
    console.log(`[pre-deploy] Remote tree has ${Object.keys(remoteBlobs).length} blobs.`);
  } else {
    console.log("[pre-deploy] No existing main branch — initialising repository.");
  }
} catch (e) {
  console.error(`[pre-deploy] ERROR fetching current GitHub state: ${e.message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 4. Collect tracked files and compute local git blob SHAs
// ---------------------------------------------------------------------------

/**
 * Compute the git object SHA for a blob (same algorithm git uses):
 *   SHA1("blob {byteLength}\0{content}")
 */
function gitBlobSha(buf) {
  const header = Buffer.from(`blob ${buf.byteLength}\0`);
  return createHash("sha1").update(header).update(buf).digest("hex");
}

let files;
try {
  files = execSync("git ls-files", { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((f) => f.length > 0 && !f.startsWith("artifacts/mockup-sandbox"));
} catch (e) {
  console.error(`[pre-deploy] ERROR listing git-tracked files: ${e.message}`);
  process.exit(1);
}

console.log(`[pre-deploy] Checking ${files.length} tracked files for changes...`);

const cwd = process.cwd();
const changedFiles = [];
const unchangedBlobMap = {}; // path -> sha (re-use existing blob SHAs)

for (const file of files) {
  let buf;
  try {
    buf = readFileSync(join(cwd, file));
  } catch (e) {
    console.error(`[pre-deploy] ERROR reading ${file}: ${e.message}`);
    process.exit(1);
  }

  const localSha = gitBlobSha(buf);
  if (remoteBlobs[file] && remoteBlobs[file] === localSha) {
    unchangedBlobMap[file] = localSha;
  } else {
    changedFiles.push({ file, buf });
  }
}

console.log(`[pre-deploy] ${changedFiles.length} files changed, ${Object.keys(unchangedBlobMap).length} unchanged.`);

if (changedFiles.length === 0 && Object.keys(remoteBlobs).length > 0) {
  console.log("[pre-deploy] Nothing to sync — GitHub is already up to date.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 5. Upload only the changed blobs (with throttle + retry)
// ---------------------------------------------------------------------------

const blobMap = { ...unchangedBlobMap };
let blobsDone = 0;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

for (let i = 0; i < changedFiles.length; i++) {
  const { file, buf } = changedFiles[i];
  const isBinary = buf.slice(0, 8000).includes(0);
  const encoding = isBinary ? "base64" : "utf-8";
  const content = isBinary ? buf.toString("base64") : buf.toString("utf8");

  try {
    const blob = await gh("POST", `/repos/${owner}/${repoName}/git/blobs`, { content, encoding }, { retries: 5 });
    blobMap[file] = blob.sha;
  } catch (e) {
    console.error(`[pre-deploy] ERROR creating blob for ${file}: ${e.message}`);
    process.exit(1);
  }

  blobsDone++;
  if (blobsDone % 10 === 0) {
    console.log(`[pre-deploy]   ${blobsDone}/${changedFiles.length} blobs uploaded...`);
  }

  // Pause between batches to avoid secondary rate limits
  if (blobsDone % BATCH_SIZE === 0 && blobsDone < changedFiles.length) {
    await sleep(BATCH_DELAY_MS);
  } else {
    await sleep(200);
  }
}

console.log(`[pre-deploy] ${changedFiles.length} blobs uploaded.`);

// ---------------------------------------------------------------------------
// 6. Create tree, commit, update ref
// ---------------------------------------------------------------------------

const treeEntries = Object.entries(blobMap).map(([path, sha]) => ({
  path,
  mode: "100644",
  type: "blob",
  sha,
}));

const treeBody = { tree: treeEntries };
if (currentTreeSha) treeBody.base_tree = currentTreeSha;

let tree;
try {
  tree = await gh("POST", `/repos/${owner}/${repoName}/git/trees`, treeBody);
} catch (e) {
  console.error(`[pre-deploy] ERROR creating tree: ${e.message}`);
  process.exit(1);
}
console.log(`[pre-deploy] Tree: ${tree.sha.slice(0, 8)}`);

const now = new Date().toISOString();
const commitBody = {
  message: `Deploy sync ${now}`,
  tree: tree.sha,
  author: { name: "Replit Deploy Sync", email: "noreply@replit.com", date: now },
};
if (currentCommitSha) commitBody.parents = [currentCommitSha];

let commit;
try {
  commit = await gh("POST", `/repos/${owner}/${repoName}/git/commits`, commitBody);
} catch (e) {
  console.error(`[pre-deploy] ERROR creating commit: ${e.message}`);
  process.exit(1);
}
console.log(`[pre-deploy] Commit: ${commit.sha.slice(0, 8)}`);

try {
  if (currentCommitSha) {
    await gh("PATCH", `/repos/${owner}/${repoName}/git/refs/heads/main`, {
      sha: commit.sha,
      force: false,
    });
  } else {
    await gh("POST", `/repos/${owner}/${repoName}/git/refs`, {
      ref: "refs/heads/main",
      sha: commit.sha,
    });
  }
} catch (e) {
  console.error(`[pre-deploy] ERROR updating main branch ref: ${e.message}`);
  process.exit(1);
}

console.log(`[pre-deploy] GitHub sync complete: https://github.com/${owner}/${repoName}/tree/main`);
console.log(`[pre-deploy] Commit SHA: ${commit.sha}`);
