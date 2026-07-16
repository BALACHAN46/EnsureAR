// Utility functions for model tuning configuration
// Reads from localStorage (admin-saved) or falls back to model-defaults.json baseline

const STORAGE_PREFIX = 'model_config_';

/**
 * Get tuning config for a model.
 * Returns saved localStorage override, or the default from JSON, or hardcoded fallback.
 * @param {string} modelId
 * @param {object} defaults - the loaded model-defaults.json data
 */
export function getModelConfig(modelId, defaults = {}) {
  const stored = localStorage.getItem(`${STORAGE_PREFIX}${modelId}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // corrupted data, fall through to defaults
    }
  }
  if (defaults && defaults[modelId]) {
    return { ...defaults[modelId] };
  }
  // Hardcoded fallback
  return { posX: 0, posY: 0, posZ: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };
}

/**
 * Save tuning config for a model to localStorage, and if in development, to model-defaults.json.
 * @param {string} modelId
 * @param {object} config - { posY, posZ, rotX, rotY, rotZ, scale }
 */
export async function saveModelConfig(modelId, config) {
  localStorage.setItem(`${STORAGE_PREFIX}${modelId}`, JSON.stringify(config));
  
  try {
    // Attempt to save to the filesystem via our custom Vite plugin endpoint
    await fetch('/api/save-tuning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, config })
    });
  } catch (err) {
    console.warn('Could not save to model-defaults.json. Make sure the Vite dev server is running.', err);
  }
}

/**
 * Reset a model's config to defaults (remove localStorage override).
 * @param {string} modelId
 */
export function resetModelConfig(modelId) {
  localStorage.removeItem(`${STORAGE_PREFIX}${modelId}`);
}

/**
 * Check if a model has a custom (admin-saved) override.
 * @param {string} modelId
 */
export function hasCustomConfig(modelId) {
  return localStorage.getItem(`${STORAGE_PREFIX}${modelId}`) !== null;
}

/**
 * Convert posX/posY/posZ → [x, y, z] position array for Three.js
 */
export function configToPosition(config) {
  return [config.posX ?? 0, config.posY ?? 0, config.posZ ?? 0];
}

/**
 * Convert rotX/rotY/rotZ → [x, y, z] rotation array for Three.js (in radians)
 */
export function configToRotation(config) {
  return [config.rotX ?? 0, config.rotY ?? 0, config.rotZ ?? 0];
}

/**
 * Get the uniform scale value for Three.js
 */
export function configToScale(config) {
  return config.scale ?? 1;
}
