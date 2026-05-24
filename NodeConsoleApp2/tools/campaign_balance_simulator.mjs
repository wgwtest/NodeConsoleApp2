import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultProjectRoot = path.resolve(__dirname, '..');

const storyLevelIds = Array.from({ length: 3 }, (_, chapterIndex) => {
  const chapter = chapterIndex + 1;
  return Array.from({ length: 10 }, (_, levelIndex) => `level_${chapter}_${levelIndex + 1}`);
}).flat();

const playerBuilds = [
  {
    id: 'basic',
    label: '基础构筑',
    learned: ['skill_heal', 'skill_heavy_swing', 'skill_double_thrust', 'skill_block'],
    maxAp: 6,
    hpBonus: 0,
    plan: ['skill_block', 'skill_heal', 'skill_heavy_swing', 'skill_double_thrust']
  },
  {
    id: 'recommended',
    label: '推荐构筑',
    learned: [
      'skill_heal',
      'skill_block',
      'skill_heavy_swing',
      'skill_skull_cracker',
      'skill_shockwave_copy_1770042951717',
      'skill_execute',
      'skill_execute_copy_1770043820577',
      'skill_1771769351059',
      'skill_leftover_lunchbox'
    ],
    maxAp: 8,
    hpBonus: 20,
    plan: [
      'skill_block',
      'skill_heal',
      'skill_shockwave_copy_1770042951717',
      'skill_regroup',
      'skill_execute_copy_1770044052832',
      'skill_skull_cracker',
      'skill_execute_copy_1770043820577',
      'skill_heavy_swing',
      'skill_1771769351059',
      'skill_leftover_lunchbox'
    ]
  },
  {
    id: 'specialist',
    label: '偏科构筑',
    learned: [
      'skill_heavy_swing',
      'skill_double_thrust',
      'skill_execute',
      'skill_execute_copy_1770043820577',
      'skill_1770474698976'
    ],
    maxAp: 7,
    hpBonus: 0,
    plan: [
      'skill_execute',
      'skill_heavy_swing',
      'skill_double_thrust',
      'skill_execute_copy_1770043820577',
      'skill_1770474698976'
    ]
  }
];

const progressiveLearningPriority = [
  'skill_block',
  'skill_1771769351059',
  'skill_skull_cracker',
  'skill_shockwave_copy_1770042951717',
  'skill_leftover_lunchbox',
  'skill_execute',
  'skill_execute_copy_1770043820577',
  'skill_regroup',
  'skill_execute_copy_1770044052832'
];

const progressiveBuildProfile = {
  ...playerBuilds[1],
  id: 'progressive',
  label: '进度式推荐构筑'
};

const diagnosisLegend = {
  ok: '结果处在当前粗调可接受范围内。',
  enemy_too_weak: '胜利过快或剩余血量过高，敌人压力偏弱。',
  boss_too_easy: 'Boss 在推荐构筑下被高血量稳定通过。',
  expected_basic_build_limit: '基础构筑在精英或 Boss 关达到预期上限。',
  enemy_numbers_too_high: '推荐构筑无法击杀但玩家仍安全，优先检查敌人 HP/护甲/修复数值。',
  enemy_skill_pressure_high: '推荐构筑失败且玩家受到明显生命压力，优先检查敌人技能压力。',
  player_build_mismatch: '偏科构筑因缺少对应反制而失败，属于构筑错误或章节压力有效。',
  player_skill_tree_gap_candidate: '基础构筑普通关失败的候选信号，需结合推荐构筑结果再判断是否补玩家技能。'
};

class SimulationEventBus {
  constructor() {
    this.handlers = new Map();
    this.events = [];
  }

  on(name, fn) {
    const next = this.handlers.get(name) || [];
    next.push(fn);
    this.handlers.set(name, next);
    return () => {
      this.handlers.set(name, (this.handlers.get(name) || []).filter(item => item !== fn));
    };
  }

  emit(name, payload) {
    this.events.push({ name, payload });
    for (const fn of this.handlers.get(name) || []) {
      fn(payload);
    }
  }

  eventsByName(name) {
    return this.events.filter(event => event.name === name);
  }
}

class SimulationFsm {
  constructor() {
    this.currentState = 'MAIN_MENU';
  }

  changeState(nextState, payload = undefined) {
    this.currentState = nextState;
    this.lastPayload = payload;
  }
}

async function readJson(projectRoot, relativePath) {
  return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), 'utf8'));
}

async function moduleUrl(filePath, rewrite = source => source) {
  const source = rewrite(await fs.readFile(filePath, 'utf8'));
  return `data:text/javascript;base64,${Buffer.from(source, 'utf8').toString('base64')}`;
}

async function importSourceModule(filePath, rewrite = source => source) {
  return import(await moduleUrl(filePath, rewrite));
}

async function importCoreEngineClass(projectRoot) {
  const filePath = path.join(projectRoot, 'script/engine/CoreEngine.js');
  return importSourceModule(
    filePath,
    source => source
      .replace(/^\uFEFF?import[^\n]*\n/gmu, '')
      .replace(/\/\/ 创建单例实例[\s\S]*?export \{ CoreEngine \};\s*$/u, 'export { CoreEngine };\n')
  );
}

