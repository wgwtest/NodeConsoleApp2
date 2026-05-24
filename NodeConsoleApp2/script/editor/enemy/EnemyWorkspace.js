const STANDARD_BODY_PARTS = ['head', 'chest', 'abdomen', 'arm', 'leg'];
const DEFAULT_ENEMY_SKILL_ALIASES = {
    skill_bite: 'skill_heavy_swing',
    skill_throw_stone: 'skill_skull_cracker',
    skill_smash: 'skill_hold_the_line',
    skill_warcry: 'skill_fortify',
    skill_heavy_smash: 'skill_execute',
    skill_rage: 'skill_1770474698976',
    skill_cleave: 'skill_earthquake',
    skill_ankle_bite: 'skill_artery_slice_copy_1769789197982',
    skill_escape: 'skill_shockwave_copy_1770041956468',
    skill_shield_bash: 'skill_skull_cracker',
    skill_bone_repair: 'skill_block'
};
const DEFAULT_ENEMY_PORTRAIT_REFS = {
    byId: {
        goblin_01: 'enemy_goblin_warrior',
        goblin_scout: 'enemy_goblin_scout',
        goblin_scout_lvl3: 'enemy_goblin_scout',
        goblin_story_headhunter: 'enemy_goblin_hunter',
        goblin_story_medic: 'enemy_goblin_medic',
        orc_warrior: 'enemy_orc_warrior',
        orc_berserker_lvl5: 'enemy_orc_berserker',
        skeleton_guard_lvl4: 'enemy_skeleton_guard',
        skeleton_story_repair_guard: 'enemy_skeleton_guard',
        enemy_acceptance_guard: 'enemy_construct_guard',
        enemy_acceptance_repair: 'enemy_construct_guard',
        enemy_acceptance_heal: 'enemy_construct_guard',
        enemy_acceptance_pursuit: 'enemy_construct_guard',
        enemy_acceptance_head_tapper: 'enemy_construct_guard'
    },
    byRaceClass: {
        'goblin:hunter': 'enemy_goblin_hunter',
        'goblin:scout': 'enemy_goblin_scout',
        'goblin:support': 'enemy_goblin_medic',
        'goblin:medic': 'enemy_goblin_medic',
        'goblin:warrior': 'enemy_goblin_warrior',
        'orc:berserker': 'enemy_orc_berserker',
        'orc:warrior': 'enemy_orc_warrior',
        'undead:defender': 'enemy_skeleton_guard',
        'skeleton:defender': 'enemy_skeleton_guard',
        'construct:defender': 'enemy_construct_guard',
        'construct:support': 'enemy_construct_guard',
        'construct:hunter': 'enemy_construct_guard',
        'construct:tester': 'enemy_construct_guard'
    },
    byRace: {
        goblin: 'enemy_goblin_warrior',
        orc: 'enemy_orc_warrior',
        undead: 'enemy_skeleton_guard',
        skeleton: 'enemy_skeleton_guard',
        construct: 'enemy_construct_guard'
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value, fallback = 0) {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
}

function normalizeString(value, fallback = '') {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function uniqueStringList(value) {
    const seen = new Set();
    const result = [];
    asArray(value).forEach((item) => {
        const next = typeof item === 'string' ? item.trim() : '';
        if (!next || seen.has(next)) return;
        seen.add(next);
        result.push(next);
    });
    return result;
}

function normalizeBodyPart(value) {
    const source = asObject(value);
    return {
        current: toFiniteNumber(source.current, 0),
        max: toFiniteNumber(source.max, 0),
        weakness: toFiniteNumber(source.weakness, 1)
    };
}

function normalizePresentation(value) {
    const source = asObject(value);
    const result = {};
    ['portraitRef', 'mapPortraitRef', 'battleSpriteRef', 'iconRef', 'fallbackRaceClass'].forEach((key) => {
        if (typeof source[key] === 'string') result[key] = source[key].trim();
    });
    Object.keys(source).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(result, key)) result[key] = clone(source[key]);
    });
    return result;
}

