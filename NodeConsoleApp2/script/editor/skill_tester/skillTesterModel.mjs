const SKILL_TEST_RECORD_ROOT = 'DOC/CODEX_DOC/05_测试文档/05_Skill技能系统测试记录';

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function compareByOrder(a, b) {
  return toFiniteNumber(a?.flow?.order, 0) - toFiniteNumber(b?.flow?.order, 0)
    || String(a?.id || '').localeCompare(String(b?.id || ''));
}

function getSkillKp(skill) {
  return Math.max(0, toFiniteNumber(skill?.unlock?.cost?.kp, 0));
}

function getSkillAp(skill) {
  return Math.max(0, toFiniteNumber(skill?.costs?.ap ?? skill?.cost, 0));
}

function getSkillTier(skill) {
  return toFiniteNumber(skill?.editorMeta?.growthTier ?? skill?.tier, 0);
}

function getStoryLevels(levelsDocument) {
  return Object.values(levelsDocument?.levels || {})
    .filter(level => level?.flow?.kind === 'story')
    .sort(compareByOrder);
}

export function listStoryLevelOptions(levelsDocument) {
  return getStoryLevels(levelsDocument).map((level, index) => ({
    levelIndex: index + 1,
    id: level.id,
    name: level.name || level.title || level.id,
    nodeLabel: level.flow?.nodeLabel || `${index + 1}`,
    order: toFiniteNumber(level.flow?.order, index + 1),
    kp: Math.max(0, toFiniteNumber(level.rewards?.kp, 0))
  }));
}

function normalizeEnemyCatalog(enemyDocuments = []) {
  const catalog = new Map();
  const docs = Array.isArray(enemyDocuments) ? enemyDocuments : [enemyDocuments];

  function addEnemy(enemy) {
    if (!enemy || typeof enemy !== 'object' || !enemy.id) return;
    catalog.set(enemy.id, enemy);
  }

  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    if (Array.isArray(doc)) {
      doc.forEach(addEnemy);
      continue;
    }
    if (Array.isArray(doc.enemies)) {
      doc.enemies.forEach(addEnemy);
      continue;
    }
    if (doc.enemies && typeof doc.enemies === 'object') {
      Object.values(doc.enemies).forEach(addEnemy);
      continue;
    }
    Object.entries(doc).forEach(([key, value]) => {
      if (key.startsWith('$') || key === 'meta') return;
      addEnemy(value);
    });
  }

  return catalog;
}