async function importRuntimeModules(projectRoot) {
  const buffUrl = await moduleUrl(path.join(projectRoot, 'script/engine/buff/Buff.js'));
  const [
    turnPlannerModule,
    timelineModule,
    enemyPlannerModule,
    buffRegistryModule,
    buffManagerModule,
    buffSystemModule
  ] = await Promise.all([
    importSourceModule(path.join(projectRoot, 'script/engine/TurnPlanner.js')),
    importSourceModule(path.join(projectRoot, 'script/engine/TimelineManager.js')),
    importSourceModule(path.join(projectRoot, 'script/engine/EnemyActionPlanner.js')),
    importSourceModule(path.join(projectRoot, 'script/engine/buff/BuffRegistry.js')),
    importSourceModule(
      path.join(projectRoot, 'script/engine/buff/BuffManager.js'),
      source => source.replace("import Buff from './Buff.js';", `import Buff from '${buffUrl}';`)
    ),
    importSourceModule(path.join(projectRoot, 'script/engine/buff/BuffSystem.js'))
  ]);

  return {
    TurnPlanner: turnPlannerModule.default,
    TimelineManager: timelineModule.default,
    EnemyActionPlanner: enemyPlannerModule.default,
    BuffRegistry: buffRegistryModule.default,
    BuffManager: buffManagerModule.default,
    BuffSystem: buffSystemModule.default
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSeededRandom(seedInput) {
  let seed = 2166136261;
  const text = String(seedInput ?? 'campaign-balance-default-seed');
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let next = seed;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSkillAp(skill) {
  return Number(skill?.costs?.ap ?? skill?.cost?.ap ?? skill?.apCost ?? 0) || 0;
}

function getEntityHp(entity) {
  return Number(entity?.hp ?? entity?.stats?.hp ?? 0) || 0;
}

function getEntityMaxHp(entity) {
  return Number(entity?.maxHp ?? entity?.stats?.maxHp ?? entity?.stats?.hp ?? entity?.hp ?? 0) || 0;
}

function setEntityHp(entity, hp) {
  const maxHp = getEntityMaxHp(entity);
  const next = maxHp > 0 ? Math.max(0, Math.min(maxHp, Number(hp) || 0)) : Math.max(0, Number(hp) || 0);
  if (typeof entity.hp === 'number') entity.hp = next;
  if (entity.stats && typeof entity.stats === 'object') entity.stats.hp = next;
}

function normalizeEnemy(template, index) {
  const enemy = clone(template);
  enemy.id = `${template.id}__sim_${index + 1}`;
  enemy.templateId = template.id;
  enemy.hp = Number(enemy.stats?.hp ?? enemy.hp ?? 1) || 1;
  enemy.maxHp = Number(enemy.stats?.maxHp ?? enemy.maxHp ?? enemy.hp) || enemy.hp;
  enemy.stats = {
    ...(enemy.stats || {}),
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    maxAp: Number(enemy.stats?.maxAp ?? enemy.stats?.ap ?? 0) || 0
  };
  enemy.position = index + 1;
  return enemy;
}

function buildPlayer(basePlayer, build) {
  const player = clone(basePlayer);
  const maxHp = Number(player.stats?.maxHp ?? player.stats?.hp ?? 100) + (Number(build.hpBonus) || 0);
  player.id = 'player_balance_sim';
  player.stats = {
    ...(player.stats || {}),
    hp: maxHp,
    maxHp,
    ap: Number(build.maxAp ?? player.stats?.maxAp ?? player.stats?.ap ?? 6) || 6,
    maxAp: Number(build.maxAp ?? player.stats?.maxAp ?? player.stats?.ap ?? 6) || 6,
    speed: Number(player.stats?.speed ?? 1) || 1
  };
  player.skills = {
    ...(player.skills || {}),
    learned: [...build.learned]
  };
  return player;
}

function snapshotSkillTree(player) {
  return {
    skillPoints: Math.max(0, Number(player?.skills?.skillPoints ?? 0) || 0),
    learned: [...asArray(player?.skills?.learned)]
  };
}

function getSkillKpCost(skill) {
  return Math.max(0, Number(skill?.unlock?.cost?.kp ?? 0) || 0);
}

function canLearnSkill(skill, player) {
  if (!skill || !player?.skills) return false;
  const learned = asArray(player.skills.learned);
  if (learned.includes(skill.id)) return false;
  const prereqs = asArray(skill.prerequisites);
  if (prereqs.some(skillId => !learned.includes(skillId))) return false;
  const exclusives = asArray(skill?.unlock?.exclusives);
  if (exclusives.some(skillId => learned.includes(skillId))) return false;
  return snapshotSkillTree(player).skillPoints >= getSkillKpCost(skill);
}

function autoLearnProgressiveSkills({ player, skillsById }) {
  if (!player.skills || typeof player.skills !== 'object') player.skills = {};
  if (!Array.isArray(player.skills.learned)) player.skills.learned = [];
  if (typeof player.skills.skillPoints !== 'number') player.skills.skillPoints = 0;

  const learnedThisLevel = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const skillId of progressiveLearningPriority) {
      const skill = skillsById.get(skillId);
      if (!canLearnSkill(skill, player)) continue;
      player.skills.skillPoints -= getSkillKpCost(skill);
      player.skills.learned.push(skill.id);
      learnedThisLevel.push(skill.id);
      progressed = true;
      break;
    }
  }
  return learnedThisLevel;
}

function buildProgressivePlan(player) {
  const learned = new Set(asArray(player?.skills?.learned));
  const plan = [];
  for (const skillId of progressiveBuildProfile.plan) {
    if (learned.has(skillId) && !plan.includes(skillId)) plan.push(skillId);
  }
  for (const skillId of progressiveLearningPriority) {
    if (learned.has(skillId) && !plan.includes(skillId)) plan.push(skillId);
  }
  return plan;
}

function applyLevelRewardsToPlayer(player, level, victory) {
  const rewards = victory ? {
    exp: Math.max(0, Number(level?.rewards?.exp ?? 0) || 0),
    gold: Math.max(0, Number(level?.rewards?.gold ?? 0) || 0),
    kp: Math.max(0, Number(level?.rewards?.kp ?? 0) || 0)
  } : { exp: 0, gold: 0, kp: 0 };

  if (!player.resources || typeof player.resources !== 'object') {
    player.resources = { exp: 0, gold: 0 };
  }
  player.resources.exp = Math.max(0, Number(player.resources.exp ?? 0) || 0) + rewards.exp;
  player.resources.gold = Math.max(0, Number(player.resources.gold ?? 0) || 0) + rewards.gold;
  if (!player.skills || typeof player.skills !== 'object') player.skills = {};
  player.skills.skillPoints = Math.max(0, Number(player.skills.skillPoints ?? 0) || 0) + rewards.kp;
  return rewards;
}

function attachBuffs(entity, runtime) {
  entity.buffs = new runtime.BuffManager(entity, runtime.registry, runtime.eventBus);
  runtime.system.registerManager(entity.buffs);
  return entity;
}

function buildRuntimeSkillMaps(skillPack, enemySkillPack) {
  return {
    playerSkills: new Map(asArray(skillPack.skills).map(skill => [skill.id, skill])),
    enemySkills: new Map(asArray(enemySkillPack.skills).map(skill => [skill.id, skill]))
  };
}

function getCandidateParts(skill, target) {
  const fromSkill = asArray(skill?.target?.selection?.candidateParts);
  if (fromSkill.length > 0) return fromSkill;
  return Object.keys(target?.bodyParts || {});
}

function pickWeakestPart(target, skill) {
  const bodyParts = target?.bodyParts || {};
  const candidates = getCandidateParts(skill, target)
    .map(part => ({ part, data: bodyParts[part] }))
    .filter(entry => entry.data);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const armorA = Number(a.data.current ?? 0) || 0;
    const armorB = Number(b.data.current ?? 0) || 0;
    if (armorA !== armorB) return armorA - armorB;
    const weakA = Number(a.data.weakness ?? 1) || 1;
    const weakB = Number(b.data.weakness ?? 1) || 1;
    return weakB - weakA;
  });
  return candidates[0].part;
}

function pickMostDamagedSelfPart(player) {
  const rows = Object.entries(player?.bodyParts || {})
    .map(([part, data]) => ({
      part,
      missing: Math.max(0, (Number(data.max ?? 0) || 0) - (Number(data.current ?? 0) || 0))
    }))
    .filter(row => row.missing > 0);
  rows.sort((a, b) => b.missing - a.missing);
  return rows[0]?.part || 'chest';
}

