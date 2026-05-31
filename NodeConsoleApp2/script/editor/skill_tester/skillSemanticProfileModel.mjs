function normalizeSkillPack(skillPack) {
  if (Array.isArray(skillPack)) return skillPack;
  if (Array.isArray(skillPack?.skills)) return skillPack.skills;
  return [];
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean).map(String))];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSkillMap(skillPack) {
  return new Map(normalizeSkillPack(skillPack)
    .filter(skill => skill?.id)
    .map(skill => [String(skill.id), skill]));
}

function getRoleTags(profile) {
  const roleTags = profile?.roleTags || {};
  return unique([roleTags.primary, ...asArray(roleTags.secondary)]);
}

function getRelationProfile(profile) {
  return profile?.relationProfile && typeof profile.relationProfile === 'object'
    ? profile.relationProfile
    : {};
}

function getRelationTargets(relationProfile) {
  const relationKeys = ['variantOf', 'upgradeOf', 'alternativeTo', 'synergyWith', 'exclusiveWith', 'replacesInPhase'];
  const targets = [];
  for (const key of relationKeys) {
    const value = relationProfile[key];
    if (Array.isArray(value)) targets.push(...value);
    else if (value) targets.push(value);
  }
  return unique(targets);
}

function collectActionEffects(skill) {
  const actions = asArray(skill?.actions).map(action => action?.effect || action).filter(Boolean);
  const effects = asArray(skill?.effects).filter(Boolean);
  return [...actions, ...effects];
}

function includesBleedId(value) {
  return String(value || '').toLowerCase().includes('bleed');
}

function writesBleed(skill) {
  const applyRefs = [
    ...asArray(skill?.buffRefs?.apply),
    ...asArray(skill?.buffRefs?.applySelf)
  ];
  if (applyRefs.some(ref => includesBleedId(ref?.buffId))) return true;
  return collectActionEffects(skill).some(effect => {
    if (!String(effect?.effectType || '').includes('BUFF_APPLY')) return false;
    return includesBleedId(effect.buffId || effect.buff?.id || effect.buffRef);
  });
}

function decisionProfileIsEmpty(profile) {
  const decision = profile?.decisionProfile || {};
  return ['preferredWhen', 'avoidWhen', 'differentiation']
    .every(key => !String(decision[key] || '').trim());
}

export function buildSemanticProfileIndex(skillPack) {
  const skillMap = getSkillMap(skillPack);
  const profiles = new Map();
  let profiledSkillCount = 0;

  for (const [skillId, skill] of skillMap.entries()) {
    const profile = skill.semanticProfile || null;
    if (profile) profiledSkillCount += 1;
    profiles.set(skillId, {
      skillId,
      skillName: String(skill.name || skillId),
      profile,
      primaryRole: profile?.roleTags?.primary || 'Skill.Unprofiled',
      roleTags: profile ? getRoleTags(profile) : ['Skill.Unprofiled'],
      relationProfile: getRelationProfile(profile)
    });
  }

  return {
    skillCount: skillMap.size,
    profiledSkillCount,
    unprofiledSkillCount: Math.max(0, skillMap.size - profiledSkillCount),
    has(skillId) {
      return profiles.has(String(skillId));
    },
    get(skillId) {
      return profiles.get(String(skillId)) || {
        skillId: String(skillId),
        skillName: String(skillId),
        profile: null,
        primaryRole: 'Skill.Unprofiled',
        roleTags: ['Skill.Unprofiled'],
        relationProfile: {}
      };
    },
    getPrimaryRole(skillId) {
      return this.get(skillId).primaryRole;
    },
    getRoleTags(skillId) {
      return this.get(skillId).roleTags;
    },
    getRelations(skillId) {
      return this.get(skillId).relationProfile;
    }
  };
}

export function validateSemanticProfiles(skillPack) {
  const skills = normalizeSkillPack(skillPack);
  const skillIds = new Set(skills.map(skill => String(skill.id)).filter(Boolean));
  const warnings = [];

  for (const skill of skills) {
    const skillId = String(skill.id || '');
    const profile = skill.semanticProfile;
    if (!profile) {
      warnings.push({
        code: 'missing_semantic_profile',
        severity: 'warning',
        skillId,
        message: '技能缺少 semanticProfile。'
      });
      continue;
    }

    const relationTargets = getRelationTargets(getRelationProfile(profile));
    for (const targetId of relationTargets) {
      if (!skillIds.has(targetId)) {
        warnings.push({
          code: 'missing_relation_target',
          severity: 'error',
          skillId,
          targetId,
          message: `semanticProfile 关系引用不存在的技能：${targetId}。`
        });
      }
    }

    if (profile.roleTags?.primary === 'Skill.Bleed.Apply' && !writesBleed(skill)) {
      warnings.push({
        code: 'bleed_apply_without_bleed_write',
        severity: 'warning',
        skillId,
        message: '技能标记为 Skill.Bleed.Apply，但没有写入流血 Buff。'
      });
    }

    if (decisionProfileIsEmpty(profile)) {
      warnings.push({
        code: 'empty_decision_profile',
        severity: 'warning',
        skillId,
        message: 'semanticProfile.decisionProfile 缺少可审查的选择理由。'
      });
    }
  }

  return warnings;
}

export function summarizeLoopRoleMetrics(levels = [], semanticIndex = buildSemanticProfileIndex([])) {
  const roleLoopCounts = new Map();
  let roleCountSum = 0;
  let loopCount = 0;
  let lowRoleLoopCount = 0;
  let unprofiledLoopCount = 0;

  for (const level of levels) {
    const loopSkillIds = asArray(level?.best?.loopSkillIds);
    if (!loopSkillIds.length) continue;
    const roles = unique(loopSkillIds.map(skillId => semanticIndex.getPrimaryRole(skillId)));
    const signature = roles.join(' > ') || 'Skill.Unprofiled';
    roleLoopCounts.set(signature, (roleLoopCounts.get(signature) || 0) + 1);
    roleCountSum += roles.length;
    loopCount += 1;
    if (roles.length <= 1) lowRoleLoopCount += 1;
    if (roles.includes('Skill.Unprofiled')) unprofiledLoopCount += 1;
  }

  const sortedRoleLoops = [...roleLoopCounts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const aUnprofiled = a[0].includes('Skill.Unprofiled');
      const bUnprofiled = b[0].includes('Skill.Unprofiled');
      if (aUnprofiled !== bUnprofiled) return aUnprofiled ? 1 : -1;
      const aLength = a[0].split(' > ').length;
      const bLength = b[0].split(' > ').length;
      if (aLength !== bLength) return aLength - bLength;
      return a[0].localeCompare(b[0]);
    })
    .map(([signature, count]) => ({ signature, count }));

  return {
    loopCount,
    averagePrimaryRoleCount: loopCount ? Number((roleCountSum / loopCount).toFixed(2)) : 0,
    lowRoleLoopCount,
    unprofiledLoopCount,
    roleLoopSignatures: sortedRoleLoops,
    dominantRoleLoop: sortedRoleLoops[0] || { signature: '(empty)', count: 0 }
  };
}