function normalizeEnemy(enemyId, enemy) {
    const source = asObject(enemy);
    const normalized = clone(source);
    normalized.id = normalizeString(source.id, enemyId);
    normalized.name = normalizeString(source.name, normalized.id);
    normalized.race = normalizeString(source.race, '');
    normalized.class = normalizeString(source.class, '');
    normalized.tags = uniqueStringList(source.tags);
    normalized.description = typeof source.description === 'string' ? source.description : '';
    normalized.stats = {
        hp: toFiniteNumber(source.stats?.hp, 1),
        maxHp: toFiniteNumber(source.stats?.maxHp, toFiniteNumber(source.stats?.hp, 1)),
        ap: toFiniteNumber(source.stats?.ap, 0),
        speed: toFiniteNumber(source.stats?.speed, 0)
    };
    normalized.bodyParts = {};
    const rawParts = asObject(source.bodyParts);
    Object.keys(rawParts).forEach((partId) => {
        normalized.bodyParts[partId] = normalizeBodyPart(rawParts[partId]);
    });
    STANDARD_BODY_PARTS.forEach((partId) => {
        if (!normalized.bodyParts[partId]) normalized.bodyParts[partId] = normalizeBodyPart({});
    });
    normalized.skills = uniqueStringList(source.skills);
    normalized.presentation = normalizePresentation(source.presentation);
    return normalized;
}

function normalizeSkillCatalog(value) {
    if (Array.isArray(value)) {
        return Object.fromEntries(value.filter(item => item?.id).map(item => [item.id, item]));
    }
    if (Array.isArray(value?.skills)) {
        return Object.fromEntries(value.skills.filter(item => item?.id).map(item => [item.id, item]));
    }
    return asObject(value);
}

function normalizeAssetCatalog(value) {
    if (Array.isArray(value)) {
        return Object.fromEntries(value.filter(item => item?.id).map(item => [item.id, item]));
    }
    const source = asObject(value);
    const result = { ...source };
    const assetLibrary = asObject(source.assetLibrary);
    ['portraits', 'nodeArts', 'backgrounds', 'sprites', 'icons'].forEach((key) => {
        asArray(assetLibrary[key]).forEach((asset) => {
            if (asset?.id) result[asset.id] = asset;
        });
    });
    return result;
}

function collectLevelReferences(levelsDocument) {
    const refsByEnemy = new Map();
    const pools = asObject(levelsDocument?.enemyPools);
    Object.entries(pools).forEach(([poolId, pool]) => {
        asArray(pool?.members).forEach((member) => {
            const templateId = normalizeString(member?.templateId, '');
            if (!templateId) return;
            if (!refsByEnemy.has(templateId)) refsByEnemy.set(templateId, []);
            refsByEnemy.get(templateId).push({
                type: 'level',
                poolId,
                position: member?.position ?? null
            });
        });
    });
    return refsByEnemy;
}

function includesAny(source, tokens) {
    return tokens.some(token => source.includes(token));
}

