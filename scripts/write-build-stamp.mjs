#!/usr/bin/env node
/**
 * Writes BUILD_STAMP.json after each production build.
 * Used by Paramètres → Mises à jour to detect new code on GitHub main.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

let commit = '';
try {
  commit = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
} catch {
  commit = '';
}

const stamp = {
  version: pkg.version || '0.0.0',
  commit,
  builtAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(root, 'BUILD_STAMP.json'), `${JSON.stringify(stamp, null, 2)}\n`);
console.log(`BUILD_STAMP.json → v${stamp.version} @ ${commit.slice(0, 7) || 'no-git'}`);
