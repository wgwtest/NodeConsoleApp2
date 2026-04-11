export const BATTLE_PRESENTATION_PROFILE_STORAGE_KEY = 'codex_battle_presentation_profile_workspace_v1';
export const DEFAULT_BATTLE_PRESENTATION_PROFILE_URL = new URL('../../../assets/data/battle_presentation_profiles_v1.json', import.meta.url).href;

const MOTION_DURATION_DEFAULTS = Object.freeze({
    idleMs: 2800,
    actionMs: 420,
    hitMs: 420,
    hitFlashMs: 420,
    healMs: 460,
    healGlowMs: 460,
    shadowMs: 420,
    statusMs: 560,
    armorMs: 560,
    sceneTurnMs: 520,
    sceneBeatMs: 480,
    sceneImpactMs: 460,
    floatTextMs: 950,
    floatTextCleanupMs: 1200
});

const MOTION_VALUE_DEFAULTS = Object.freeze({
    idleBobPx: 8,
    lungeDistancePx: 34,
    lungeLiftPx: 8,
    lungeScale: 1.02,
    weaponSwingXPx: 10,
    weaponSwingYPx: -14,
    weaponSwingDeg: 18,
    enemyWeaponSwingXPx: -10,
    enemyWeaponSwingYPx: -14,
    enemyWeaponSwingDeg: -18,
    bodyStrikeLiftPx: -4,
    bodyStrikeRotateDeg: -2,
    hitShakeLeftPx: -10,
    hitShakeRightPx: 12,
    hitShakeSettlePx: -8,
    healLiftPx: 14,
    healScale: 1.02,
    shadowScaleX: 1.08,
    shadowScaleY: 0.96,
    sceneTurnScale: 1.01,
    sceneTurnSaturate: 1.18,
    sceneBeatOffsetPx: 6,
    sceneBeatScale: 1.01,
    sceneBeatBrightness: 1.12,
    sceneImpactX1Px: 4,
    sceneImpactY1Px: -2,
    sceneImpactX2Px: -3,
    sceneImpactY2Px: 1,
    sceneImpactX3Px: 2,
    sceneImpactY3Px: -1,
    sceneImpactX4Px: -1,
    sceneImpactY4Px: 0,
    sceneImpactBrightness: 1.08,
    floatStartPx: 16,
    floatMidPx: -6,
    floatEndPx: -56,
    floatScaleStart: 0.92,
    floatScaleEnd: 1.02
});

const DEFAULT_PROFILE = Object.freeze({
    id: 'default_balanced',
    label: '默认平衡',
    description: '主流程默认展示配置，优先保持可读性和轻量反馈。',
    bridge: {
        spineSlotProfile: 'humanoid_balanced',
        notes: '供主工程与 SpineAssets 对齐“同一动作语义、不同素材实现”的桥接面。'
    },
    motion: {
        durations: { ...MOTION_DURATION_DEFAULTS },
        values: { ...MOTION_VALUE_DEFAULTS }
    }
});

const IMPACT_PROFILE = Object.freeze({
    id: 'impact_heavy',
    label: '冲击强化',
    description: '加强前冲、受击与场景冲击，适合重打击风格的展示实验。',
    bridge: {
        spineSlotProfile: 'humanoid_impact',
        notes: '适合未来 SpineAssets 中偏重前摇与受击反馈的角色模板。'
    },
    motion: {
        durations: {
            ...MOTION_DURATION_DEFAULTS,
            actionMs: 460,
            hitMs: 480,
            sceneBeatMs: 520,
            sceneImpactMs: 520
        },
        values: {
            ...MOTION_VALUE_DEFAULTS,
            lungeDistancePx: 42,
            lungeLiftPx: 10,
            weaponSwingXPx: 14,
            enemyWeaponSwingXPx: -14,
            hitShakeLeftPx: -14,
            hitShakeRightPx: 16,
            hitShakeSettlePx: -10,
            sceneBeatOffsetPx: 8,
            sceneImpactX1Px: 6,
            sceneImpactX2Px: -5,
            sceneImpactX3Px: 3,
            floatEndPx: -64
        }
    }
});