export function listEnemyOptions(enemyDocuments = []) {
  return [...normalizeEnemyCatalog(enemyDocuments).values()]
    .map(enemy => ({
      id: enemy.id,
      name: enemy.name || enemy.id,
      hp: Math.max(0, toFiniteNumber(enemy.stats?.hp ?? enemy.stats?.maxHp, 0)),
      maxHp: Math.max(0, toFiniteNumber(enemy.stats?.maxHp ?? enemy.stats?.hp, 0)),
      armorTotal: summarizeArmor(enemy.bodyParts)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function resolveLevelEnemyId(level, levelsDocument) {
  const primaryId = level?.primaryEnemy?.templateId;
  if (primaryId) return primaryId;

  const wavePoolId = Array.isArray(level?.waves)
    ? level.waves.find(wave => wave?.enemyPoolId)?.enemyPoolId
    : null;
  const pool = wavePoolId ? levelsDocument?.enemyPools?.[wavePoolId] : null;
  const member = Array.isArray(pool?.members) ? pool.members[0] : null;
  return member?.templateId || null;
}

function summarizeArmor(bodyParts = {}) {
  return Object.values(bodyParts || {}).reduce((sum, part) => sum + Math.max(0, toFiniteNumber(part?.current, 0)), 0);
}

function makeFallbackEnemy(enemyId) {
  return {
    id: enemyId || 'enemy_unknown',
    name: enemyId || '未找到敌人',
    stats: { hp: 100, maxHp: 100, ap: 3 },
    bodyParts: {
      chest: { current: 20, max: 20, weakness: 1 }
    },
    missingFromCatalog: true
  };
}

function getPlayerInitialSkillPoints(playerDocument) {
  const skills = playerDocument?.default?.skills || playerDocument?.skills || null;
  return Math.max(0, Math.trunc(toFiniteNumber(skills?.skillPoints, 0)));
}

function calculateKpBudget({
  storyLevels,
  levelIndex,
  kpMode,
  assumedInitialKp,
  assumedKpPerLevel,
  manualKp,
  initialSkillPoints
}) {
  const normalizedIndex = Math.max(1, Math.min(storyLevels.length || 1, Math.trunc(toFiniteNumber(levelIndex, 1))));
  const actualThroughCurrent = storyLevels
    .slice(0, normalizedIndex)
    .reduce((sum, level) => sum + Math.max(0, toFiniteNumber(level?.rewards?.kp, 0)), 0);
  const actualBeforeCurrent = storyLevels
    .slice(0, Math.max(0, normalizedIndex - 1))
    .reduce((sum, level) => sum + Math.max(0, toFiniteNumber(level?.rewards?.kp, 0)), 0);

  if (kpMode === 'manual') {
    return {
      kpBudget: Math.max(0, Math.trunc(toFiniteNumber(manualKp, 0))),
      actualThroughCurrent,
      actualBeforeCurrent
    };
  }
  if (kpMode === 'actual_player_plus_rewards') {
    return {
      kpBudget: Math.max(0, Math.trunc(toFiniteNumber(initialSkillPoints, 0))) + actualThroughCurrent,
      actualThroughCurrent,
      actualBeforeCurrent
    };
  }
  if (kpMode === 'actual_cumulative') {
    return {
      kpBudget: actualThroughCurrent,
      actualThroughCurrent,
      actualBeforeCurrent
    };
  }
  return {
    kpBudget: Math.max(0, Math.trunc(toFiniteNumber(assumedInitialKp, 5)))
      + normalizedIndex * Math.max(0, toFiniteNumber(assumedKpPerLevel, 3)),
    actualThroughCurrent,
    actualBeforeCurrent
  };
}

export function resolveLevelTestContext({
  levelsDocument,
  enemyDocuments = [],
  playerDocument = null,
  levelIndex = 1,
  enemyIdOverride = null,
  kpMode = 'assumed_per_level',
  assumedInitialKp = 5,
  assumedKpPerLevel = 3,
  manualKp = 0
} = {}) {
  const storyLevels = getStoryLevels(levelsDocument);
  if (storyLevels.length === 0) {
    throw new Error('levelsDocument does not contain story levels.');
  }

  const normalizedIndex = Math.max(1, Math.min(storyLevels.length, Math.trunc(toFiniteNumber(levelIndex, 1))));
  const level = storyLevels[normalizedIndex - 1];
  const initialSkillPoints = getPlayerInitialSkillPoints(playerDocument);
  const kp = calculateKpBudget({
    storyLevels,
    levelIndex: normalizedIndex,
    kpMode,
    assumedInitialKp,
    assumedKpPerLevel,
    manualKp,
    initialSkillPoints
  });
  const enemyCatalog = normalizeEnemyCatalog(enemyDocuments);
  const requestedEnemyId = String(enemyIdOverride || '').trim();
  const enemyId = requestedEnemyId || resolveLevelEnemyId(level, levelsDocument);
  const enemy = deepClone(enemyCatalog.get(enemyId) || makeFallbackEnemy(enemyId));

  return {
    levelIndex: normalizedIndex,
    storyLevels,
    level,
    enemyId,
    enemy,
    kpMode,
    assumedInitialKp,
    assumedKpPerLevel,
    initialSkillPoints,
    ...kp,
    warnings: enemy.missingFromCatalog
      ? [{ id: 'enemy_missing', level: 'warning', text: `敌人 ${enemyId || '(empty)'} 未在敌人包中找到，已使用木桩默认值。` }]
      : []
  };
}

function getPrerequisites(skill) {
  return Array.isArray(skill?.prerequisites)
    ? skill.prerequisites.filter(Boolean).map(String)
    : [];
}

function orderSkillIds(ids, orderById) {
  return [...ids].sort((a, b) => (orderById.get(a) ?? 9999) - (orderById.get(b) ?? 9999) || a.localeCompare(b));
}

function summarizeBuildMechanics(skills) {
  const summary = {
    appliesBleed: false,
    readsBuffRemaining: false,
    consumesBuffRemaining: false,
    heals: false,
    controls: false
  };

  for (const skill of skills) {
    for (const row of skill?.buffRefs?.apply || []) {
      if (row?.buffId === 'buff_bleed' || row?.buffId === 'buff_tear_wound') summary.appliesBleed = true;
      if (['buff_slow', 'buff_stun', 'debuff_weak'].includes(row?.buffId)) summary.controls = true;
    }
    for (const row of skill?.buffRefs?.remove || []) {
      if (row?.consumeRemaining !== undefined) summary.consumesBuffRemaining = true;
    }
    for (const action of skill?.actions || []) {
      const effect = action?.effect || {};
      if (effect.effectType === 'HEAL') summary.heals = true;
      if (effect.amountType === 'BUFF_REMAINING' || effect.amountType === 'BUFF_STACKS') summary.readsBuffRemaining = true;
    }
  }

  return summary;
}

function scoreBuild(build, kpBudget) {
  const kpUse = kpBudget > 0 ? build.kpUsed / kpBudget : 0;
  const mechanicScore = Object.values(build.mechanics).filter(Boolean).length * 8;
  return Math.round(kpUse * 45 + build.skillIds.length * 4 + build.maxTier * 3 + mechanicScore);
}

export function enumeratePurchasableBuilds(skills, { kpBudget = 0, maxBuilds = 3000 } = {}) {
  const normalizedSkills = (Array.isArray(skills) ? skills : [])
    .filter(skill => skill?.id)
    .map(skill => ({ ...skill, _kp: getSkillKp(skill), _ap: getSkillAp(skill), _tier: getSkillTier(skill) }))
    .sort((a, b) => a._tier - b._tier || a._kp - b._kp || String(a.name || a.id).localeCompare(String(b.name || b.id)));
  const skillById = new Map(normalizedSkills.map(skill => [skill.id, skill]));
  const orderById = new Map(normalizedSkills.map((skill, index) => [skill.id, index]));
  const budget = Math.max(0, toFiniteNumber(kpBudget, 0));
  const states = new Map();
  const queue = [{ ids: [], selected: new Set(), kpUsed: 0 }];
  states.set('', queue[0]);

  for (let cursor = 0; cursor < queue.length && states.size <= maxBuilds * 8; cursor += 1) {
    const state = queue[cursor];
    for (const skill of normalizedSkills) {
      if (state.selected.has(skill.id)) continue;
      if (state.kpUsed + skill._kp > budget) continue;
      const prerequisites = getPrerequisites(skill);
      if (!prerequisites.every(id => state.selected.has(id) && skillById.has(id))) continue;

      const nextSelected = new Set(state.selected);
      nextSelected.add(skill.id);
      const nextIds = orderSkillIds(nextSelected, orderById);
      const key = nextIds.join('|');
      if (states.has(key)) continue;

      const nextState = {
        ids: nextIds,
        selected: nextSelected,
        kpUsed: state.kpUsed + skill._kp
      };
      states.set(key, nextState);
      queue.push(nextState);
    }
  }

  const builds = [...states.values()]
    .filter(state => state.ids.length > 0)
    .map(state => {
      const buildSkills = state.ids.map(id => skillById.get(id)).filter(Boolean);
      const mechanics = summarizeBuildMechanics(buildSkills);
      const build = {
        skillIds: state.ids,
        skills: buildSkills,
        kpUsed: state.kpUsed,
        kpRemaining: Math.max(0, budget - state.kpUsed),
        maxTier: buildSkills.reduce((max, skill) => Math.max(max, skill._tier || 0), 0),
        mechanics
      };
      build.score = scoreBuild(build, budget);
      return build;
    })
    .sort((a, b) => b.score - a.score || b.kpUsed - a.kpUsed || b.skillIds.length - a.skillIds.length);

  return builds.slice(0, Math.max(1, maxBuilds));
}

export function generateTurnCombos(skills, { apBudget = 5, maxCombos = 80 } = {}) {
  const budget = Math.max(0, toFiniteNumber(apBudget, 5));
  const normalizedSkills = (Array.isArray(skills) ? skills : [])
    .filter(skill => skill?.id && getSkillAp(skill) <= budget)
    .map(skill => ({ ...skill, _ap: getSkillAp(skill) }))
    .sort((a, b) => a._ap - b._ap || String(a.name || a.id).localeCompare(String(b.name || b.id)));
  const combos = [];

  function visit(startIndex, picked, apUsed) {
    if (picked.length > 0) {
      combos.push({
        skillIds: picked.map(skill => skill.id),
        skills: [...picked],
        apUsed,
        apRemaining: Math.max(0, budget - apUsed)
      });
    }
    if (combos.length > maxCombos * 80) return;
    for (let index = startIndex; index < normalizedSkills.length; index += 1) {
      const skill = normalizedSkills[index];
      if (apUsed + skill._ap > budget) continue;
      picked.push(skill);
      visit(index + 1, picked, apUsed + skill._ap);
      picked.pop();
    }
  }

  visit(0, [], 0);
  return combos
    .sort((a, b) => b.apUsed - a.apUsed || b.skillIds.length - a.skillIds.length || a.skillIds.join(',').localeCompare(b.skillIds.join(',')))
    .slice(0, Math.max(1, maxCombos));
}

function createBodyParts(parts) {
  const source = parts && typeof parts === 'object' ? parts : {};
  const cloned = deepClone(source);
  if (Object.keys(cloned).length > 0) return cloned;
  return { chest: { current: 0, max: 0, weakness: 1 } };
}

function createCombatant(entity, fallbackHp = 100) {
  const maxHp = toFiniteNumber(entity?.stats?.maxHp ?? entity?.stats?.hp ?? entity?.maxHp ?? entity?.hp, fallbackHp);
  const hp = toFiniteNumber(entity?.stats?.hp ?? entity?.hp, maxHp);
  return {
    id: entity?.id || 'entity',
    name: entity?.name || entity?.id || 'entity',
    hp,
    maxHp,
    bodyParts: createBodyParts(entity?.bodyParts),
    buffs: {}
  };
}

function getArmorTotal(entity) {
  return summarizeArmor(entity?.bodyParts);
}

function snapshotEntity(entity) {
  return {
    hp: Math.round(entity.hp),
    maxHp: Math.round(entity.maxHp),
    armorTotal: Math.round(getArmorTotal(entity)),
    bodyParts: deepClone(entity.bodyParts),
    buffs: deepClone(entity.buffs)
  };
}

function getBuffRemaining(entity, buffId) {
  return Math.max(0, toFiniteNumber(entity?.buffs?.[buffId]?.remaining, 0));
}

function getBuffStacks(entity, buffId) {
  return Math.max(0, toFiniteNumber(entity?.buffs?.[buffId]?.stacks, 0));
}

function addBuff(entity, row) {
  if (!entity || !row?.buffId) return null;
  const buffId = row.buffId;
  const existing = entity.buffs[buffId] || { id: buffId, remaining: 0, stacks: 0 };
  const duration = Math.max(0, toFiniteNumber(
    row.extendBy ?? row.duration ?? row.params?.buff_duration ?? row.params?.duration,
    buffId === 'buff_bleed' ? 1 : 0
  ));
  const strategy = row.stackStrategy || (buffId === 'buff_bleed' ? 'extend' : 'refresh');
  const stacks = Math.max(1, toFiniteNumber(row.stacks, existing.stacks || 1));

  let remaining = existing.remaining || 0;
  if (strategy === 'extend') {
    remaining += duration;
  } else if (strategy === 'replace') {
    remaining = duration;
  } else {
    remaining = Math.max(remaining, duration);
  }

  entity.buffs[buffId] = {
    id: buffId,
    remaining,
    stacks: Math.max(existing.stacks || 0, stacks)
  };
  return entity.buffs[buffId];
}

function consumeBuffRemaining(entity, buffId, amount) {
  const buff = entity?.buffs?.[buffId];
  if (!buff) return { consumed: 0, remaining: 0, removed: false };
  const consumed = Math.min(Math.max(0, toFiniteNumber(amount, 0)), Math.max(0, toFiniteNumber(buff.remaining, 0)));
  buff.remaining = Math.max(0, buff.remaining - consumed);
  const removed = buff.remaining <= 0;
  if (removed) delete entity.buffs[buffId];
  return { consumed, remaining: removed ? 0 : buff.remaining, removed };
}

function tickBuffRemaining(entity, buffId, amount = 1) {
  const buff = entity?.buffs?.[buffId];
  if (!buff) return;
  buff.remaining = Math.max(0, toFiniteNumber(buff.remaining, 0) - amount);
  if (buff.remaining <= 0) delete entity.buffs[buffId];
}

function pickTargetPart(entity, skill, effect) {
  const override = effect?.partOverride?.parts?.[0];
  if (override && entity.bodyParts?.[override]) return override;
  const selected = skill?.target?.selection?.selectedParts?.find(part => entity.bodyParts?.[part]);
  if (selected) return selected;
  const candidate = skill?.target?.selection?.candidateParts?.find(part => entity.bodyParts?.[part] && toFiniteNumber(entity.bodyParts[part]?.current, 0) > 0);
  if (candidate) return candidate;
  const byArmor = Object.entries(entity.bodyParts || {})
    .sort((a, b) => toFiniteNumber(b[1]?.current, 0) - toFiniteNumber(a[1]?.current, 0));
  return byArmor[0]?.[0] || 'chest';
}

function resolveAmountSourceOwner({ owner, player, enemy, skillTarget, target }) {
  if (owner === 'actor' || owner === 'self') return player;
  if (owner === 'skillTarget') return skillTarget || enemy;
  if (owner === 'target') return target || enemy;
  return target || enemy;
}

function computeEffectAmount(effect, { player, enemy, target, skillTarget, bodyPart }) {
  const amount = toFiniteNumber(effect?.amount, 0);
  const amountType = effect?.amountType || 'ABS';
  if (amountType === 'ABS') return amount;

  if (amountType === 'BUFF_REMAINING' || amountType === 'BUFF_STACKS') {
    const source = effect?.amountSource || {};
    const owner = resolveAmountSourceOwner({
      owner: source.owner,
      player,
      enemy,
      skillTarget,
      target
    });
    const rawValue = amountType === 'BUFF_REMAINING'
      ? getBuffRemaining(owner, source.buffId)
      : getBuffStacks(owner, source.buffId);
    const fallback = toFiniteNumber(source.missingAs, 0);
    const maxRead = Number(source.maxRead);
    const readable = Number.isFinite(maxRead) && maxRead >= 0
      ? Math.min(rawValue || fallback, maxRead)
      : (rawValue || fallback);
    return readable * toFiniteNumber(source.multiplier ?? amount ?? 1, 0);
  }

  const part = bodyPart ? target?.bodyParts?.[bodyPart] : null;
  if (amountType === 'PCT_CURRENT') {
    const base = effect?.effectType === 'DMG_ARMOR' || effect?.effectType === 'ARMOR_ADD'
      ? toFiniteNumber(part?.current, 0)
      : toFiniteNumber(target?.hp, 0);
    return base * amount / 100;
  }
  if (amountType === 'PCT_MAX') {
    const base = effect?.effectType === 'DMG_ARMOR' || effect?.effectType === 'ARMOR_ADD'
      ? toFiniteNumber(part?.max, 0)
      : toFiniteNumber(target?.maxHp, 0);
    return base * amount / 100;
  }
  return amount;
}

function applyHpDelta(entity, delta) {
  const before = entity.hp;
  entity.hp = Math.max(0, Math.min(entity.maxHp, entity.hp + delta));
  return entity.hp - before;
}

function applyArmorDamage(entity, bodyPart, amount) {
  const part = entity.bodyParts?.[bodyPart];
  const raw = Math.max(0, toFiniteNumber(amount, 0));
  if (!part) {
    const hpDelta = applyHpDelta(entity, -raw);
    return { armorDamage: 0, hpDamage: Math.abs(hpDelta), bodyPart: null };
  }
  const current = Math.max(0, toFiniteNumber(part.current, 0));
  const armorDamage = Math.min(current, raw);
  part.current = Math.max(0, current - armorDamage);
  if (part.current <= 0) part.status = 'BROKEN';
  const overflow = Math.max(0, raw - current);
  const hpDelta = overflow > 0 ? applyHpDelta(entity, -overflow) : 0;
  return { armorDamage, hpDamage: Math.abs(hpDelta), bodyPart };
}

function applyArmorAdd(entity, bodyPart, amount) {
  const part = entity.bodyParts?.[bodyPart];
  if (!part) return { armorGain: 0, bodyPart: null };
  const before = toFiniteNumber(part.current, 0);
  const max = toFiniteNumber(part.max, before);
  part.current = Math.max(0, Math.min(max, before + Math.max(0, toFiniteNumber(amount, 0))));
  if (part.current > 0) part.status = 'NORMAL';
  return { armorGain: part.current - before, bodyPart };
}

function resolveActionTarget(actionDef, player, enemy) {
  const spec = actionDef?.target?.spec;
  if (actionDef?.target?.binding?.mode === 'explicit' && spec?.subject === 'SUBJECT_SELF') {
    return player;
  }
  return enemy;
}

function validateSkillRequirements(skill, enemy) {
  const targetBuff = skill?.requirements?.targetBuff;
  if (targetBuff?.buffId) {
    const remaining = getBuffRemaining(enemy, targetBuff.buffId);
    const stacks = getBuffStacks(enemy, targetBuff.buffId);
    const minRemaining = toFiniteNumber(targetBuff.minRemaining, 0);
    const minStacks = toFiniteNumber(targetBuff.minStacks, 0);
    if (minRemaining > 0 && remaining < minRemaining) {
      return { ok: false, reason: `需要 ${targetBuff.buffId} 剩余回合 >= ${minRemaining}` };
    }
    if (minStacks > 0 && stacks < minStacks) {
      return { ok: false, reason: `需要 ${targetBuff.buffId} 层数 >= ${minStacks}` };
    }
    if (minRemaining <= 0 && minStacks <= 0 && remaining <= 0 && stacks <= 0) {
      return { ok: false, reason: `需要 ${targetBuff.buffId}` };
    }
  }

  const hpBelow = Number(skill?.requirements?.targetHpPercentBelow);
  if (Number.isFinite(hpBelow)) {
    const percent = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 0;
    if (percent >= hpBelow) {
      return { ok: false, reason: `需要目标 HP 低于 ${Math.round(hpBelow * 100)}%` };
    }
  }

  return { ok: true };
}

function applySkillBuffRefs(skill, player, enemy, events) {
  for (const row of skill?.buffRefs?.apply || []) {
    const target = row?.target === 'self' ? player : enemy;
    const buff = addBuff(target, row);
    if (buff) {
      events.push({
        type: 'buff_apply',
        skillId: skill.id,
        buffId: row.buffId,
        target: target === player ? 'player' : 'enemy',
        remaining: buff.remaining
      });
    }
  }
  for (const row of skill?.buffRefs?.remove || []) {
    const target = row?.target === 'self' ? player : enemy;
    if (row?.consumeRemaining !== undefined) {
      const outcome = consumeBuffRemaining(target, row.buffId, row.consumeRemaining);
      events.push({
        type: 'buff_consume',
        skillId: skill.id,
        buffId: row.buffId,
        target: target === player ? 'player' : 'enemy',
        ...outcome
      });
      continue;
    }
    if (target?.buffs?.[row?.buffId]) {
      delete target.buffs[row.buffId];
      events.push({
        type: 'buff_remove',
        skillId: skill.id,
        buffId: row.buffId,
        target: target === player ? 'player' : 'enemy'
      });
    }
  }
}

function executeSkill(skill, player, enemy) {
  const events = [];
  const actions = Array.isArray(skill?.actions) ? skill.actions : [];
  for (const actionDef of actions) {
    const target = resolveActionTarget(actionDef, player, enemy);
    const effect = actionDef?.effect || {};
    const repeat = Math.max(1, Math.trunc(toFiniteNumber(effect?.repeat?.count, 1)));
    for (let index = 0; index < repeat; index += 1) {
      const bodyPart = pickTargetPart(target, skill, effect);
      const amount = computeEffectAmount(effect, {
        player,
        enemy,
        target,
        skillTarget: enemy,
        bodyPart
      });

      switch (effect.effectType) {
      case 'DMG_ARMOR': {
        const outcome = applyArmorDamage(target, bodyPart, amount);
        events.push({ type: 'armor_damage', skillId: skill.id, amount, ...outcome });
        break;
      }
      case 'DMG_HP': {
        const hpDelta = applyHpDelta(target, -Math.max(0, amount));
        events.push({
          type: 'hp_damage',
          skillId: skill.id,
          target: target === player ? 'player' : 'enemy',
          hpDamage: Math.abs(hpDelta)
        });
        break;
      }
      case 'HEAL': {
        const hpDelta = applyHpDelta(target, Math.max(0, amount));
        events.push({
          type: 'heal',
          skillId: skill.id,
          target: target === player ? 'player' : 'enemy',
          heal: Math.max(0, hpDelta)
        });
        break;
      }
      case 'ARMOR_ADD': {
        const outcome = applyArmorAdd(target, bodyPart, amount);
        events.push({ type: 'armor_add', skillId: skill.id, amount, ...outcome });
        break;
      }
      default:
        events.push({ type: 'unsupported_effect', skillId: skill.id, effectType: effect.effectType || '(empty)' });
        break;
      }
    }
  }

  applySkillBuffRefs(skill, player, enemy, events);
  return events;
}

function triggerEnemyActionPre(enemy, events) {
  if (getBuffRemaining(enemy, 'buff_tear_wound') <= 0) return;
  const buff = addBuff(enemy, {
    buffId: 'buff_bleed',
    target: 'enemy',
    duration: 2,
    stackStrategy: 'extend',
    extendBy: 2
  });
  events.push({
    type: 'buff_trigger',
    buffId: 'buff_tear_wound',
    appliedBuffId: 'buff_bleed',
    target: 'enemy',
    remaining: buff?.remaining ?? 0
  });
}

function settleTurnEnd(enemy, events) {
  if (getBuffRemaining(enemy, 'buff_bleed') > 0) {
    const hpDelta = applyHpDelta(enemy, -5);
    events.push({
      type: 'buff_tick',
      buffId: 'buff_bleed',
      target: 'enemy',
      hpDamage: Math.abs(hpDelta)
    });
    tickBuffRemaining(enemy, 'buff_bleed', 1);
  }

  for (const buffId of Object.keys(enemy.buffs)) {
    if (buffId === 'buff_bleed') continue;
    tickBuffRemaining(enemy, buffId, 1);
  }
}

function makeDelta(before, after) {
  return {
    hp: after.hp - before.hp,
    armor: after.armorTotal - before.armorTotal,
    bleed: getBuffRemaining({ buffs: after.buffs }, 'buff_bleed') - getBuffRemaining({ buffs: before.buffs }, 'buff_bleed')
  };
}

function collectSimulationFindings({ turns, killed, final, apBudget }) {
  const findings = [];
  const averageApUsed = turns.length
    ? turns.reduce((sum, turn) => sum + turn.apUsed, 0) / turns.length
    : 0;
  const skippedCount = turns.reduce((sum, turn) => sum + turn.skipped.length, 0);
  const usedSkillIds = new Set(turns.flatMap(turn => turn.usedSkillIds));
  const hasBleedWindow = turns.some(turn => turn.after.buffs?.buff_bleed?.remaining > 0 || turn.events.some(event => event.buffId === 'buff_bleed'));
  const hasConsume = turns.some(turn => turn.events.some(event => event.type === 'buff_consume'));

  if (apBudget > 0 && averageApUsed / apBudget < 0.75) {
    findings.push({
      id: 'ap_underuse',
      level: 'warning',
      text: `平均每回合只使用 ${averageApUsed.toFixed(1)} / ${apBudget} AP，循环可能没有吃满行动资源。`
    });
  }
  if (usedSkillIds.size <= 2) {
    findings.push({
      id: 'low_skill_diversity',
      level: 'warning',
      text: '循环使用的技能种类偏少，可能形成单调重复。'
    });
  }
  if (skippedCount > 0) {
    findings.push({
      id: 'skipped_by_requirements',
      level: 'warning',
      text: `测试中有 ${skippedCount} 次技能因 AP 或释放条件不足被跳过。`
    });
  }
  if (hasBleedWindow && !hasConsume) {
    findings.push({
      id: 'bleed_no_consume',
      level: 'info',
      text: '循环建立了流血窗口，但没有消耗窗口的终结动作。'
    });
  }
  if (!killed) {
    findings.push({
      id: 'enemy_survived',
      level: 'warning',
      text: `回合上限结束后敌人仍剩 ${Math.round(final.enemy.hp)} HP。`
    });
  }

  return findings;
}

export function simulateSkillLoop({
  skills,
  loopSkillIds,
  enemy,
  player = null,
  apBudget = 5,
  maxTurns = 12
} = {}) {
  const skillById = new Map((Array.isArray(skills) ? skills : []).map(skill => [skill.id, skill]));
  const loopSkills = (Array.isArray(loopSkillIds) ? loopSkillIds : [])
    .map(id => skillById.get(id))
    .filter(Boolean);
  const playerState = createCombatant(player || {
    id: 'player',
    name: '玩家',
    stats: { hp: 100, maxHp: 100 },
    bodyParts: { chest: { current: 20, max: 20, weakness: 1 } }
  });
  const enemyState = createCombatant(enemy, 100);
  const turns = [];
  const turnLimit = Math.max(1, Math.trunc(toFiniteNumber(maxTurns, 12)));
  const budget = Math.max(0, toFiniteNumber(apBudget, 5));

  for (let turn = 1; turn <= turnLimit && enemyState.hp > 0; turn += 1) {
    const before = snapshotEntity(enemyState);
    const usedSkillIds = [];
    const skipped = [];
    const events = [];
    let apUsed = 0;

    for (const skill of loopSkills) {
      const ap = getSkillAp(skill);
      if (apUsed + ap > budget) {
        skipped.push({ skillId: skill.id, name: skill.name || skill.id, reason: 'AP 不足' });
        continue;
      }
      const requirement = validateSkillRequirements(skill, enemyState);
      if (!requirement.ok) {
        skipped.push({ skillId: skill.id, name: skill.name || skill.id, reason: requirement.reason });
        continue;
      }
      apUsed += ap;
      usedSkillIds.push(skill.id);
      events.push(...executeSkill(skill, playerState, enemyState));
      if (enemyState.hp <= 0) break;
    }

    if (enemyState.hp > 0) {
      triggerEnemyActionPre(enemyState, events);
      settleTurnEnd(enemyState, events);
    }

    const after = snapshotEntity(enemyState);
    turns.push({
      turn,
      usedSkillIds,
      usedSkillNames: usedSkillIds.map(id => skillById.get(id)?.name || id),
      apUsed,
      apRemaining: Math.max(0, budget - apUsed),
      skipped,
      before,
      after,
      delta: makeDelta(before, after),
      events
    });
  }

  const final = {
    player: snapshotEntity(playerState),
    enemy: snapshotEntity(enemyState)
  };
  const killed = enemyState.hp <= 0;
  const averageApUsed = turns.length
    ? turns.reduce((sum, turn) => sum + turn.apUsed, 0) / turns.length
    : 0;

  const result = {
    killed,
    turnsToKill: killed ? turns.length : null,
    turns,
    final,
    metrics: {
      averageApUsed,
      averageApUsage: budget > 0 ? averageApUsed / budget : 0,
      totalHpDamage: Math.max(0, toFiniteNumber(enemy?.stats?.hp ?? enemy?.hp, final.enemy.maxHp) - final.enemy.hp),
      finalArmorTotal: final.enemy.armorTotal
    }
  };
  result.findings = collectSimulationFindings({ turns, killed, final, apBudget: budget });
  return result;
}

function scoreCandidate(simulation, build, combo, context) {
  const killScore = simulation.killed
    ? Math.max(20, 70 - (simulation.turnsToKill || 0) * 4)
    : Math.max(0, 25 * (1 - simulation.final.enemy.hp / Math.max(1, simulation.final.enemy.maxHp)));
  const apScore = Math.min(1, simulation.metrics.averageApUsage) * 18;
  const kpScore = context.kpBudget > 0 ? (build.kpUsed / context.kpBudget) * 10 : 0;
  const diversityScore = Math.min(4, new Set(combo.skillIds).size) * 4;
  const issuePenalty = simulation.findings.filter(item => item.level === 'warning').length * 7;
  return Math.round(killScore + apScore + kpScore + diversityScore - issuePenalty);
}

export function filterSkillsForFocus(skills, focus = 'sword') {
  const list = Array.isArray(skills) ? skills : [];
  if (focus === 'all') return list;
  if (focus === 'bleed') {
    return list.filter(skill => {
      const track = String(skill?.editorMeta?.growthTrack || '');
      const buffRefs = JSON.stringify(skill?.buffRefs || {});
      const actions = JSON.stringify(skill?.actions || {});
      return track.includes('bleed') || buffRefs.includes('buff_bleed') || buffRefs.includes('buff_tear_wound') || actions.includes('buff_bleed');
    });
  }
  if (focus === 'sword') {
    return list.filter(skill => {
      const track = String(skill?.editorMeta?.growthTrack || '');
      const id = String(skill?.id || '');
      const name = String(skill?.name || '');
      return track.startsWith('sword') || id.includes('sword') || name.includes('剑') || name.includes('斩') || name.includes('割') || name.includes('血');
    });
  }
  return list;
}

export function normalizeSkillPack(skillPack) {
  if (Array.isArray(skillPack)) return skillPack;
  if (Array.isArray(skillPack?.skills)) return skillPack.skills;
  return [];
}

export function analyzeSkillTestScenario({
  levelsDocument,
  enemyDocuments,
  playerDocument = null,
  skillPack,
  levelIndex = 5,
  enemyIdOverride = null,
  kpMode = 'assumed_per_level',
  assumedInitialKp = 5,
  assumedKpPerLevel = 3,
  manualKp = 0,
  apBudget = 5,
  maxTurns = 12,
  focus = 'sword',
  maxBuilds = 80,
  maxCombosPerBuild = 16,
  maxCandidates = 10
} = {}) {
  const context = resolveLevelTestContext({
    levelsDocument,
    enemyDocuments,
    playerDocument,
    levelIndex,
    enemyIdOverride,
    kpMode,
    assumedInitialKp,
    assumedKpPerLevel,
    manualKp
  });
  const allSkills = normalizeSkillPack(skillPack);
  const focusedSkills = filterSkillsForFocus(allSkills, focus);
  const builds = enumeratePurchasableBuilds(focusedSkills, { kpBudget: context.kpBudget, maxBuilds });
  const candidates = [];

  for (const build of builds.slice(0, maxBuilds)) {
    const combos = generateTurnCombos(build.skills, { apBudget, maxCombos: maxCombosPerBuild });
    for (const combo of combos) {
      const simulation = simulateSkillLoop({
        skills: build.skills,
        loopSkillIds: combo.skillIds,
        enemy: context.enemy,
        apBudget,
        maxTurns
      });
      candidates.push({
        build,
        combo,
        simulation,
        score: scoreCandidate(simulation, build, combo, { ...context, apBudget })
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || (a.simulation.turnsToKill ?? 999) - (b.simulation.turnsToKill ?? 999));

  const modelComparableKp = context.initialSkillPoints + context.actualThroughCurrent;
  const findings = [
    ...context.warnings,
    ...(context.kpMode === 'assumed_per_level' && Math.abs(context.kpBudget - modelComparableKp) >= 6
      ? [{
          id: 'kp_model_gap',
          level: 'info',
          text: `平衡模型 KP=${context.kpBudget}，当前玩家初始+关卡累计 KP=${modelComparableKp}，两者差异需要单独审定。`
        }]
      : []),
    ...(candidates[0]?.simulation?.findings || [])
  ];

  return {
    context: {
      ...context,
      enemy: snapshotEntity(createCombatant(context.enemy)),
      enemyName: context.enemy?.name || context.enemyId
    },
    allSkillCount: allSkills.length,
    focusedSkillCount: focusedSkills.length,
    builds,
    candidates: candidates.slice(0, Math.max(1, maxCandidates)),
    best: candidates[0] || null,
    findings
  };
}

export function createSkillTestRecordPath(timestamp) {
  const safeTimestamp = String(timestamp || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}-\d{6}$/u.test(safeTimestamp)) {
    throw new Error('测试记录时间戳必须是 YYYY-MM-DD-HHmmss。');
  }
  return `${SKILL_TEST_RECORD_ROOT}/${safeTimestamp}-技能测试器记录/report.json`;
}

export function formatSkillTestTimestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildSkillTestRecord({ timestamp = formatSkillTestTimestamp(), sources = {}, scenario = {}, result } = {}) {
  return {
    meta: {
      artifactKind: 'skill_tester_record',
      timestamp,
      createdBy: 'skill_tester'
    },
    sources,
    scenario,
    result: compactSkillTestResultForRecord(result)
  };
}

function pickContextForRecord(context = {}) {
  return {
    levelIndex: context.levelIndex,
    level: context.level ? {
      id: context.level.id,
      name: context.level.name || context.level.title,
      nodeLabel: context.level.flow?.nodeLabel,
      chapterTitle: context.level.flow?.chapterTitle
    } : null,
    enemyId: context.enemyId,
    enemyName: context.enemyName,
    kpMode: context.kpMode,
    kpBudget: context.kpBudget,
    assumedInitialKp: context.assumedInitialKp,
    assumedKpPerLevel: context.assumedKpPerLevel,
    initialSkillPoints: context.initialSkillPoints,
    actualThroughCurrent: context.actualThroughCurrent,
    actualBeforeCurrent: context.actualBeforeCurrent,
    enemy: context.enemy
  };
}

function summarizeSkillList(skills = []) {
  return skills.map(skill => skill?.name || skill?.id).filter(Boolean);
}

function compactCandidate(candidate) {
  return {
    score: candidate.score,
    build: {
      skillIds: candidate.build?.skillIds || [],
      skillNames: summarizeSkillList(candidate.build?.skills),
      kpUsed: candidate.build?.kpUsed,
      kpRemaining: candidate.build?.kpRemaining,
      maxTier: candidate.build?.maxTier,
      mechanics: candidate.build?.mechanics
    },
    combo: {
      skillIds: candidate.combo?.skillIds || [],
      skillNames: summarizeSkillList(candidate.combo?.skills),
      apUsed: candidate.combo?.apUsed,
      apRemaining: candidate.combo?.apRemaining
    },
    simulation: {
      killed: candidate.simulation?.killed,
      turnsToKill: candidate.simulation?.turnsToKill,
      metrics: candidate.simulation?.metrics,
      final: candidate.simulation?.final,
      findings: candidate.simulation?.findings || [],
      turns: candidate.simulation?.turns || []
    }
  };
}

export function compactSkillTestResultForRecord(result = {}) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  return {
    context: pickContextForRecord(result.context || {}),
    allSkillCount: result.allSkillCount,
    focusedSkillCount: result.focusedSkillCount,
    buildCount: Array.isArray(result.builds) ? result.builds.length : 0,
    candidateCount: candidates.length,
    findings: result.findings || [],
    candidates: candidates.slice(0, 12).map(compactCandidate),
    best: result.best ? compactCandidate(result.best) : null
  };
}
