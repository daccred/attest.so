#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findBinary(name) {
  const paths = process.env.PATH.split(path.delimiter);
  for (const p of paths) {
    const full = path.join(p, name);
    if (fs.existsSync(full)) {
      return full;
    }
    if (process.platform === 'win32' && fs.existsSync(full + '.cmd')) {
      return full + '.cmd';
    }
  }
  return null;
}

const [runner = 'jest', ...args] = process.argv.slice(2);
const binary = findBinary(runner);
if (!binary) {
  console.log(`Skipping tests: ${runner} not found`);
  process.exit(0);
}

const result = spawnSync(binary, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