export const DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT = Object.freeze({
    schemaVersion: 1,
    meta: {
        id: 'battle_presentation_profiles_v1',
        name: 'NodeConsoleApp2 对战展示配置资产',
        description: '纯展示层配置资产。只驱动动作、场景节奏与飘字表现，不写回规则层。',
        defaultConsumers: [
            'mock_ui_v11.html',
            'test/battle_presentation_probe.html',
            'test/battle_presentation_configurator.html'
        ]
    },
    activeProfileId: DEFAULT_PROFILE.id,
    profiles: [DEFAULT_PROFILE, IMPACT_PROFILE]
});

function cloneValue(value) {
    if (!value || typeof value !== 'object') return null;
    return JSON.parse(JSON.stringify(value));
}

function normalizeString(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
}

function normalizeNumber(value, fallback, { min = null, max = null } = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    if (min !== null && numeric < min) return fallback;
    if (max !== null && numeric > max) return fallback;
    return numeric;
}

function normalizeMotionSection(source, defaults, options = {}) {
    const output = {};
    const raw = source && typeof source === 'object' ? source : {};
    for (const [key, fallback] of Object.entries(defaults)) {
        output[key] = normalizeNumber(raw[key], fallback, options[key] || {});
    }
    return output;
}

function getStorage(storage = null) {
    if (storage) return storage;
    if (typeof globalThis === 'undefined') return null;
    return globalThis.localStorage || null;
}

