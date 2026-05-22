#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  validateSkillAuthoringGuard
} from '../test/support/skill_authoring_guard.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');

function resolveProjectPath(inputPath) {
  const normalized = String(inputPath || '').trim();
  if (!normalized) return '';
  if (path.isAbsolute(normalized)) return normalized;
  return path.join(projectRoot, normalized);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function printUsage() {
  console.error([
    'Usage:',
    '  node tools/validate_skill_authoring_guard.mjs [skill-json] [buff-json]',
    '',
    'Defaults:',
    '  skill-json: assets/data/skills_melee_v4_5.json',
    '  buff-json:  assets/data/buffs_v2_7.json'
  ].join('\n'));
}

async function main() {
  const [skillArg, buffArg, extraArg] = process.argv.slice(2);
  if (extraArg || skillArg === '-h' || skillArg === '--help') {
    printUsage();
    process.exit(extraArg ? 2 : 0);
  }

  const skillPath = resolveProjectPath(skillArg || 'assets/data/skills_melee_v4_5.json');
  const buffPath = resolveProjectPath(buffArg || 'assets/data/buffs_v2_7.json');
  const skillPack = await readJson(skillPath);
  const buffPack = await readJson(buffPath);
  const result = validateSkillAuthoringGuard(skillPack, buffPack);

  if (!result.ok) {
    console.error(`Skill authoring guard failed: ${result.issues.length} issue(s)`);
    for (const item of result.issues) {
      console.error(`- [${item.code}] ${item.message}`);
    }
    process.exit(1);
  }

  console.log(`Skill authoring guard passed: ${path.relative(projectRoot, skillPath)}`);
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});

