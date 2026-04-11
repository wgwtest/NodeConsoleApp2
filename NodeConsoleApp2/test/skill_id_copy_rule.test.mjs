import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importSkillEditorModule() {
  const filePath = path.join(projectRoot, 'script', 'editor', 'skill', 'skillEditor.js');
  const source = await fs.readFile(filePath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

test('SkillEditor 会基于原始 base id 生成复制技能 id，不叠加历史 copy 尾巴', async () => {
  const mod = await importSkillEditorModule();

  assert.equal(typeof mod.buildDuplicatedSkillId, 'function', '缺少 buildDuplicatedSkillId()');
  assert.equal(
    mod.buildDuplicatedSkillId('skill_aegis', 1771000000001),
    'skill_aegis_copy_1771000000001'
  );
  assert.equal(
    mod.buildDuplicatedSkillId('skill_aegis_copy_1770042764756', 1771000000002),
    'skill_aegis_copy_1771000000002'
  );
  assert.equal(
    mod.buildDuplicatedSkillId('skill_execute_copy_1769961767095_copy_1770043820577_copy_1770044052832', 1771000000003),
    'skill_execute_copy_1771000000003'
  );
});

test('skills_melee_v4_5.json 不再包含多层 copy 叠加的技能 id，且引用保持有效', async () => {
  const filePath = path.join(projectRoot, 'assets', 'data', 'skills_melee_v4_5.json');
  const json = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const skills = Array.isArray(json?.skills) ? json.skills : [];
  const ids = new Set(skills.map(skill => skill.id));

  const nestedCopyIds = skills.map(skill => skill.id).filter(id => /_copy_\d+.*_copy_\d+/u.test(String(id)));
  assert.deepEqual(nestedCopyIds, [], `仍存在多层 copy 叠加 id: ${nestedCopyIds.join(', ')}`);

  const missingPrerequisites = [];
  for (const skill of skills) {
    const prerequisites = Array.isArray(skill?.prerequisites) ? skill.prerequisites : [];
    for (const prerequisiteId of prerequisites) {
      if (!ids.has(prerequisiteId)) {
        missingPrerequisites.push(`${skill.id} -> ${prerequisiteId}`);
      }
    }
  }

  assert.deepEqual(missingPrerequisites, [], `存在失效 prerequisites 引用: ${missingPrerequisites.join(', ')}`);
});
