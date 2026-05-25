#!/usr/bin/env node
import fs   from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.join(__dirname, '..');

// Locate the .git directory (handles worktrees too)
let gitDir;
try {
  gitDir = execSync('git rev-parse --git-dir', { cwd: root }).toString().trim();
  if (!path.isAbsolute(gitDir)) gitDir = path.join(root, gitDir);
} catch {
  console.log('install-hooks: not a git repo — skipping.');
  process.exit(0);
}

const hookPath = path.join(gitDir, 'hooks', 'pre-push');

const script = `#!/bin/sh
# Auto-bump patch version before every push.
# Guard: if HEAD is already a version-bump commit we are just pushing that
# commit — exit early to prevent an infinite cascade.
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

HEAD_MSG=$(git log -1 --format="%s" HEAD)
case "$HEAD_MSG" in
  "Bump version to"*) exit 0 ;;
esac

node scripts/bump-version.js
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml README.md
git diff --cached --quiet && exit 0
VERSION=$(grep '"version"' package.json | head -1 | sed 's/.*"version": "\\([^"]*\\)".*/\\1/')
git commit --no-verify -m "Bump version to $VERSION"
`;

fs.mkdirSync(path.join(gitDir, 'hooks'), { recursive: true });
fs.writeFileSync(hookPath, script, { mode: 0o755 });
console.log(`install-hooks: pre-push hook installed → ${hookPath}`);