function inferDefaultPortraitRef(enemy) {
    const id = normalizeString(enemy?.id, '');
    const race = normalizeString(enemy?.race, '').toLowerCase();
    const className = normalizeString(enemy?.class, '').toLowerCase();
    if (DEFAULT_ENEMY_PORTRAIT_REFS.byId[id]) return DEFAULT_ENEMY_PORTRAIT_REFS.byId[id];
    const raceClassRef = DEFAULT_ENEMY_PORTRAIT_REFS.byRaceClass[`${race}:${className}`];
    if (raceClassRef) return raceClassRef;
    if (DEFAULT_ENEMY_PORTRAIT_REFS.byRace[race]) return DEFAULT_ENEMY_PORTRAIT_REFS.byRace[race];

    const searchable = `${id} ${enemy?.name || ''} ${race} ${className}`.toLowerCase();
    if (includesAny(searchable, ['skeleton', 'undead', '骷髅'])) return 'enemy_skeleton_guard';
    if (includesAny(searchable, ['construct', 'acceptance', '验收'])) return 'enemy_construct_guard';
    if (includesAny(searchable, ['orc', '兽人'])) {
        return includesAny(searchable, ['berserker', 'rage', '嗜血']) ? 'enemy_orc_berserker' : 'enemy_orc_warrior';
    }
    if (includesAny(searchable, ['goblin', '哥布林'])) {
        if (includesAny(searchable, ['medic', 'heal', 'support', '医', '药'])) return 'enemy_goblin_medic';
        if (includesAny(searchable, ['scout', '斥候'])) return 'enemy_goblin_scout';
        if (includesAny(searchable, ['hunter', 'headhunter', '追猎', '猎'])) return 'enemy_goblin_hunter';
        return 'enemy_goblin_warrior';
    }
    return '';
}

export class EnemyWorkspace {
    constructor(rawDocument = {}, context = {}) {
        this.skillCatalog = normalizeSkillCatalog(context.skillCatalog);
        this.skillAliases = { ...DEFAULT_ENEMY_SKILL_ALIASES, ...asObject(context.skillAliases) };
        this.assetCatalog = normalizeAssetCatalog(context.assetCatalog);
        this.levelsDocument = asObject(context.levelsDocument);
        this.mapPack = asObject(context.mapPack);
        this.enemies = {};

        const source = asObject(rawDocument);
        Object.keys(source).forEach((enemyId) => {
            this.enemies[enemyId] = normalizeEnemy(enemyId, source[enemyId]);
        });
    }

    exportDocument() {
        return clone(this.enemies);
    }

    listEnemies() {
        return Object.values(this.enemies)
            .sort((left, right) => {
                const raceDiff = String(left.race || '').localeCompare(String(right.race || ''), 'zh-CN');
                if (raceDiff !== 0) return raceDiff;
                const classDiff = String(left.class || '').localeCompare(String(right.class || ''), 'zh-CN');
                if (classDiff !== 0) return classDiff;
                return String(left.id || '').localeCompare(String(right.id || ''), 'zh-CN');
            })
            .map(enemy => clone(enemy));
    }

    getEnemy(enemyId) {
        return this.enemies[enemyId] ? clone(this.enemies[enemyId]) : null;
    }

    updateEnemy(enemyId, updater) {
        if (!this.enemies[enemyId]) throw new Error(`Unknown enemy: ${enemyId}`);
        const next = typeof updater === 'function'
            ? updater(clone(this.enemies[enemyId]))
            : { ...clone(this.enemies[enemyId]), ...asObject(updater) };
        const nextId = normalizeString(next.id, enemyId);
        if (nextId !== enemyId) throw new Error('不允许直接修改敌人 id，请复制为新敌人。');
        this.enemies[enemyId] = normalizeEnemy(enemyId, next);
        return this.getEnemy(enemyId);
    }

    createEnemy(options = {}) {
        const baseId = normalizeString(options.id, `enemy_${Object.keys(this.enemies).length + 1}`);
        const enemyId = this.createUniqueEnemyId(baseId);
        this.enemies[enemyId] = normalizeEnemy(enemyId, {
            id: enemyId,
            name: normalizeString(options.name, `新敌人 ${enemyId}`),
            race: normalizeString(options.race, ''),
            class: normalizeString(options.class, ''),
            tags: [],
            stats: { hp: 1, maxHp: 1, ap: 0, speed: 0 },
            bodyParts: {},
            skills: [],
            presentation: {}
        });
        return enemyId;
    }

    removeEnemy(enemyId) {
        if (!this.enemies[enemyId]) return false;
        const refs = this.getLevelReferences(enemyId);
        if (refs.length > 0) {
            throw new Error(`敌人 ${enemyId} 仍被引用，不能直接删除。`);
        }
        delete this.enemies[enemyId];
        return true;
    }

