#!/usr/bin/env node
/**
 * pre-deploy-github-sync.mjs
 *
 * Mandatory pre-deployment gate: pushes all git changes to GitHub before any
 * artifact is built. Sends only the delta (changed/added/deleted files) rather
 * than a full mirror, keeping API usage minimal.
 * Exits non-zero on failure, which blocks the deploy.
 *
 * Requirements:
 *   - GITHUB_PERSONAL_ACCESS_TOKEN (or GITHUB_TOKEN) env var: a GitHub PAT
 *     with `repo` scope.
 *   - git remote "origin" pointing at the GitHub repository.
 *
 * No external npm dependencies — uses only Node.js built-ins and global fetch.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// 1. Validate prerequisites
// ---------------------------------------------------------------------------

// Accept either secret name; GITHUB_PERSONAL_ACCESS_TOKEN takes precedence.
const TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("[pre-deploy] ERROR: No GitHub token found.");
  console.error("[pre-deploy] Set GITHUB_TOKEN (or GITHUB_PERSONAL_ACCESS_TOKEN) to a GitHub PAT with 'repo' scope.");
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

console.log(`[pre-deploy] Syncing changes to GitHub: ${owner}/${repoName}`);

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

    // Walk the full recursive tree to know current blob SHAs for diffing
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
// 4. Compute delta: changed/added/deleted files only
//
// Uses `git ls-files --stage` to get the git object SHA and file mode for
// every tracked file in one command — no per-file hashing needed.
// Output format per line: "<mode> <sha1> <stage>\t<path>"
// ---------------------------------------------------------------------------

let localIndex; // Array of { mode, sha, file, filePath }
try {
  const cwd = process.cwd();
  localIndex = execSync("git ls-files --stage", { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((line) => {
      const tabIdx = line.indexOf("\t");
      const meta = line.slice(0, tabIdx).split(" ");
      const file = line.slice(tabIdx + 1);
      return { mode: meta[0], sha: meta[1], file, filePath: `${cwd}/${file}` };
    });
} catch (e) {
  console.error(`[pre-deploy] ERROR listing git-tracked files: ${e.message}`);
  process.exit(1);
}

// Files added or modified locally (blob SHA differs from remote, or not on remote)
const changedFiles = localIndex.filter(
  (entry) => !remoteBlobs[entry.file] || remoteBlobs[entry.file] !== entry.sha
);

// Files deleted locally but still present on GitHub
const localPathSet = new Set(localIndex.map((e) => e.file));
const deletedFiles = Object.keys(remoteBlobs).filter((p) => !localPathSet.has(p));

console.log(
  `[pre-deploy] Delta: ${changedFiles.length} changed/added, ${deletedFiles.length} deleted.`
);

// Always proceed to commit — every deploy produces an audit commit on GitHub.

// ---------------------------------------------------------------------------
// 5. Upload blobs for changed/added files only (with throttle + retry)
// ---------------------------------------------------------------------------

const uploadedBlobs = {}; // path -> { sha, mode } for newly uploaded files
let blobsDone = 0;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 2000;

for (let i = 0; i < changedFiles.length; i++) {
  const { file, filePath, mode } = changedFiles[i];

  // Symlinks (mode 120000) store the link target as text content
  const buf = readFileSync(filePath);
  const isBinary = mode !== "120000" && buf.slice(0, 8000).includes(0);
  const encoding = isBinary ? "base64" : "utf-8";
  const content = isBinary ? buf.toString("base64") : buf.toString("utf8");

  try {
    const blob = await gh("POST", `/repos/${owner}/${repoName}/git/blobs`, { content, encoding }, { retries: 5 });
    uploadedBlobs[file] = { sha: blob.sha, mode };
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

if (changedFiles.length > 0) {
  console.log(`[pre-deploy] ${changedFiles.length} blobs uploaded.`);
}

// ---------------------------------------------------------------------------
// 6. Create delta tree, commit, update ref
//
// Uses base_tree so GitHub inherits all unchanged files automatically.
// Only the delta (changed/added entries + sha:null deletions) is sent.
// ---------------------------------------------------------------------------

const deltaEntries = [
  // Changed and added files
  ...Object.entries(uploadedBlobs).map(([path, { sha, mode }]) => ({
    path,
    mode,
    type: mode === "160000" ? "commit" : "blob",
    sha,
  })),
  // Deleted files: sha: null tells GitHub to remove them from the tree
  ...deletedFiles.map((path) => ({
    path,
    mode: "100644",
    type: "blob",
    sha: null,
  })),
];

const treeBody = { tree: deltaEntries };
// Use base_tree so unchanged files are inherited without being re-listed
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
  message: `chore: deploy sync ${now}\n\nChanged/added: ${changedFiles.length}  Deleted: ${deletedFiles.length}`,
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
