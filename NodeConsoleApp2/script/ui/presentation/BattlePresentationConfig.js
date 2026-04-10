const TEMPLATE_REGISTRY = Object.freeze({
    default: Object.freeze({
        template: 'default',
        presenterTemplate: 'default',
        scenePulse: 'actor-beat',
        statusKind: 'buff'
    }),
    melee: Object.freeze({
        template: 'melee',
        presenterTemplate: 'melee',
        scenePulse: 'actor-beat',
        statusKind: 'buff'
    }),
    guard: Object.freeze({
        template: 'guard',
        presenterTemplate: 'guard',
        scenePulse: 'impact',
        statusKind: 'buff'
    }),
    heal: Object.freeze({
        template: 'heal',
        presenterTemplate: 'heal',
        scenePulse: 'turn-announce',
        statusKind: 'buff'
    }),
    status: Object.freeze({
        template: 'status',
        presenterTemplate: 'status',
        scenePulse: 'turn-announce',
        statusKind: 'buff'
    })
});

const TEMPLATE_ALIASES = Object.freeze({
    melee: 'melee',
    attack: 'melee',
    strike: 'melee',
    physical: 'melee',
    guard: 'guard',
    defend: 'guard',
    defense: 'guard',
    block: 'guard',
    parry: 'guard',
    heal: 'heal',
    recovery: 'heal',
    support_heal: 'heal',
    status: 'status',
    buff: 'status',
    debuff: 'status',
    support: 'status'
});

const SCENE_PULSE_ALIASES = Object.freeze({
    'self-beat': 'self-beat',
    self_beat: 'self-beat',
    self: 'self-beat',
    beat: 'self-beat',
    actor: 'self-beat',
    'enemy-beat': 'enemy-beat',
    enemy_beat: 'enemy-beat',
    enemy: 'enemy-beat',
    impact: 'impact',
    guard: 'impact',
    'scene-impact': 'impact',
    turn: 'turn-announce',
    announce: 'turn-announce',
    heal: 'turn-announce',
    status: 'turn-announce',
    'turn-announce': 'turn-announce',
    turn_announce: 'turn-announce'
});

function normalizeString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
}

function normalizePresentationSide(side) {
    return side === 'enemy' ? 'enemy' : 'self';
}

function pickCandidate(candidates) {
    for (const candidate of candidates) {
        const raw = candidate?.value;
        if (raw === undefined || raw === null) continue;
        if (!String(raw).trim()) continue;
        return {
            value: raw,
            source: candidate.source || 'unknown'
        };
    }
    return { value: null, source: null };
}

function resolveDefaultScenePulse(scenePulse, side) {
    const normalizedSide = normalizePresentationSide(side);
    if (scenePulse === 'actor-beat') {
        return normalizedSide === 'enemy' ? 'enemy-beat' : 'self-beat';
    }
    return scenePulse || (normalizedSide === 'enemy' ? 'enemy-beat' : 'self-beat');
}

function normalizeTemplate(rawTemplate) {
    const normalized = normalizeString(rawTemplate);
    if (!normalized) {
        return { template: 'default', fallback: 'default' };
    }
    if (TEMPLATE_REGISTRY[normalized]) {
        return { template: normalized, fallback: 'configured' };
    }
    if (TEMPLATE_ALIASES[normalized]) {
        return { template: TEMPLATE_ALIASES[normalized], fallback: 'alias' };
    }
    return { template: 'default', fallback: 'default' };
}

function normalizeScenePulse(rawScenePulse, side, fallbackPulse) {
    const normalized = normalizeString(rawScenePulse);
    const fallback = resolveDefaultScenePulse(fallbackPulse, side);
    if (!normalized) {
        return { scenePulse: fallback, fallback: 'default' };
    }
    if (SCENE_PULSE_ALIASES[normalized]) {
        return { scenePulse: SCENE_PULSE_ALIASES[normalized], fallback: 'configured' };
    }
    if (TEMPLATE_ALIASES[normalized]) {
        const templateKey = TEMPLATE_ALIASES[normalized];
        const templateConfig = TEMPLATE_REGISTRY[templateKey] || TEMPLATE_REGISTRY.default;
        return {
            scenePulse: resolveDefaultScenePulse(templateConfig.scenePulse, side),
            fallback: 'alias'
        };
    }
    if (TEMPLATE_REGISTRY[normalized]) {
        const templateConfig = TEMPLATE_REGISTRY[normalized];
        return {
            scenePulse: resolveDefaultScenePulse(templateConfig.scenePulse, side),
            fallback: 'configured'
        };
    }
    return { scenePulse: fallback, fallback: 'default' };
}

function normalizeStatusKind(rawStatusKind, fallback = 'buff') {
    const normalized = normalizeString(rawStatusKind);
    if (normalized === 'debuff') return 'debuff';
    if (normalized === 'buff') return 'buff';
    return fallback === 'debuff' ? 'debuff' : 'buff';
}

