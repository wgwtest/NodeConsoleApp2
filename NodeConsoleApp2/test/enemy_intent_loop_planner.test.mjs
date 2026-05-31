import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');

async function importSourceModule(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  assert.equal(fs.existsSync(filePath), true, `Missing source file ${filePath}`);
  const source = await fsp.readFile(filePath, 'utf8');
  const encoded = Buffer.from(source, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function createPlayer() {
  return {
    id: 'player_intent_probe',
    stats: { hp: 100, maxHp: 100, ap: 6 },
    bodyParts: {
      head: { current: 12, max: 20, weakness: 1.2 },
      chest: { current: 18, max: 24, weakness: 1 },
      abdomen: { current: 10, max: 18, weakness: 1.1 }
    }
  };
}

function makeAttackSkill(id, amount, ap = 2) {
  return {
    id,
    name: id,
    costs: { ap },
    speed: 0,
    target: {
      subject: 'SUBJECT_ENEMY',
      scope: 'SCOPE_PART',
      selection: { mode: 'single', candidateParts: ['head', 'chest'], selectedParts: [], selectCount: 1 }
    },
    buffRefs: { apply: [], remove: [] },
    actions: [{ effect: { effectType: 'DMG_HP', amountType: 'ABS', amount } }]
  };
}

function makeBleedSkill(id, amount, ap = 1) {
  return {
    ...makeAttackSkill(id, amount, ap),
    buffRefs: {
      apply: [{ buffId: 'buff_bleed', target: 'enemy', chance: 1, duration: 2 }],
      remove: []
    }
  };
}

function makeEnemy(intentModel) {
  return {
    id: 'enemy_intent_probe',
    hp: 100,
    maxHp: 100,
    stats: { ap: 3, maxAp: 3, speed: 10 },
    skills: ['heavy_attack', 'bleed_cut'],
    bodyParts: {
      head: { current: 8, max: 8, weakness: 1 },
      chest: { current: 12, max: 12, weakness: 1 }
    },
    intentModel
  };
}

test('EnemyActionPlanner follows intentModel.pattern by turn number before score ranking', async () => {
  const { default: EnemyActionPlanner } = await importSourceModule('script/engine/EnemyActionPlanner.js');
  const skills = {
    heavy_attack: makeAttackSkill('heavy_attack', 30, 2),
    bleed_cut: makeBleedSkill('bleed_cut', 4, 1)
  };
  const planner = new EnemyActionPlanner({ getSkillConfig: skillId => skills[skillId] || null });
  const player = createPlayer();
  const enemy = makeEnemy({
    visible: true,
    pattern: ['attack', 'bleed'],
    fallback: 'attack'
  });

  const turnOne = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 1 });
  const turnTwo = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 2 });
  const turnFour = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 4 });

  assert.equal(turnOne?.skillId, 'heavy_attack');
  assert.equal(turnOne?.intentToken, 'attack');
  assert.equal(turnTwo?.skillId, 'bleed_cut');
  assert.equal(turnTwo?.intentToken, 'bleed');
  assert.equal(turnFour?.skillId, 'bleed_cut');
  assert.equal(turnFour?.intentIndex, 1);
});

test('EnemyActionPlanner uses intent fallback when the active token has no legal candidate', async () => {
  const { default: EnemyActionPlanner } = await importSourceModule('script/engine/EnemyActionPlanner.js');
  const skills = {
    heavy_attack: makeAttackSkill('heavy_attack', 30, 2),
    bleed_cut: makeBleedSkill('bleed_cut', 4, 1)
  };
  const planner = new EnemyActionPlanner({ getSkillConfig: skillId => skills[skillId] || null });
  const player = createPlayer();
  const enemy = makeEnemy({
    visible: true,
    pattern: ['telegraph'],
    fallback: 'bleed'
  });

  const action = planner.planTurn({ enemy, player, playerBodyParts: player.bodyParts, turnNumber: 1 });

  assert.equal(action?.skillId, 'bleed_cut');
  assert.equal(action?.intentToken, 'bleed');
  assert.equal(action?.intentSource, 'fallback');
});
