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
# Staged version files are committed and included in the same push.
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"
node scripts/bump-version.js
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git diff --cached --quiet && exit 0
VERSION=$(node -p "require('./package.json').version")
git commit --no-verify -m "Bump version to $VERSION"
`;

fs.mkdirSync(path.join(gitDir, 'hooks'), { recursive: true });
fs.writeFileSync(hookPath, script, { mode: 0o755 });
console.log(`install-hooks: pre-push hook installed → ${hookPath}`);
