#!/usr/bin/env node
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root      = path.join(__dirname, '..');

// ── package.json ──────────────────────────────────────────────────────────────
const pkgPath = path.join(root, 'package.json');
const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const current = pkg.version;
const [maj, min, pat] = current.split('.').map(Number);
const next    = `${maj}.${min}.${pat + 1}`;
pkg.version   = next;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// ── src-tauri/tauri.conf.json ─────────────────────────────────────────────────
const tauriPath = path.join(root, 'src-tauri', 'tauri.conf.json');
const tauri     = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
tauri.version   = next;
fs.writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + '\n');

// ── src-tauri/Cargo.toml ──────────────────────────────────────────────────────
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
const cargo     = fs.readFileSync(cargoPath, 'utf8')
  .replace(/^version = "[\d.]+"/m, `version = "${next}"`);
fs.writeFileSync(cargoPath, cargo);

process.stdout.write(`version bump: ${current} → ${next}\n`);