    createUniqueEnemyId(preferredId) {
        const base = normalizeString(preferredId, `enemy_${Object.keys(this.enemies).length + 1}`);
        let candidate = base;
        let suffix = 2;
        while (this.enemies[candidate]) {
            candidate = `${base}_${suffix}`;
            suffix += 1;
        }
        return candidate;
    }

    getLevelReferences(enemyId) {
        return collectLevelReferences(this.levelsDocument).get(enemyId) || [];
    }

    resolveAsset(ref) {
        const key = normalizeString(ref, '');
        if (!key) return null;
        const found = this.assetCatalog[key];
        if (found) return found;
        if (key.includes('/') || key.endsWith('.svg') || key.endsWith('.png') || key.endsWith('.json')) {
            return { id: key, src: key };
        }
        return null;
    }

    resolveSkill(skillId) {
        const id = normalizeString(skillId, '');
        if (!id) return null;
        if (this.skillCatalog[id]) return { id, skill: this.skillCatalog[id], aliasOf: null };
        const aliasId = this.skillAliases[id];
        if (aliasId && this.skillCatalog[aliasId]) {
            return { id, skill: this.skillCatalog[aliasId], aliasOf: aliasId };
        }
        return null;
    }

    buildPresentationSummary(enemy) {
        const presentation = asObject(enemy.presentation);
        const explicitMapRef = presentation.mapPortraitRef || presentation.portraitRef || presentation.fallbackRaceClass || '';
        const defaultPortraitRef = inferDefaultPortraitRef(enemy);
        const mapRef = explicitMapRef || defaultPortraitRef;
        const resolvedMapPortrait = this.resolveAsset(mapRef);
        const missingAssets = [];
        ['portraitRef', 'mapPortraitRef', 'battleSpriteRef', 'iconRef'].forEach((field) => {
            const ref = presentation[field];
            if (ref && !this.resolveAsset(ref)) missingAssets.push(ref);
        });
        return {
            portraitRef: presentation.portraitRef || '',
            mapPortraitRef: presentation.mapPortraitRef || '',
            battleSpriteRef: presentation.battleSpriteRef || '',
            iconRef: presentation.iconRef || '',
            defaultPortraitRef,
            resolvedMapPortraitRef: resolvedMapPortrait?.id || mapRef,
            resolvedMapPortraitSrc: resolvedMapPortrait?.src || '',
            missingAssets
        };
    }

    buildCatalogEntry(enemyId) {
        const enemy = this.enemies[enemyId];
        if (!enemy) return null;
        const issues = this.validateEnemy(enemyId);
        return {
            id: enemy.id,
            name: enemy.name,
            race: enemy.race,
            class: enemy.class,
            tags: clone(enemy.tags),
            statsSummary: clone(enemy.stats),
            skillSummary: enemy.skills.map(skillId => {
                const resolved = this.resolveSkill(skillId);
                const skill = resolved?.skill || {};
                return {
                    id: skillId,
                    aliasOf: resolved?.aliasOf || null,
                    name: skill.name || skillId,
                    apCost: toFiniteNumber(skill.costs?.ap ?? skill.cost, 0)
                };
            }),
            bodyPartSummary: STANDARD_BODY_PARTS.map(part => ({ part, ...clone(enemy.bodyParts[part]) })),
            presentationSummary: this.buildPresentationSummary(enemy),
            diagnosticsSummary: {
                hasError: issues.some(issue => issue.severity === 'error'),
                warningCount: issues.filter(issue => issue.severity === 'warning').length
            },
            referenceSummary: {
                levelCount: this.getLevelReferences(enemyId).length,
                mapNodeCount: 0
            }
        };
    }