function summarizeMissingArmor(entity) {
  const rows = Object.values(entity?.bodyParts || {})
    .map(data => Math.max(0, (Number(data.max ?? 0) || 0) - (Number(data.current ?? 0) || 0)));
  return {
    total: rows.reduce((sum, value) => sum + value, 0),
    maxPart: rows.reduce((max, value) => Math.max(max, value), 0)
  };
}

function getEntityBuffStacks(entity, buffId, fallback = 0) {
  if (!entity || !buffId) return fallback;
  if (typeof entity.buffs?.getStacks === 'function') {
    return Number(entity.buffs.getStacks(buffId)) || fallback;
  }
  return fallback;
}

function computeEffectAmountForScore(effect, { target }) {
  const amount = Math.max(0, Number(effect?.amount ?? 0) || 0);
  const amountType = effect?.amountType || 'ABS';
  if (amountType === 'PCT_CURRENT') return Math.max(0, getEntityHp(target) * amount / 100);
  if (amountType === 'PCT_MAX') return Math.max(0, getEntityMaxHp(target) * amount / 100);
  if (amountType === 'BUFF_STACKS') {
    const source = effect?.amountSource || {};
    const buffId = source.buffId;
    const stacks = getEntityBuffStacks(target, buffId, Number(source.missingAs ?? 0) || 0);
    const multiplier = Number(source.multiplier ?? amount ?? 1) || 0;
    return Math.max(0, stacks * multiplier);
  }
  return amount;
}

function summarizeSkill(skill, { target = null, actor = null, skillTarget = null } = {}) {
  const out = { damageHp: 0, damageArmor: 0, heal: 0, armorAdd: 0, preHitArmor: 0, dot: 0, control: 0 };
  for (const action of asArray(skill?.actions)) {
    const effect = action?.effect || {};
    const amountTarget = effect?.amountSource?.owner === 'actor' || effect?.amountSource?.owner === 'self'
      ? actor
      : (effect?.amountSource?.owner === 'skillTarget' ? skillTarget : target);
    const amount = computeEffectAmountForScore(effect, { target: amountTarget || target });
    if (effect.effectType === 'DMG_HP') out.damageHp += amount;
    if (effect.effectType === 'DMG_ARMOR') out.damageArmor += amount;
    if (effect.effectType === 'HEAL') out.heal += amount;
    if (effect.effectType === 'ARMOR_ADD') out.armorAdd += amount;
  }
  for (const row of asArray(skill?.buffRefs?.apply)) {
    if (['buff_bleed', 'buff_poison', 'buff_tear_wound'].includes(row?.buffId)) out.dot += 10;
    if (['buff_slow', 'buff_vulnerable'].includes(row?.buffId)) out.control += 6;
    if (row?.buffId === 'new_buff_1771485041778') {
      out.preHitArmor += Math.max(0, Number(row?.params?.healArmorVal ?? 5) || 5);
    }
  }
  return out;
}

function findPrimaryEnemy(enemies) {
  return [...enemies]
    .filter(enemy => getEntityHp(enemy) > 0)
    .sort((a, b) => {
      const hpA = getEntityHp(a);
      const hpB = getEntityHp(b);
      if (hpA !== hpB) return hpA - hpB;
      return String(a.id).localeCompare(String(b.id));
    })[0] || null;
}

function scoreSkillForBuild({ skill, player, target, buildId, chapter }) {
  const subject = skill.target?.subject;
  const summary = summarizeSkill(skill, {
    target: subject === 'SUBJECT_SELF' ? player : target,
    actor: player,
    skillTarget: target
  });
  const hpRatio = player.stats.maxHp > 0 ? player.stats.hp / player.stats.maxHp : 1;
  const missingHp = Math.max(0, (Number(player.stats.maxHp ?? 0) || 0) - (Number(player.stats.hp ?? 0) || 0));
  const missingArmor = summarizeMissingArmor(player);
  const targetHp = getEntityHp(target);
  const targetMaxHp = getEntityMaxHp(target) || targetHp || 1;
  const targetHpRatio = targetMaxHp > 0 ? targetHp / targetMaxHp : 1;
  const targetBleedStacks = getEntityBuffStacks(target, 'buff_bleed', 0);
  let score = 0;
  if (subject === 'SUBJECT_SELF') {
    const shouldFinishFight = buildId === 'recommended' && hpRatio >= 0.75 && targetHpRatio <= 0.35;
    if (shouldFinishFight) return 0;
    if (summary.heal > 0 && missingHp > 0) {
      if (['recommended', 'progressive'].includes(buildId) && hpRatio >= 0.8 && missingHp < summary.heal) return 0;
      score += summary.heal * (hpRatio < 0.7 ? 2.8 : 0.8);
      score += Math.min(missingHp, summary.heal) * 1.5;
    }
    if (summary.armorAdd > 0 && missingArmor.total > 0) {
      score += summary.armorAdd * 0.8;
      score += Math.min(missingArmor.maxPart, summary.armorAdd) * 1.8;
      if (buildId === 'basic') score += Math.min(missingArmor.total, summary.armorAdd);
      if (buildId === 'recommended' && chapter >= 2) score += Math.min(missingArmor.total, summary.armorAdd) * 0.6;
    }
    if (summary.preHitArmor > 0) {
      const pressure = chapter >= 3 ? 1.6 : 1.2;
      score += summary.preHitArmor * pressure;
      if (hpRatio < 0.75) score += summary.preHitArmor * 2.0;
      if (['recommended', 'progressive'].includes(buildId) && chapter >= 2) score += 18;
    }
    return score;
  }

  const selectedPart = pickWeakestPart(target, skill);
  const selectedArmor = Math.max(0, Number(target?.bodyParts?.[selectedPart]?.current ?? 0) || 0);
  const armorFromArmorSkill = Math.min(selectedArmor, summary.damageArmor);
  const armorFromHpSkill = Math.min(selectedArmor, summary.damageHp);
  const hpThroughArmor = Math.max(0, summary.damageHp - selectedArmor);

  score += hpThroughArmor * 2.2;
  score += armorFromHpSkill * (chapter >= 2 ? 0.8 : 0.5);
  score += armorFromArmorSkill * (chapter >= 2 ? 2.0 : 1.2);
  score += summary.dot * (chapter >= 3 ? 1.5 : 1.0);
  score += summary.control;
  if (summary.heal > 0 && missingHp > 0) {
    const bleedSustain = targetBleedStacks > 0 && ['recommended', 'progressive'].includes(buildId);
    score += summary.heal * (hpRatio < 0.7 ? 3.4 : 1.0);
    score += Math.min(missingHp, summary.heal) * 1.8;
    if (bleedSustain) {
      score += 26 + targetBleedStacks * 5;
      if (hpRatio < 0.75) score += 16;
    }
  }
  if (buildId === 'recommended' && targetHpRatio <= 0.35) {
    score += hpThroughArmor * 4.0;
    score += summary.damageHp >= targetHp ? 120 : 0;
    score -= summary.dot * 0.8;
  }

  const targetArmor = Object.values(target?.bodyParts || {})
    .reduce((sum, part) => sum + (Number(part.current ?? 0) || 0), 0);
  if (targetArmor > 35) score += armorFromArmorSkill * 1.2;
  if (buildId === 'specialist') score += hpThroughArmor * 1.5;
  if (buildId === 'recommended') score += armorFromArmorSkill + summary.dot;

  return score;
}