function buildPresentationProfile({
    rawTemplate = null,
    templateSource = null,
    rawScenePulse = null,
    scenePulseSource = null,
    rawStatusKind = null,
    statusKindSource = null,
    side = 'self'
} = {}) {
    const normalizedSide = normalizePresentationSide(side);
    const templateResolution = normalizeTemplate(rawTemplate);
    const baseConfig = TEMPLATE_REGISTRY[templateResolution.template] || TEMPLATE_REGISTRY.default;
    const scenePulseResolution = normalizeScenePulse(rawScenePulse, normalizedSide, baseConfig.scenePulse);

    return {
        template: baseConfig.template,
        presenterTemplate: baseConfig.presenterTemplate,
        scenePulse: scenePulseResolution.scenePulse,
        side: normalizedSide,
        statusKind: normalizeStatusKind(rawStatusKind, baseConfig.statusKind),
        templateSource: templateSource || 'default',
        scenePulseSource: scenePulseSource || 'template-default',
        statusKindSource: statusKindSource || 'default',
        fallback: templateResolution.fallback,
        templateFallback: templateResolution.fallback,
        scenePulseFallback: scenePulseResolution.fallback,
        rawTemplate: rawTemplate === undefined || rawTemplate === null ? null : String(rawTemplate),
        rawScenePulse: rawScenePulse === undefined || rawScenePulse === null ? null : String(rawScenePulse)
    };
}

export function resolveActionPresentation(entry = null, payload = null) {
    const side = normalizePresentationSide(
        entry?.side
        || payload?.side
        || payload?.actorSide
        || payload?.targetSide
    );

    const templateCandidate = pickCandidate([
        { value: entry?.presentation?.template, source: 'entry.presentation.template' },
        { value: entry?.presentationTemplate, source: 'entry.presentationTemplate' },
        { value: entry?.template, source: 'entry.template' },
        { value: entry?.skillCategory, source: 'entry.skillCategory' },
        { value: entry?.category, source: 'entry.category' },
        { value: entry?.meta?.presentation?.template, source: 'entry.meta.presentation.template' },
        { value: entry?.meta?.presentationTemplate, source: 'entry.meta.presentationTemplate' },
        { value: entry?.meta?.template, source: 'entry.meta.template' },
        { value: entry?.meta?.skillCategory, source: 'entry.meta.skillCategory' },
        { value: entry?.meta?.category, source: 'entry.meta.category' },
        { value: payload?.presentation?.template, source: 'payload.presentation.template' },
        { value: payload?.presentationTemplate, source: 'payload.presentationTemplate' },
        { value: payload?.template, source: 'payload.template' },
        { value: payload?.skillCategory, source: 'payload.skillCategory' },
        { value: payload?.category, source: 'payload.category' }
    ]);

    const scenePulseCandidate = pickCandidate([
        { value: entry?.presentation?.scenePulse, source: 'entry.presentation.scenePulse' },
        { value: entry?.meta?.presentation?.scenePulse, source: 'entry.meta.presentation.scenePulse' },
        { value: entry?.meta?.scenePulse, source: 'entry.meta.scenePulse' },
        { value: payload?.presentation?.scenePulse, source: 'payload.presentation.scenePulse' },
        { value: payload?.scenePulse, source: 'payload.scenePulse' }
    ]);

    const statusKindCandidate = pickCandidate([
        { value: entry?.presentation?.statusKind, source: 'entry.presentation.statusKind' },
        { value: entry?.statusKind, source: 'entry.statusKind' },
        { value: entry?.meta?.presentation?.statusKind, source: 'entry.meta.presentation.statusKind' },
        { value: entry?.meta?.statusKind, source: 'entry.meta.statusKind' },
        { value: entry?.meta?.statusType, source: 'entry.meta.statusType' },
        { value: payload?.presentation?.statusKind, source: 'payload.presentation.statusKind' },
        { value: payload?.statusKind, source: 'payload.statusKind' },
        { value: payload?.statusType, source: 'payload.statusType' }
    ]);

    return buildPresentationProfile({
        rawTemplate: templateCandidate.value,
        templateSource: templateCandidate.source,
        rawScenePulse: scenePulseCandidate.value,
        scenePulseSource: scenePulseCandidate.source,
        rawStatusKind: statusKindCandidate.value,
        statusKindSource: statusKindCandidate.source,
        side
    });
}

export function resolveNamedPresentation(template, {
    side = 'self',
    scenePulse = null,
    statusKind = 'buff',
    templateSource = 'internal.template',
    scenePulseSource = null,
    statusKindSource = 'internal.statusKind'
} = {}) {
    return buildPresentationProfile({
        rawTemplate: template,
        templateSource,
        rawScenePulse: scenePulse,
        scenePulseSource,
        rawStatusKind: statusKind,
        statusKindSource,
        side
    });
}

export function resolveScenePulseClass(scenePulse, side = 'self') {
    const normalizedSide = normalizePresentationSide(side);
    const normalized = normalizeScenePulse(scenePulse, normalizedSide, 'actor-beat').scenePulse;
    if (normalized === 'enemy-beat') return 'scene-beat-enemy';
    if (normalized === 'impact') return 'scene-impact';
    if (normalized === 'turn-announce') return 'scene-turn-announce';
    return 'scene-beat-self';
}