function readWorkspaceDocument(storage = null) {
    if (typeof globalThis !== 'undefined') {
        const override = globalThis.__CODEX_BATTLE_PRESENTATION_PROFILE_WORKSPACE__;
        if (override && typeof override === 'object') {
            return cloneValue(override);
        }
    }

    const safeStorage = getStorage(storage);
    if (!safeStorage) return null;

    try {
        const raw = safeStorage.getItem(BATTLE_PRESENTATION_PROFILE_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.warn('[BattlePresentationAssetStore] Failed to read workspace profile:', error);
        return null;
    }
}

function normalizeProfile(rawProfile, fallbackProfile = DEFAULT_PROFILE) {
    const profile = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
    return {
        id: normalizeString(profile.id, fallbackProfile.id),
        label: normalizeString(profile.label, fallbackProfile.label),
        description: normalizeString(profile.description, fallbackProfile.description),
        bridge: {
            spineSlotProfile: normalizeString(profile.bridge?.spineSlotProfile, fallbackProfile.bridge?.spineSlotProfile || fallbackProfile.id),
            notes: normalizeString(profile.bridge?.notes, fallbackProfile.bridge?.notes || '')
        },
        motion: {
            durations: normalizeMotionSection(profile.motion?.durations, MOTION_DURATION_DEFAULTS, {
                idleMs: { min: 200 },
                actionMs: { min: 120 },
                hitMs: { min: 120 },
                hitFlashMs: { min: 120 },
                healMs: { min: 120 },
                healGlowMs: { min: 120 },
                shadowMs: { min: 120 },
                statusMs: { min: 120 },
                armorMs: { min: 120 },
                sceneTurnMs: { min: 120 },
                sceneBeatMs: { min: 120 },
                sceneImpactMs: { min: 120 },
                floatTextMs: { min: 120 },
                floatTextCleanupMs: { min: 200 }
            }),
            values: normalizeMotionSection(profile.motion?.values, MOTION_VALUE_DEFAULTS, {
                lungeScale: { min: 0.8, max: 1.4 },
                healScale: { min: 0.8, max: 1.4 },
                shadowScaleX: { min: 0.8, max: 1.5 },
                shadowScaleY: { min: 0.8, max: 1.5 },
                sceneTurnScale: { min: 0.95, max: 1.2 },
                sceneTurnSaturate: { min: 0.8, max: 1.6 },
                sceneBeatScale: { min: 0.95, max: 1.2 },
                sceneBeatBrightness: { min: 0.8, max: 1.6 },
                sceneImpactBrightness: { min: 0.8, max: 1.6 },
                floatScaleStart: { min: 0.5, max: 1.5 },
                floatScaleEnd: { min: 0.5, max: 1.5 }
            })
        }
    };
}

export function normalizeBattlePresentationProfileDocument(rawDocument = null) {
    const doc = rawDocument && typeof rawDocument === 'object' ? rawDocument : {};
    const meta = doc.meta && typeof doc.meta === 'object' ? doc.meta : {};
    const rawProfiles = Array.isArray(doc.profiles) ? doc.profiles : [];
    const profiles = rawProfiles.length > 0
        ? rawProfiles.map((profile, index) => normalizeProfile(profile, index === 1 ? IMPACT_PROFILE : DEFAULT_PROFILE))
        : DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT.profiles.map(profile => normalizeProfile(profile, profile));

    const activeProfileId = normalizeString(doc.activeProfileId, profiles[0]?.id || DEFAULT_PROFILE.id);
    const activeProfile = profiles.find(profile => profile.id === activeProfileId) || profiles[0] || normalizeProfile(DEFAULT_PROFILE, DEFAULT_PROFILE);

    return {
        schemaVersion: normalizeNumber(doc.schemaVersion, DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT.schemaVersion, { min: 1 }),
        meta: {
            id: normalizeString(meta.id, DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT.meta.id),
            name: normalizeString(meta.name, DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT.meta.name),
            description: normalizeString(meta.description, DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT.meta.description),
            defaultConsumers: Array.isArray(meta.defaultConsumers)
                ? meta.defaultConsumers.map(item => normalizeString(item)).filter(Boolean)
                : [...DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT.meta.defaultConsumers]
        },
        activeProfileId: activeProfile.id,
        profiles
    };
}

export function getBattlePresentationProfileById(document, profileId = null) {
    const normalized = normalizeBattlePresentationProfileDocument(document);
    const requestedId = normalizeString(profileId, normalized.activeProfileId);
    return normalized.profiles.find(profile => profile.id === requestedId) || normalized.profiles[0];
}

export function buildBattlePresentationCssVariables(profile) {
    const activeProfile = getBattlePresentationProfileById({ activeProfileId: profile?.id || DEFAULT_PROFILE.id, profiles: [profile || DEFAULT_PROFILE] });
    const durations = activeProfile.motion?.durations || MOTION_DURATION_DEFAULTS;
    const values = activeProfile.motion?.values || MOTION_VALUE_DEFAULTS;

    return {
        '--battle-idle-duration': `${durations.idleMs}ms`,
        '--battle-action-duration': `${durations.actionMs}ms`,
        '--battle-hit-duration': `${durations.hitMs}ms`,
        '--battle-hit-flash-duration': `${durations.hitFlashMs}ms`,
        '--battle-heal-duration': `${durations.healMs}ms`,
        '--battle-heal-glow-duration': `${durations.healGlowMs}ms`,
        '--battle-shadow-duration': `${durations.shadowMs}ms`,
        '--battle-status-duration': `${durations.statusMs}ms`,
        '--battle-armor-duration': `${durations.armorMs}ms`,
        '--battle-scene-turn-duration': `${durations.sceneTurnMs}ms`,
        '--battle-scene-beat-duration': `${durations.sceneBeatMs}ms`,
        '--battle-scene-impact-duration': `${durations.sceneImpactMs}ms`,
        '--battle-float-duration': `${durations.floatTextMs}ms`,
        '--battle-idle-bob-px': `${values.idleBobPx}px`,
        '--battle-lunge-distance-px': `${values.lungeDistancePx}px`,
        '--battle-lunge-lift-px': `${values.lungeLiftPx}px`,
        '--battle-lunge-scale': `${values.lungeScale}`,
        '--battle-weapon-swing-x-px': `${values.weaponSwingXPx}px`,
        '--battle-weapon-swing-y-px': `${values.weaponSwingYPx}px`,
        '--battle-weapon-swing-deg': `${values.weaponSwingDeg}deg`,
        '--battle-enemy-weapon-swing-x-px': `${values.enemyWeaponSwingXPx}px`,
        '--battle-enemy-weapon-swing-y-px': `${values.enemyWeaponSwingYPx}px`,
        '--battle-enemy-weapon-swing-deg': `${values.enemyWeaponSwingDeg}deg`,
        '--battle-body-strike-lift-px': `${values.bodyStrikeLiftPx}px`,
        '--battle-body-strike-rotate-deg': `${values.bodyStrikeRotateDeg}deg`,
        '--battle-hit-shake-left-px': `${values.hitShakeLeftPx}px`,
        '--battle-hit-shake-right-px': `${values.hitShakeRightPx}px`,
        '--battle-hit-shake-settle-px': `${values.hitShakeSettlePx}px`,
        '--battle-heal-lift-px': `${values.healLiftPx}px`,
        '--battle-heal-scale': `${values.healScale}`,
        '--battle-shadow-scale-x': `${values.shadowScaleX}`,
        '--battle-shadow-scale-y': `${values.shadowScaleY}`,
        '--battle-scene-turn-scale': `${values.sceneTurnScale}`,
        '--battle-scene-turn-saturate': `${values.sceneTurnSaturate}`,
        '--battle-scene-beat-offset-px': `${values.sceneBeatOffsetPx}px`,
        '--battle-scene-beat-scale': `${values.sceneBeatScale}`,
        '--battle-scene-beat-brightness': `${values.sceneBeatBrightness}`,
        '--battle-scene-impact-x1-px': `${values.sceneImpactX1Px}px`,
        '--battle-scene-impact-y1-px': `${values.sceneImpactY1Px}px`,
        '--battle-scene-impact-x2-px': `${values.sceneImpactX2Px}px`,
        '--battle-scene-impact-y2-px': `${values.sceneImpactY2Px}px`,
        '--battle-scene-impact-x3-px': `${values.sceneImpactX3Px}px`,
        '--battle-scene-impact-y3-px': `${values.sceneImpactY3Px}px`,
        '--battle-scene-impact-x4-px': `${values.sceneImpactX4Px}px`,
        '--battle-scene-impact-y4-px': `${values.sceneImpactY4Px}px`,
        '--battle-scene-impact-brightness': `${values.sceneImpactBrightness}`,
        '--battle-float-start-px': `${values.floatStartPx}px`,
        '--battle-float-mid-px': `${values.floatMidPx}px`,
        '--battle-float-end-px': `${values.floatEndPx}px`,
        '--battle-float-scale-start': `${values.floatScaleStart}`,
        '--battle-float-scale-end': `${values.floatScaleEnd}`
    };
}

export async function loadBattlePresentationProfile({
    storage = null,
    fetchImpl = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
    preferWorkspace = true,
    url = DEFAULT_BATTLE_PRESENTATION_PROFILE_URL,
    profileId = null
} = {}) {
    const workspaceDoc = readWorkspaceDocument(storage);
    if (preferWorkspace && workspaceDoc) {
        const document = normalizeBattlePresentationProfileDocument(workspaceDoc);
        return {
            source: 'workspace',
            assetUrl: url,
            document,
            activeProfile: getBattlePresentationProfileById(document, profileId),
            hasWorkspace: true
        };
    }

    if (fetchImpl) {
        try {
            const response = await fetchImpl(url, { cache: 'no-store' });
            if (response?.ok) {
                const rawDocument = await response.json();
                const document = normalizeBattlePresentationProfileDocument(rawDocument);
                return {
                    source: 'asset',
                    assetUrl: url,
                    document,
                    activeProfile: getBattlePresentationProfileById(document, profileId),
                    hasWorkspace: Boolean(workspaceDoc)
                };
            }
        } catch (error) {
            console.warn('[BattlePresentationAssetStore] Failed to fetch asset profile document:', error);
        }
    }

    const fallbackDocument = normalizeBattlePresentationProfileDocument(DEFAULT_BATTLE_PRESENTATION_PROFILE_DOCUMENT);
    return {
        source: workspaceDoc ? 'workspace-fallback' : 'fallback',
        assetUrl: url,
        document: fallbackDocument,
        activeProfile: getBattlePresentationProfileById(fallbackDocument, profileId),
        hasWorkspace: Boolean(workspaceDoc)
    };
}

export function saveBattlePresentationProfileWorkspace(document, storage = null) {
    const safeStorage = getStorage(storage);
    if (!safeStorage) return false;

    const normalized = normalizeBattlePresentationProfileDocument(document);
    try {
        safeStorage.setItem(BATTLE_PRESENTATION_PROFILE_STORAGE_KEY, JSON.stringify(normalized));
        return true;
    } catch (error) {
        console.warn('[BattlePresentationAssetStore] Failed to write workspace profile:', error);
        return false;
    }
}

export function clearBattlePresentationProfileWorkspace(storage = null) {
    const safeStorage = getStorage(storage);
    if (!safeStorage) return false;

    try {
        safeStorage.removeItem(BATTLE_PRESENTATION_PROFILE_STORAGE_KEY);
        return true;
    } catch (error) {
        console.warn('[BattlePresentationAssetStore] Failed to clear workspace profile:', error);
        return false;
    }
}