function buildPlayerDraft({ driver, build, skillsById, chapter }) {
  const player = driver.data.playerData;
  const target = findPrimaryEnemy(driver.data.currentLevelData.enemies);
  if (!target) return {};

  const available = build.plan
    .map(skillId => skillsById.get(skillId))
    .filter(Boolean)
    .filter(skill => (player.skills?.learned || []).includes(skill.id));

  const draft = Object.create(null);
  const occupied = new Set();
  let remainingAp = Number(player.stats?.ap ?? 0) || 0;

  const ranked = available
    .map(skill => ({ skill, score: scoreSkillForBuild({ skill, player, target, buildId: build.id, chapter }) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const { skill } of ranked) {
    const ap = getSkillAp(skill);
    if (ap > remainingAp) continue;

    const subject = skill.target?.subject;
    const side = subject === 'SUBJECT_SELF' ? 'self' : 'enemy';
    const selectedPart = side === 'self' ? pickMostDamagedSelfPart(player) : pickWeakestPart(target, skill);
    const slotPart = selectedPart || (side === 'self' ? 'chest' : 'chest');
    const slotCap = Number(driver._getBattleSlotLayout?.()?.slotCounts?.[slotPart]?.[side] ?? 0) || 0;
    let slotKey = null;
    for (let index = 0; index < slotCap; index += 1) {
      const candidate = `${side}:${slotPart}:${index}`;
      if (!occupied.has(candidate)) {
        slotKey = candidate;
        break;
      }
    }
    if (!slotKey) continue;

    occupied.add(slotKey);
    remainingAp -= ap;
    draft[skill.id] = {
      skillId: skill.id,
      targetId: side === 'self' ? player.id : target.id,
      placedSlots: [slotKey],
      selectionResult: { selectedParts: [slotPart] }
    };
  }

  return draft;
}

function makeEventBusWithSkillUsage(counter) {
  const bus = new SimulationEventBus();
  bus.on('TIMELINE_ENTRY_END', payload => {
    const action = payload?.entry?.sourceAction;
    if (action?.source === 'ENEMY' && action.skillId) {
      counter[action.skillId] = (counter[action.skillId] || 0) + 1;
    }
  });
  return bus;
}

function countSkillUsage(events, source) {
  const out = Object.create(null);
  for (const event of events) {
    const action = event?.payload?.entry?.sourceAction;
    if (action?.source === source && action.skillId) {
      out[action.skillId] = (out[action.skillId] || 0) + 1;
    }
  }
  return { ...out };
}

function buildDriver({ CoreEngine, modules, runtime, player, enemies, skillMaps, slotLayouts, level }) {
  const eventBus = makeEventBusWithSkillUsage(runtime.enemySkillUsage);
  runtime.eventBus = eventBus;
  runtime.system = new runtime.BuffSystem(eventBus, runtime.registry);
  runtime.system.start();

  const attachedPlayer = attachBuffs(player, runtime);
  const attachedEnemies = enemies.map(enemy => attachBuffs(enemy, runtime));
  const data = {
    playerData: attachedPlayer,
    currentLevelData: {
      ...level,
      enemies: attachedEnemies,
      battlePlayerState: {
        stats: { ...attachedPlayer.stats },
        bodyParts: clone(attachedPlayer.bodyParts || {})
      }
    },
    dataConfig: {
      battleRules: { slotLayoutId: 'default_v1' },
      runtime: {}
    },
    gameConfig: { items: {}, slotLayouts },
    getLevelConfig: () => ({ battleRules: { slotLayoutId: 'default_v1' } }),
    getSkillConfig: skillId => skillMaps.playerSkills.get(skillId) || null,
    getEnemySkillConfig: skillId => skillMaps.enemySkills.get(skillId) || null,
    getSkillCatalog: () => ({ skillsList: [...skillMaps.playerSkills.values()] }),
    saveGame: () => true,
    applyBattleSettlement: ({ levelId, victory }) => ({
      levelId,
      levelName: level.name || levelId,
      victory,
      rewards: { exp: 0, gold: 0, kp: 0 }
    })
  };

  const driver = Object.create(CoreEngine.prototype);
  driver.eventBus = eventBus;
  driver.fsm = new SimulationFsm();
  driver.data = data;
  driver.buffRegistry = runtime.registry;
  driver.buffSystem = runtime.system;
  driver.playerSkillQueue = [];
  driver.enemySkillQueue = [];
  driver.battlePhase = 'IDLE';
  driver.currentTurn = 0;
  driver.currentHistoryEntry = null;
  driver._battleSlotLayout = null;
  driver.turnPlanner = new modules.TurnPlanner({
    getSlotLayout: () => driver._getBattleSlotLayout(),
    getPlayerId: () => driver.data.playerData.id,
    getSkillConfig: skillId => driver.data.getSkillConfig(skillId),
    getCurrentAp: () => driver.data.playerData.stats.ap,
    getUsedAp: () => (driver.playerSkillQueue || []).reduce((sum, action) => sum + (Number(action.cost) || 0), 0)
  });
  driver.enemyPlanner = new modules.EnemyActionPlanner({
    getSkillConfig: skillId => driver.data.getEnemySkillConfig(skillId)
  });
  driver.timeline = new modules.TimelineManager({
    eventBus,
    executeEntry: async entry => driver._executeTimelineEntry(entry)
  });
  const realStart = driver.timeline.start.bind(driver.timeline);
  driver.timeline.start = (options = {}) => realStart({ ...options, stepDelayMs: 0 });
  driver._bindTimelineEvents();
  driver._bindBuffBridgeEvents();
  return driver;
}

async function playOneTurn(driver, draft) {
  const roundId = driver.currentTurn;
  const failuresBefore = driver.eventBus.eventsByName('PLANNING_COMMIT_FAILED').length;
  driver.commitPlanning({ planningDraftBySkill: draft });
  if (driver.timeline.phase !== 'READY') {
    const failure = driver.eventBus.eventsByName('PLANNING_COMMIT_FAILED').slice(failuresBefore).at(-1);
    if (failure?.payload?.reason) {
      return { ok: false, reason: `planning_commit_failed:${failure.payload.reason}` };
    }
    return { ok: false, reason: `timeline_not_ready_${driver.timeline.phase}` };
  }
  driver.commitTurn();
  const startedAt = Date.now();
  while (driver.fsm.currentState === 'BATTLE_LOOP' && driver.battlePhase === 'EXECUTION') {
    if (Date.now() - startedAt > 1500) {
      return { ok: false, reason: 'turn_timeout' };
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (driver.fsm.currentState === 'BATTLE_LOOP' && driver.currentTurn === roundId) {
    return { ok: false, reason: 'turn_did_not_advance' };
  }
  return { ok: true };
}

async function withQuietConsole(fn) {
  const originalGroupCollapsed = console.groupCollapsed;
  const originalLog = console.log;
  const originalGroupEnd = console.groupEnd;
  console.groupCollapsed = () => {};
  console.log = () => {};
  console.groupEnd = () => {};
  try {
    return await fn();
  } finally {
    console.groupCollapsed = originalGroupCollapsed;
    console.log = originalLog;
    console.groupEnd = originalGroupEnd;
  }
}

async function withSeededRandom(seed, fn) {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);
  try {
    return await fn();
  } finally {
    Math.random = originalRandom;
  }
}

function classifyLevel(level) {
  const order = Number(level.flow?.localOrder ?? String(level.id).split('_').at(-1) ?? 1) || 1;
  const primaryTags = asArray(level.selectionMeta?.enemyStyleTags);
  const label = String(level.selectionMeta?.difficultyLabel || '');
  const isBoss = order === 10 || /boss/i.test(level.id) || label.includes('Boss');
  const isElite = order === 4 || order === 9 || primaryTags.includes('精英') || label.includes('精英');
  return { order, isBoss, isElite };
}

function diagnose(row, level) {
  if (row.victory) {
    const playerMaxHp = Number(row.playerMaxHp ?? row.playerRemainingHp ?? 0) || 0;
    const playerHpRatio = playerMaxHp > 0 ? row.playerRemainingHp / playerMaxHp : 1;
    if (playerHpRatio > 0.9 && row.turns <= 3) return 'enemy_too_weak';
    if (row.buildId === 'recommended' && level.isBoss && row.playerRemainingHp >= (row.playerMaxHp ?? row.playerRemainingHp) * 0.9) return 'boss_too_easy';
    return 'ok';
  }
  if (row.buildId === 'recommended') {
    return row.playerRemainingHp >= 60 ? 'enemy_numbers_too_high' : 'enemy_skill_pressure_high';
  }
  if (row.buildId === 'progressive') {
    if (level.isBoss || level.isElite) {
      return row.playerRemainingHp >= 60 ? 'enemy_numbers_too_high' : 'enemy_skill_pressure_high';
    }
    return row.playerRemainingHp >= 60 ? 'enemy_numbers_too_high' : 'player_skill_tree_gap_candidate';
  }
  if (row.buildId === 'specialist') return 'player_build_mismatch';
  return level.isBoss || level.isElite ? 'expected_basic_build_limit' : 'player_skill_tree_gap_candidate';
}

function summarizeReport(results) {
  const byBuild = playerBuilds.map(build => {
    const rows = results.filter(row => row.buildId === build.id);
    const wins = rows.filter(row => row.victory).length;
    return {
      buildId: build.id,
      label: build.label,
      attempts: rows.length,
      wins,
      winRate: rows.length > 0 ? wins / rows.length : 0,
      averageTurns: rows.reduce((sum, row) => sum + row.turns, 0) / Math.max(1, rows.length),
      averagePlayerRemainingHp: rows.reduce((sum, row) => sum + row.playerRemainingHp, 0) / Math.max(1, rows.length)
    };
  });
  const byChapter = [];
  for (const chapter of [1, 2, 3]) {
    for (const build of playerBuilds) {
      const rows = results.filter(row => row.chapter === chapter && row.buildId === build.id);
      const wins = rows.filter(row => row.victory).length;
      byChapter.push({
        chapter,
        buildId: build.id,
        attempts: rows.length,
        wins,
        winRate: rows.length > 0 ? wins / rows.length : 0
      });
    }
  }
  const diagnosisCounts = Object.create(null);
  for (const row of results) {
    diagnosisCounts[row.diagnosis] = (diagnosisCounts[row.diagnosis] || 0) + 1;
  }
  const recommendations = [];
  const recommended = byBuild.find(row => row.buildId === 'recommended');
  const specialist = byBuild.find(row => row.buildId === 'specialist');
  if (recommended && recommended.winRate < 0.7) {
    recommendations.push('推荐构筑胜率偏低：优先检查敌人数值和敌人技能压力，再判断玩家技能树是否缺反制。');
  }
  if (recommended && recommended.winRate > 0.9) {
    recommendations.push('推荐构筑胜率偏高：后续调参应提高精英和 Boss 的组合压力。');
  }
  const specialistStillStrong = specialist && recommended && (
    specialist.winRate > recommended.winRate
    || (
      specialist.winRate === recommended.winRate
      && specialist.averagePlayerRemainingHp > recommended.averagePlayerRemainingHp - 20
    )
  );
  if (specialistStillStrong) {
    recommendations.push('偏科构筑没有明显吃亏：需要增强章节压力的针对性或削弱纯输出泛用性。');
  }
  if (recommendations.length === 0) {
    recommendations.push('首轮模拟未发现结构性异常；下一步按逐关报告微调普通关、精英关和 Boss 曲线。');
  }
  return { byBuild, byChapter, diagnosisCounts, diagnosisLegend, recommendations };
}

function renderRuntimeSmokeSummary(report) {
  const lines = ['# Campaign Runtime Smoke Summary', ''];
  lines.push(`Generated: ${report.meta.generatedAt}`);
  lines.push(`Mode: ${report.meta.mode}`);
  lines.push(`Levels: ${report.meta.levelCount}`);
  lines.push(`Covered levels: ${report.summary?.coveredLevels ?? 0}`);
  lines.push(`Failed levels: ${Array.isArray(report.summary?.failedLevels) ? report.summary.failedLevels.length : 0}`);
  lines.push('');
  lines.push('## Level Results');
  lines.push('');
  lines.push('| Level | Enemies | Player Plans | Enemy Plans | Timeline Entries | Turn Result | Current Turn | State |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- | ---: | --- |');
  for (const row of report.results || []) {
    lines.push(`| ${row.levelId} | ${row.instantiatedEnemyCount} | ${row.playerPlanCount} | ${row.enemyPlanCount} | ${row.timelineEntryCount} | ${row.turnResult?.ok ? 'ok' : (row.turnResult?.reason || 'failed')} | ${row.currentTurn} | ${row.fsmState}/${row.battlePhase} |`);
  }
  lines.push('');
  if (Array.isArray(report.summary?.failedLevels) && report.summary.failedLevels.length > 0) {
    lines.push('## Failed Levels');
    lines.push('');
    for (const item of report.summary.failedLevels) {
      lines.push(`- ${item.levelId}: ${item.reason}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderSummary(report) {
  if (report.meta?.mode === 'runtime_smoke') {
    return renderRuntimeSmokeSummary(report);
  }

  const lines = ['# Campaign Balance Summary', ''];
  lines.push(`Generated: ${report.meta.generatedAt}`);
  if (report.meta.mode) lines.push(`Mode: ${report.meta.mode}`);
  lines.push(`Levels: ${report.meta.levelCount}`);
  if (Array.isArray(report.meta.buildIds)) {
    lines.push(`Builds: ${report.meta.buildIds.join(', ')}`);
  }
  lines.push('');

  if (Array.isArray(report.summary?.byBuild)) {
    lines.push('## Build Summary');
    lines.push('');
    lines.push('| Build | Wins | Attempts | Win Rate | Avg Turns | Avg Player HP |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
    for (const row of report.summary.byBuild) {
      lines.push(`| ${row.buildId} | ${row.wins} | ${row.attempts} | ${(row.winRate * 100).toFixed(1)}% | ${row.averageTurns.toFixed(1)} | ${row.averagePlayerRemainingHp.toFixed(1)} |`);
    }
    lines.push('');
  }

  if (report.meta.mode === 'progressive') {
    lines.push('## Progressive Learning Summary');
    lines.push('');
    lines.push(`Wins: ${report.summary.wins}/${report.summary.attempts} (${(report.summary.winRate * 100).toFixed(1)}%)`);
    lines.push(`Skill tree gap candidates: ${report.summary.skillTreeGapCandidates}`);
    lines.push(`Final skill points: ${report.summary.finalSkillPoints}`);
    lines.push(`Final learned skills: ${report.summary.finalLearned.join(', ')}`);
    lines.push('');
  }

  lines.push('## Level Results');
  lines.push('');
  if (report.meta.mode === 'progressive') {
    lines.push('| Level | Victory | Turns | Player HP | Enemy HP | Learned this level | Rewards KP | Diagnosis |');
    lines.push('| --- | --- | ---: | ---: | ---: | --- | ---: | --- |');
    for (const row of report.results) {
      lines.push(`| ${row.levelId} | ${row.victory ? 'Y' : 'N'} | ${row.turns} | ${row.playerRemainingHp} | ${row.enemyRemainingHp} | ${row.learnedThisLevel.join(', ') || '-'} | ${row.rewards?.kp ?? 0} | ${row.diagnosis} |`);
    }
  } else {
    lines.push('| Level | Build | Victory | Turns | Player HP | Enemy HP | Diagnosis |');
    lines.push('| --- | --- | --- | ---: | ---: | ---: | --- |');
    for (const row of report.results) {
      lines.push(`| ${row.levelId} | ${row.buildId} | ${row.victory ? 'Y' : 'N'} | ${row.turns} | ${row.playerRemainingHp} | ${row.enemyRemainingHp} | ${row.diagnosis} |`);
    }
  }
  lines.push('');

  if (Array.isArray(report.summary?.recommendations)) {
    lines.push('## Recommendations');
    lines.push('');
    for (const item of report.summary.recommendations) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  lines.push('## Diagnosis Legend');
  lines.push('');
  for (const [key, value] of Object.entries(report.summary.diagnosisLegend || diagnosisLegend)) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('');
  return lines.join('\n');
}

async function simulateLevelBuild({ CoreEngine, modules, data, levelId, build, maxTurns }) {
  const level = data.levels.levels[levelId];
  const poolId = level.waves?.[0]?.enemyPoolId;
  const members = asArray(data.levels.enemyPools?.[poolId]?.members);
  const enemies = members
    .map((member, index) => data.enemies[member.templateId] ? normalizeEnemy(data.enemies[member.templateId], index) : null)
    .filter(Boolean);
  const battleEnemies = enemies;
  const player = buildPlayer(data.player.default, build);
  const runtime = {
    BuffManager: modules.BuffManager,
    BuffSystem: modules.BuffSystem,
    registry: new modules.BuffRegistry(data.buffs.buffs),
    enemySkillUsage: Object.create(null)
  };
  const driver = buildDriver({
    CoreEngine,
    modules,
    runtime,
    player,
    enemies,
    skillMaps: data.skillMaps,
    slotLayouts: data.slotLayouts,
    level
  });
  const levelClass = classifyLevel(level);
  let failureReason = '';
  await withQuietConsole(async () => {
    driver.startBattle();

    for (let turn = 0; turn < maxTurns && driver.fsm.currentState === 'BATTLE_LOOP'; turn += 1) {
      const draft = buildPlayerDraft({
        driver,
        build,
        skillsById: data.skillMaps.playerSkills,
        chapter: Number(level.flow?.chapterOrder ?? 1) || 1
      });
      if (Object.keys(draft).length === 0) {
        failureReason = 'no_player_action_available';
        break;
      }
      const turnResult = await playOneTurn(driver, draft);
      if (!turnResult.ok) {
        failureReason = turnResult.reason;
        break;
      }
    }
  });

  const victory = driver.fsm.currentState === 'BATTLE_SETTLEMENT' && driver.fsm.lastPayload?.victory === true;
  const defeated = driver.fsm.currentState === 'BATTLE_SETTLEMENT' && driver.fsm.lastPayload?.victory === false;
  const turns = Math.max(0, Number(driver.currentTurn ?? 1) - 1);
  const enemyRemainingHp = battleEnemies
    .reduce((sum, enemy) => sum + Math.max(0, getEntityHp(enemy)), 0);
  const playerRemainingHp = Math.max(0, getEntityHp(driver.data.playerData));

  if (!failureReason) {
    if (victory) failureReason = 'victory';
    else if (defeated) failureReason = 'player_hp_zero';
    else failureReason = 'turn_limit';
  }

  const row = {
    levelId,
    levelName: level.name || levelId,
    chapter: Number(level.flow?.chapterOrder ?? 1) || 1,
    buildId: build.id,
    buildLabel: build.label,
    victory,
    turns,
    playerMaxHp: Math.max(0, getEntityMaxHp(driver.data.playerData)),
    playerRemainingHp,
    enemyRemainingHp,
    playerSkillUsage: countSkillUsage(driver.eventBus.eventsByName('TIMELINE_ENTRY_END'), 'PLAYER'),
    enemySkillUsage: { ...runtime.enemySkillUsage },
    failureReason,
    diagnosis: 'pending',
    levelClass
  };
  row.diagnosis = diagnose(row, levelClass);
  return row;
}

async function simulateProgressiveLevel({ CoreEngine, modules, data, levelId, player, maxTurns }) {
  const learnedThisLevel = autoLearnProgressiveSkills({
    player,
    skillsById: data.skillMaps.playerSkills
  });
  const skillTreeBefore = snapshotSkillTree(player);
  const build = {
    ...progressiveBuildProfile,
    learned: [...skillTreeBefore.learned],
    maxAp: Number(player.stats?.maxAp ?? progressiveBuildProfile.maxAp) || progressiveBuildProfile.maxAp,
    hpBonus: 0,
    plan: buildProgressivePlan(player)
  };
  const row = await simulateLevelBuild({ CoreEngine, modules, data, levelId, build, maxTurns });
  const rewards = applyLevelRewardsToPlayer(player, data.levels.levels[levelId], row.victory);
  row.skillTreeBefore = skillTreeBefore;
  row.skillTreeAfter = snapshotSkillTree(player);
  row.learnedThisLevel = learnedThisLevel;
  row.rewards = rewards;
  return row;
}

async function runRuntimeSmokeLevel({ CoreEngine, modules, data, levelId, build }) {
  const level = data.levels.levels[levelId];
  const poolId = level.waves?.[0]?.enemyPoolId;
  const members = asArray(data.levels.enemyPools?.[poolId]?.members);
  const enemies = members
    .map((member, index) => data.enemies[member.templateId] ? normalizeEnemy(data.enemies[member.templateId], index) : null)
    .filter(Boolean);
  const player = buildPlayer(data.player.default, build);
  const runtime = {
    BuffManager: modules.BuffManager,
    BuffSystem: modules.BuffSystem,
    registry: new modules.BuffRegistry(data.buffs.buffs),
    enemySkillUsage: Object.create(null)
  };
  const driver = buildDriver({
    CoreEngine,
    modules,
    runtime,
    player,
    enemies,
    skillMaps: data.skillMaps,
    slotLayouts: data.slotLayouts,
    level
  });
  const result = {
    levelId,
    levelName: level.name || levelId,
    instantiatedEnemyCount: enemies.length,
    playerPlanCount: 0,
    enemyPlanCount: 0,
    timelineEntryCount: 0,
    currentTurn: 0,
    battlePhase: 'IDLE',
    fsmState: 'INIT',
    settled: false,
    turnResult: { ok: false, reason: 'not_started' },
    playerSkillUsage: {},
    enemySkillUsage: {}
  };

  await withQuietConsole(async () => {
    driver.startBattle();
    const draft = buildPlayerDraft({
      driver,
      build,
      skillsById: data.skillMaps.playerSkills,
      chapter: Number(level.flow?.chapterOrder ?? 1) || 1
    });
    result.playerPlanCount = Object.keys(draft).length;
    if (result.playerPlanCount <= 0) {
      result.turnResult = { ok: false, reason: 'no_player_action_available' };
      return;
    }

    const roundId = driver.currentTurn;
    const failuresBefore = driver.eventBus.eventsByName('PLANNING_COMMIT_FAILED').length;
    driver.commitPlanning({ planningDraftBySkill: draft });
    result.enemyPlanCount = Array.isArray(driver.enemySkillQueue) ? driver.enemySkillQueue.length : 0;
    result.timelineEntryCount = Array.isArray(driver.timeline?.entries) ? driver.timeline.entries.length : 0;
    if (driver.timeline.phase !== 'READY') {
      const failure = driver.eventBus.eventsByName('PLANNING_COMMIT_FAILED').slice(failuresBefore).at(-1);
      result.turnResult = {
        ok: false,
        reason: failure?.payload?.reason
          ? `planning_commit_failed:${failure.payload.reason}`
          : `timeline_not_ready_${driver.timeline.phase}`
      };
      return;
    }

    driver.commitTurn();
    const startedAt = Date.now();
    while (driver.fsm.currentState === 'BATTLE_LOOP' && driver.battlePhase === 'EXECUTION') {
      if (Date.now() - startedAt > 1500) {
        result.turnResult = { ok: false, reason: 'turn_timeout' };
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (driver.fsm.currentState === 'BATTLE_LOOP' && driver.currentTurn === roundId) {
      result.turnResult = { ok: false, reason: 'turn_did_not_advance' };
      return;
    }
    result.turnResult = { ok: true };
  });

  result.currentTurn = Number(driver.currentTurn ?? 0) || 0;
  result.battlePhase = driver.battlePhase || '';
  result.fsmState = driver.fsm?.currentState || '';
  result.settled = driver.fsm?.currentState === 'BATTLE_SETTLEMENT';
  result.playerSkillUsage = countSkillUsage(driver.eventBus.eventsByName('TIMELINE_ENTRY_END'), 'PLAYER');
  result.enemySkillUsage = countSkillUsage(driver.eventBus.eventsByName('TIMELINE_ENTRY_END'), 'ENEMY');
  return result;
}

function summarizeRuntimeSmoke(results) {
  const failed = results.filter(row => (
    row.instantiatedEnemyCount < 1
    || row.playerPlanCount < 1
    || row.enemyPlanCount < 1
    || row.timelineEntryCount < row.playerPlanCount + row.enemyPlanCount
    || !row.turnResult?.ok
    || (!(row.currentTurn >= 2) && row.settled !== true)
  ));
  return {
    coveredLevels: results.length,
    failedLevels: failed.map(row => ({
      levelId: row.levelId,
      reason: row.turnResult?.reason || 'runtime_smoke_failed',
      instantiatedEnemyCount: row.instantiatedEnemyCount,
      playerPlanCount: row.playerPlanCount,
      enemyPlanCount: row.enemyPlanCount,
      timelineEntryCount: row.timelineEntryCount,
      currentTurn: row.currentTurn,
      fsmState: row.fsmState,
      battlePhase: row.battlePhase
    }))
  };
}

function summarizeProgressiveReport(results, player) {
  const wins = results.filter(row => row.victory).length;
  const diagnosisCounts = Object.create(null);
  for (const row of results) {
    diagnosisCounts[row.diagnosis] = (diagnosisCounts[row.diagnosis] || 0) + 1;
  }
  const failedWithAllPrioritySkills = results.filter(row => (
    !row.victory
    && progressiveLearningPriority.every(skillId => row.skillTreeBefore.learned.includes(skillId))
    && row.diagnosis === 'player_skill_tree_gap_candidate'
  ));
  return {
    attempts: results.length,
    wins,
    winRate: results.length > 0 ? wins / results.length : 0,
    diagnosisCounts,
    skillTreeGapCandidates: failedWithAllPrioritySkills.length,
    finalSkillPoints: snapshotSkillTree(player).skillPoints,
    finalLearned: snapshotSkillTree(player).learned
  };
}

export async function runCampaignBalanceSimulation(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || defaultProjectRoot);
  const maxTurns = Number(options.maxTurns ?? 12) || 12;
  const randomSeed = String(options.randomSeed || 'campaign-balance-v1');

  return withSeededRandom(randomSeed, async () => {
    const { CoreEngine } = await importCoreEngineClass(projectRoot);
    const modules = await importRuntimeModules(projectRoot);
    const levels = await readJson(projectRoot, 'assets/map_packs/current/story_pack_v1/levels.json');
    const data = {
      levels,
      enemies: await readJson(projectRoot, 'assets/data/enemies.json'),
      player: await readJson(projectRoot, 'assets/data/player.json'),
      buffs: await readJson(projectRoot, 'assets/data/buffs_v2_7.json'),
      slotLayouts: await readJson(projectRoot, 'assets/data/slot_layouts.json')
    };
    data.skillMaps = buildRuntimeSkillMaps(
      await readJson(projectRoot, 'assets/data/skills_melee_v4_5.json'),
      await readJson(projectRoot, 'assets/data/skills_enemy_v1.json')
    );

    const results = [];
    for (const levelId of storyLevelIds) {
      for (const build of playerBuilds) {
        results.push(await simulateLevelBuild({ CoreEngine, modules, data, levelId, build, maxTurns }));
      }
    }

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        levelCount: storyLevelIds.length,
        buildIds: playerBuilds.map(build => build.id),
        maxTurns,
        randomSeed,
        source: 'tools/campaign_balance_simulator.mjs'
      },
      builds: playerBuilds.map(build => ({
        id: build.id,
        label: build.label,
        learned: build.learned,
        maxAp: build.maxAp
      })),
      results,
      summary: summarizeReport(results)
    };
  });
}

export async function runProgressiveCampaignSimulation(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || defaultProjectRoot);
  const maxTurns = Number(options.maxTurns ?? 12) || 12;
  const randomSeed = String(options.randomSeed || 'campaign-progressive-v1');

  return withSeededRandom(randomSeed, async () => {
    const { CoreEngine } = await importCoreEngineClass(projectRoot);
    const modules = await importRuntimeModules(projectRoot);
    const levels = await readJson(projectRoot, 'assets/map_packs/current/story_pack_v1/levels.json');
    const data = {
      levels,
      enemies: await readJson(projectRoot, 'assets/data/enemies.json'),
      player: await readJson(projectRoot, 'assets/data/player.json'),
      buffs: await readJson(projectRoot, 'assets/data/buffs_v2_7.json'),
      slotLayouts: await readJson(projectRoot, 'assets/data/slot_layouts.json')
    };
    data.skillMaps = buildRuntimeSkillMaps(
      await readJson(projectRoot, 'assets/data/skills_melee_v4_5.json'),
      await readJson(projectRoot, 'assets/data/skills_enemy_v1.json')
    );

    const player = buildPlayer(data.player.default, {
      ...progressiveBuildProfile,
      learned: asArray(data.player.default?.skills?.learned),
      maxAp: data.player.default?.stats?.maxAp ?? progressiveBuildProfile.maxAp,
      hpBonus: 0
    });
    player.skills.skillPoints = Math.max(0, Number(data.player.default?.skills?.skillPoints ?? 0) || 0);
    player.resources = clone(data.player.default?.resources || { exp: 0, gold: 0 });

    const results = [];
    for (const levelId of storyLevelIds) {
      results.push(await simulateProgressiveLevel({ CoreEngine, modules, data, levelId, player, maxTurns }));
    }

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        mode: 'progressive',
        levelCount: storyLevelIds.length,
        maxTurns,
        randomSeed,
        source: 'tools/campaign_balance_simulator.mjs'
      },
      learningPriority: [...progressiveLearningPriority],
      results,
      summary: summarizeProgressiveReport(results, player)
    };
  });
}

export async function runCampaignRuntimeSmoke(options = {}) {
  const projectRoot = path.resolve(options.projectRoot || defaultProjectRoot);
  const randomSeed = String(options.randomSeed || 'campaign-runtime-smoke-v1');

  return withSeededRandom(randomSeed, async () => {
    const { CoreEngine } = await importCoreEngineClass(projectRoot);
    const modules = await importRuntimeModules(projectRoot);
    const levels = await readJson(projectRoot, 'assets/map_packs/current/story_pack_v1/levels.json');
    const data = {
      levels,
      enemies: await readJson(projectRoot, 'assets/data/enemies.json'),
      player: await readJson(projectRoot, 'assets/data/player.json'),
      buffs: await readJson(projectRoot, 'assets/data/buffs_v2_7.json'),
      slotLayouts: await readJson(projectRoot, 'assets/data/slot_layouts.json')
    };
    data.skillMaps = buildRuntimeSkillMaps(
      await readJson(projectRoot, 'assets/data/skills_melee_v4_5.json'),
      await readJson(projectRoot, 'assets/data/skills_enemy_v1.json')
    );

    const results = [];
    for (const levelId of storyLevelIds) {
      results.push(await runRuntimeSmokeLevel({
        CoreEngine,
        modules,
        data,
        levelId,
        build: playerBuilds[1]
      }));
    }

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        mode: 'runtime_smoke',
        levelCount: storyLevelIds.length,
        randomSeed,
        source: 'tools/campaign_balance_simulator.mjs'
      },
      results,
      summary: summarizeRuntimeSmoke(results)
    };
  });
}

export async function writeCampaignBalanceReport(report, { reportPath } = {}) {
  const resolvedReportPath = path.resolve(reportPath || path.join(defaultProjectRoot, 'test-results/campaign-balance-report.json'));
  const parsedReportPath = path.parse(resolvedReportPath);
  const defaultReportPath = path.resolve(defaultProjectRoot, 'test-results/campaign-balance-report.json');
  const summaryPath = resolvedReportPath === defaultReportPath
    ? path.join(parsedReportPath.dir, 'campaign-balance-summary.md')
    : path.join(parsedReportPath.dir, `${parsedReportPath.name}-summary.md`);
  await fs.mkdir(path.dirname(resolvedReportPath), { recursive: true });
  await fs.writeFile(resolvedReportPath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(summaryPath, renderSummary(report));
  return { reportPath: resolvedReportPath, summaryPath };
}

function parseCliArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--report') {
      out.reportPath = argv[index + 1];
      index += 1;
    } else if (arg === '--max-turns') {
      out.maxTurns = Number(argv[index + 1]);
      index += 1;
    } else if (arg === '--seed') {
      out.randomSeed = argv[index + 1];
      index += 1;
    } else if (arg === '--mode') {
      out.mode = argv[index + 1];
      index += 1;
    }
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = parseCliArgs(process.argv.slice(2));
  const runner = args.mode === 'progressive'
    ? runProgressiveCampaignSimulation
    : runCampaignBalanceSimulation;
  const report = await runner({
    projectRoot: defaultProjectRoot,
    maxTurns: args.maxTurns,
    randomSeed: args.randomSeed
  });
  const written = await writeCampaignBalanceReport(report, { reportPath: args.reportPath });
  console.log(`Wrote ${written.reportPath}`);
  console.log(`Wrote ${written.summaryPath}`);
}
