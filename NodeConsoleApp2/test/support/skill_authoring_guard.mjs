const DEFAULT_NODE_WIDTH = 72;
const DEFAULT_NODE_HEIGHT = 72;
const DEFAULT_MIN_NODE_GAP = 24;

const DEFAULT_RARITY_KP_RANGES = Object.freeze({
  Common: [0, 1],
  Uncommon: [1, 2],
  Rare: [1, 3],
  Epic: [3, 5],
  Legendary: [8, 8]
});

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isHiddenSkill(skill) {
  return skill?.hiddenInSkillTree === true || skill?.editorMeta?.hiddenInSkillTree === true;
}

function issue(code, message, details = {}) {
  return { code, message, ...details };
}

function getBuffDict(buffPack) {
  if (isObject(buffPack?.buffs)) return buffPack.buffs;
  if (isObject(buffPack)) return buffPack;
  return {};
}

function collectBuffRefs(value, pathName = '$', refs = []) {
  if (!value || typeof value !== 'object') return refs;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectBuffRefs(item, `${pathName}[${index}]`, refs));
    return refs;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${pathName}.${key}`;
    if (key === 'buffId' && typeof child === 'string' && child.trim()) {
      refs.push({ buffId: child.trim(), path: childPath });
    }
    collectBuffRefs(child, childPath, refs);
  }
  return refs;
}

function buildSkillIdSet(skills) {
  return new Set(skills.map(skill => String(skill?.id || '').trim()).filter(Boolean));
}

function detectPrerequisiteCycles(skills) {
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  function visit(skillId, stack) {
    if (visited.has(skillId)) return;
    if (visiting.has(skillId)) {
      const cycleStart = stack.indexOf(skillId);
      cycles.push(cycleStart >= 0 ? stack.slice(cycleStart).concat(skillId) : stack.concat(skillId));
      return;
    }

    visiting.add(skillId);
    const skill = byId.get(skillId);
    for (const parentId of toArray(skill?.prerequisites)) {
      if (byId.has(parentId)) visit(parentId, stack.concat(parentId));
    }
    visiting.delete(skillId);
    visited.add(skillId);
  }

  for (const skill of skills) {
    if (skill?.id) visit(skill.id, [skill.id]);
  }

  return cycles;
}

function boxesOverlap(a, b, minGap) {
  return !(
    a.right + minGap <= b.left ||
    b.right + minGap <= a.left ||
    a.bottom + minGap <= b.top ||
    b.bottom + minGap <= a.top
  );
}

function getSkillBox(skill, options) {
  const x = Number(skill?.editorMeta?.x);
  const y = Number(skill?.editorMeta?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    skill,
    left: x,
    top: y,
    right: x + options.nodeWidth,
    bottom: y + options.nodeHeight
  };
}

function validateUniqueSkillIds(skills, issues) {
  const seen = new Set();
  for (const skill of skills) {
    const id = String(skill?.id || '').trim();
    if (!id) {
      issues.push(issue('skill_id_missing', '技能缺少 id。', { skillName: skill?.name || '' }));
      continue;
    }
    if (seen.has(id)) {
      issues.push(issue('skill_id_duplicate', `技能 id 重复：${id}`, { skillId: id }));
    }
    seen.add(id);
  }
}

function validatePrerequisites(skills, issues) {
  const ids = buildSkillIdSet(skills);
  for (const skill of skills) {
    for (const parentId of toArray(skill?.prerequisites)) {
      if (!ids.has(parentId)) {
        issues.push(issue(
          'prerequisite_missing',
          `技能 ${skill?.id || skill?.name || '<unknown>'} 引用了不存在的前置技能 ${parentId}。`,
          { skillId: skill?.id, prerequisiteId: parentId }
        ));
      }
    }
  }

  for (const cycle of detectPrerequisiteCycles(skills)) {
    issues.push(issue(
      'prerequisite_cycle',
      `技能前置关系存在循环：${cycle.join(' -> ')}`,
      { cycle }
    ));
  }
}

function validateBuffReferences(skills, buffPack, issues) {
  const buffIds = new Set(Object.keys(getBuffDict(buffPack)));
  for (const skill of skills) {
    for (const ref of collectBuffRefs(skill)) {
      if (!buffIds.has(ref.buffId)) {
        issues.push(issue(
          'buff_ref_missing',
          `技能 ${skill?.id || skill?.name || '<unknown>'} 引用了不存在的 Buff ${ref.buffId}。`,
          { skillId: skill?.id, buffId: ref.buffId, path: ref.path }
        ));
      }
    }
  }
}

function validateLayout(skills, issues, options) {
  const visibleSkills = skills.filter(skill => !isHiddenSkill(skill));
  const boxes = [];
  for (const skill of visibleSkills) {
    const box = getSkillBox(skill, options);
    if (!box) {
      issues.push(issue(
        'editor_meta_missing',
        `正式技能 ${skill?.id || skill?.name || '<unknown>'} 缺少有效 editorMeta.x/y。`,
        { skillId: skill?.id }
      ));
      continue;
    }
    boxes.push(box);
  }

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (!boxesOverlap(boxes[i], boxes[j], options.minNodeGap)) continue;
      issues.push(issue(
        'layout_collision',
        `技能节点 ${boxes[i].skill.name || boxes[i].skill.id} 与 ${boxes[j].skill.name || boxes[j].skill.id} 距离过近或重叠。`,
        {
          skillId: boxes[i].skill.id,
          otherSkillId: boxes[j].skill.id,
          minNodeGap: options.minNodeGap
        }
      ));
    }
  }
}

function validateRarityKp(skills, issues, options) {
  for (const skill of skills) {
    if (isHiddenSkill(skill)) continue;
    const rarity = skill?.rarity;
    const range = options.rarityKpRanges[rarity];
    if (!range) {
      issues.push(issue(
        'rarity_unknown',
        `技能 ${skill?.id || skill?.name || '<unknown>'} 使用了未知稀有度 ${rarity}。`,
        { skillId: skill?.id, rarity }
      ));
      continue;
    }

    const kp = Number(skill?.unlock?.cost?.kp ?? 0);
    if (!Number.isFinite(kp) || kp < range[0] || kp > range[1]) {
      issues.push(issue(
        'rarity_kp_out_of_range',
        `技能 ${skill?.id || skill?.name || '<unknown>'} 的 ${rarity} KP=${kp} 超出建议范围 ${range[0]}-${range[1]}。`,
        { skillId: skill?.id, rarity, kp, expectedRange: range }
      ));
    }
  }
}

export function validateSkillAuthoringGuard(skillPack, buffPack, config = {}) {
  const skills = Array.isArray(skillPack?.skills) ? skillPack.skills : [];
  const options = {
    nodeWidth: config.nodeWidth ?? DEFAULT_NODE_WIDTH,
    nodeHeight: config.nodeHeight ?? DEFAULT_NODE_HEIGHT,
    minNodeGap: config.minNodeGap ?? DEFAULT_MIN_NODE_GAP,
    rarityKpRanges: config.rarityKpRanges || DEFAULT_RARITY_KP_RANGES
  };
  const issues = [];

  validateUniqueSkillIds(skills, issues);
  validatePrerequisites(skills, issues);
  validateBuffReferences(skills, buffPack, issues);
  validateLayout(skills, issues, options);
  validateRarityKp(skills, issues, options);

  return { ok: issues.length === 0, issues };
}
