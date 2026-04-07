export function classifyBundleFallback({
  bundleErrors = [],
  characterErrors = [],
  hasSuccessfulCharacters = false
} = {}) {
  if (Array.isArray(bundleErrors) && bundleErrors.length > 0) {
    return {
      decision: 'fallback_static_all',
      reason: bundleErrors[0]?.code || 'BUNDLE_ERROR'
    };
  }

  if (Array.isArray(characterErrors) && characterErrors.length > 0) {
    return {
      decision: hasSuccessfulCharacters || characterErrors.length > 0
        ? 'fallback_static_character'
        : 'fallback_static_all',
      reason: characterErrors[0]?.code || 'CHARACTER_ERROR'
    };
  }

  return {
    decision: 'use_bundle',
    reason: 'OK'
  };
}
