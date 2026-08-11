/**
 * arGuideConfig
 * ----------------
 * AR Guide Modal configuration — backed by the real API (Modules/AR) instead
 * of localStorage.
 *
 * Config shape (unchanged from before, so ARGuideSettingsPage/ARViewPage/
 * ARGuideModal don't need to change how they read it):
 * {
 *   entryModalEnabled: boolean,
 *   helpIconEnabled: boolean,
 *   categoryOverrides: {
 *     [categorySlug]: { title, subtitle, proTip, steps: [{ title, desc }] }
 *   }
 * }
 */

import { getGlobalGuideSettings, updateGlobalGuideSettings, updateGuideByCategory, updateGuideSteps } from '../services/arApi';

const DEFAULT_CONFIG = {
  entryModalEnabled: true,
  helpIconEnabled: true,
  categoryOverrides: {},
};

function stepsToArray(steps) {
  const byOrder = new Map((steps || []).map(s => [s.stepOrder, s]));
  return [1, 2, 3, 4].map(order => {
    const s = byOrder.get(order);
    return {
      ...(s?.title && { title: s.title }),
      ...(s?.description && { desc: s.description })
    };
  });
}

function mapApiToConfig(apiResult) {
  const categoryOverrides = {};
  for (const cat of apiResult.categories || []) {
    const steps = stepsToArray(cat.steps);
    const hasOverride = cat.title || cat.subtitle || cat.proTip || steps.some(s => s.title || s.desc);
    if (hasOverride) {
      categoryOverrides[cat.categorySlug] = {
        ...(cat.title && { title: cat.title }),
        ...(cat.subtitle && { subtitle: cat.subtitle }),
        ...(cat.proTip && { proTip: cat.proTip }),
        steps,
      };
    }
  }
  return {
    entryModalEnabled: apiResult.entryModalEnabled,
    helpIconEnabled: apiResult.helpIconEnabled,
    categoryOverrides,
  };
}

export async function loadARGuideConfig() {
  try {
    const result = await getGlobalGuideSettings();
    return mapApiToConfig(result);
  } catch (err) {
    console.warn('Could not load AR guide config, using defaults.', err);
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveARGuideConfig(config) {
  try {
    await updateGlobalGuideSettings({
      entryModalEnabled: !!config.entryModalEnabled,
      helpIconEnabled: !!config.helpIconEnabled,
    });

    const overrides = config.categoryOverrides || {};
    await Promise.all(Object.entries(overrides).map(async ([slug, ov]) => {
      await updateGuideByCategory(slug, {
        title: ov.title || null,
        subtitle: ov.subtitle || null,
        proTip: ov.proTip || null,
      });
      const steps = (ov.steps || []).map((s, idx) => ({
        stepOrder: idx + 1,
        title: s?.title || null,
        description: s?.desc || null,
      }));
      await updateGuideSteps(slug, steps);
    }));

    return true;
  } catch (err) {
    console.warn('Could not save AR guide config.', err);
    return false;
  }
}

export async function resetARGuideConfig() {
  try {
    await updateGlobalGuideSettings({ entryModalEnabled: true, helpIconEnabled: true });
    const result = await getGlobalGuideSettings();
    await Promise.all((result.categories || []).map(async (cat) => {
      await updateGuideByCategory(cat.categorySlug, { title: null, subtitle: null, proTip: null });
      await updateGuideSteps(cat.categorySlug, [1, 2, 3, 4].map(stepOrder => ({ stepOrder, title: null, description: null })));
    }));
  } catch (err) {
    console.warn('Could not reset AR guide config.', err);
  }
}