    validateEnemy(enemyId) {
        const enemy = this.enemies[enemyId];
        if (!enemy) return [];
        const issues = [];

        if (enemy.id !== enemyId) {
            issues.push({ severity: 'error', code: 'enemy_id_mismatch', enemyId, fieldPath: 'id' });
        }
        if (!enemy.name) {
            issues.push({ severity: 'error', code: 'missing_enemy_name', enemyId, fieldPath: 'name' });
        }
        if (enemy.stats.hp > enemy.stats.maxHp) {
            issues.push({ severity: 'error', code: 'invalid_hp_range', enemyId, fieldPath: 'stats.hp' });
        }
        if (enemy.stats.maxHp <= 0) {
            issues.push({ severity: 'error', code: 'invalid_max_hp', enemyId, fieldPath: 'stats.maxHp' });
        }
        if (enemy.stats.ap < 0) {
            issues.push({ severity: 'error', code: 'invalid_ap', enemyId, fieldPath: 'stats.ap' });
        }

        Object.entries(enemy.bodyParts).forEach(([partId, part]) => {
            if (!STANDARD_BODY_PARTS.includes(partId)) {
                issues.push({ severity: 'warning', code: 'legacy_body_part', enemyId, fieldPath: `bodyParts.${partId}` });
            }
            if (part.current > part.max) {
                issues.push({ severity: 'error', code: 'invalid_body_part_armor', enemyId, fieldPath: `bodyParts.${partId}.current` });
            }
            if (part.weakness <= 0) {
                issues.push({ severity: 'error', code: 'invalid_body_part_weakness', enemyId, fieldPath: `bodyParts.${partId}.weakness` });
            }
        });

        enemy.skills.forEach((skillId, index) => {
            const resolved = this.resolveSkill(skillId);
            if (!resolved) {
                issues.push({ severity: 'error', code: 'missing_skill_reference', enemyId, fieldPath: `skills[${index}]`, refId: skillId });
                return;
            }
            const skill = resolved.skill;
            const apCost = toFiniteNumber(skill.costs?.ap ?? skill.cost, 0);
            if (apCost > enemy.stats.ap) {
                issues.push({ severity: 'warning', code: 'skill_ap_too_high', enemyId, fieldPath: `skills[${index}]`, refId: skillId });
            }
        });

        if (enemy.skills.length === 0) {
            issues.push({ severity: 'error', code: 'missing_enemy_skills', enemyId, fieldPath: 'skills' });
        }

        const presentation = asObject(enemy.presentation);
        const defaultPortraitRef = inferDefaultPortraitRef(enemy);
        const resolvedDefaultPortrait = defaultPortraitRef ? this.resolveAsset(defaultPortraitRef) : null;
        if (!presentation.portraitRef && !presentation.mapPortraitRef && !resolvedDefaultPortrait) {
            issues.push({ severity: 'warning', code: 'missing_enemy_portrait', enemyId, fieldPath: 'presentation.portraitRef' });
        }
        ['portraitRef', 'mapPortraitRef', 'battleSpriteRef', 'iconRef'].forEach((field) => {
            const ref = presentation[field];
            if (ref && !this.resolveAsset(ref)) {
                issues.push({ severity: 'warning', code: 'missing_asset_reference', enemyId, fieldPath: `presentation.${field}`, refId: ref });
            }
        });

        return issues;
    }

    validateDocument() {
        const issues = [];
        Object.keys(this.enemies).forEach((enemyId) => {
            issues.push(...this.validateEnemy(enemyId));
        });

        const refsByEnemy = collectLevelReferences(this.levelsDocument);
        refsByEnemy.forEach((refs, templateId) => {
            if (!this.enemies[templateId]) {
                refs.forEach((ref) => {
                    issues.push({
                        severity: 'error',
                        code: 'missing_enemy_template_reference',
                        enemyId: templateId,
                        fieldPath: `levels.enemyPools.${ref.poolId}.members`
                    });
                });
            }
        });
        return issues;
    }
}

export { DEFAULT_ENEMY_SKILL_ALIASES };
export default EnemyWorkspace;
