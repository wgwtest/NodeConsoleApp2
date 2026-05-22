import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  validateSkillAuthoringGuard
} from './support/skill_authoring_guard.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');

test('Codex skill authoring guard catches invalid references, collisions, and rarity cost drift', () => {
  const skillPack = {
    skills: [
      {
        id: 'skill_root',
        name: '根技能',
        rarity: 'Common',
        unlock: { cost: { kp: 1 } },
        prerequisites: [],
        buffRefs: { apply: [] },
        editorMeta: { x: 100, y: 100 }
      },
      {
        id: 'skill_candidate',
        name: '候选技能',
        rarity: 'Legendary',
        unlock: { cost: { kp: 1 } },
        prerequisites: ['skill_missing'],
        buffRefs: { apply: [{ buffId: 'buff_missing' }] },
        actions: [
          {
            id: 'action_1',
            effect: {
              amountSource: { kind: 'BUFF_STACKS', buffId: 'buff_missing_stack_source' }
            }
          }
        ],
        editorMeta: { x: 130, y: 120 }
      }
    ]
  };
  const buffPack = {
    buffs: {
      buff_existing: { id: 'buff_existing', name: '已存在 Buff' }
    }
  };

  const result = validateSkillAuthoringGuard(skillPack, buffPack);

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.issues.map(issue => issue.code).sort(),
    [
      'buff_ref_missing',
      'buff_ref_missing',
      'layout_collision',
      'prerequisite_missing',
      'rarity_kp_out_of_range'
    ].sort()
  );
});

test('current formal melee skill pack passes the Codex authoring guard baseline', async () => {
  const skillPack = JSON.parse(await fs.readFile(
    path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json'),
    'utf8'
  ));
  const buffPack = JSON.parse(await fs.readFile(
    path.join(projectRoot, 'assets', 'data', 'buffs_v2_7.json'),
    'utf8'
  ));

  const result = validateSkillAuthoringGuard(skillPack, buffPack);

  assert.equal(
    result.ok,
    true,
    result.issues.map(issue => `${issue.code}: ${issue.message}`).join('\n')
  );
});
