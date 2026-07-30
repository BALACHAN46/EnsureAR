/**
 * useARGuideConfig
 * ----------------
 * Manages AR Guide Modal configuration stored in localStorage.
 *
 * Config shape:
 * {
 *   entryModalEnabled: boolean,   // Show entry-point modal when entering a category
 *   helpIconEnabled: boolean,     // Show the floating (?) help icon in AR view
 *   categoryOverrides: {          // Per-category content overrides
 *     [category]: {
 *       title: string,
 *       subtitle: string,
 *       proTip: string,
 *       steps: [{ title, desc }]  // Only title+desc editable; SVG stays fixed
 *     }
 *   }
 * }
 */

const STORAGE_KEY = 'ar_guide_config';

const DEFAULT_CONFIG = {
  entryModalEnabled: true,
  helpIconEnabled: true,
  categoryOverrides: {},
};

export function loadARGuideConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveARGuideConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function resetARGuideConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
