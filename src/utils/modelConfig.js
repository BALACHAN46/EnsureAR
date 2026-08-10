// Utility functions for model AR tuning configuration.
// Backed by the real API (Modules/AR) instead of localStorage/model-defaults.json.

import { getARModel, updateTuning, resetTuning } from '../services/arApi';
import { updateProductMaterial } from '../services/productsApi';

/** Flattens the API's nested tuning shape into the flat {posX, posY, ...} shape the rest of the app already expects. */
function flattenTuning(arModel) {
  const t = arModel.tuning;
  const flat = {
    posX: t.position.x, posY: t.position.y, posZ: t.position.z,
    rotX: t.rotation.x, rotY: t.rotation.y, rotZ: t.rotation.z,
    leftPosX: t.leftPosition.x, leftPosY: t.leftPosition.y, leftPosZ: t.leftPosition.z,
    leftRotX: t.leftRotation.x, leftRotY: t.leftRotation.y, leftRotZ: t.leftRotation.z,
    scale: t.scale, scaleY: t.scaleY,
    necklaceBlur: t.necklaceBlur,
    enableSparkles: t.enableSparkles,
    category: arModel.categorySlug,
  };
  if (t.ring) {
    flat.ring = {
      rightHandFrontOffset: t.ring.frontOffset,
      rightHandBackOffset: t.ring.backOffset,
      leftHandFrontOffset: t.ring.leftFrontOffset,
      leftHandBackOffset: t.ring.leftBackOffset,
      frontScale: t.ring.frontScale,
      backScale: t.ring.backScale,
      selectedFinger: t.ring.selectedFinger,
    };
  }
  return flat;
}

/**
 * Get the current AR tuning config for a model, straight from the database.
 * @param {string} modelId - the model's public code
 */
export async function getModelConfig(modelId) {
  try {
    const arModel = await getARModel(modelId);
    return flattenTuning(arModel);
  } catch {
    // Model not found / API unreachable — fall back to inert defaults so the AR view doesn't crash.
    return { posX: 0, posY: 0, posZ: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1, scaleY: 1 };
  }
}

/**
 * Save AR tuning config for a model.
 * @param {string} modelId
 * @param {object} config - { posX, posY, posZ, rotX, rotY, rotZ, scale, scaleY, necklaceBlur, enableSparkles, leftPosX, ..., ring }
 */
export async function saveModelConfig(modelId, config) {
  try {
    await updateTuning(modelId, {
      posX: config.posX ?? 0, posY: config.posY ?? 0, posZ: config.posZ ?? 0,
      rotX: config.rotX ?? 0, rotY: config.rotY ?? 0, rotZ: config.rotZ ?? 0,
      leftPosX: config.leftPosX, leftPosY: config.leftPosY, leftPosZ: config.leftPosZ,
      leftRotX: config.leftRotX, leftRotY: config.leftRotY, leftRotZ: config.leftRotZ,
      scale: config.scale ?? 1, scaleY: config.scaleY ?? 1,
      necklaceBlur: config.necklaceBlur, enableSparkles: !!config.enableSparkles,
      ringFrontOffset: config.ring?.rightHandFrontOffset,
      ringBackOffset: config.ring?.rightHandBackOffset,
      ringLeftFrontOffset: config.ring?.leftHandFrontOffset,
      ringLeftBackOffset: config.ring?.leftHandBackOffset,
      ringFrontScale: config.ring?.frontScale,
      ringBackScale: config.ring?.backScale,
      ringSelectedFinger: config.ring?.selectedFinger,
    });
    return { success: true };
  } catch (err) {
    console.warn('Could not save AR tuning.', err);
    return { success: false, error: err.message };
  }
}

/**
 * Update the material tag for a model.
 * @param {string} modelId
 * @param {string} material
 */
export async function updateModelMaterial(modelId, material) {
  try {
    await updateProductMaterial(modelId, material);
    return { success: true };
  } catch (err) {
    console.warn('Could not update material.', err);
    return { success: false, error: err.message };
  }
}

/**
 * Reset a model's AR tuning back to neutral defaults.
 * @param {string} modelId
 */
export async function resetModelConfig(modelId) {
  await resetTuning(modelId);
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
 * Convert leftPosX/leftPosY/leftPosZ → [x, y, z] for left hand
 * Defaults to the right hand config if left is not defined
 */
export function configToLeftPosition(config) {
  return [
    config.leftPosX ?? config.posX ?? 0,
    config.leftPosY ?? config.posY ?? 0,
    config.leftPosZ ?? config.posZ ?? 0
  ];
}

/**
 * Convert leftRotX/leftRotY/leftRotZ → [x, y, z] for left hand
 * Defaults to the right hand config if left is not defined
 */
export function configToLeftRotation(config) {
  return [
    config.leftRotX ?? config.rotX ?? 0,
    config.leftRotY ?? config.rotY ?? 0,
    config.leftRotZ ?? config.rotZ ?? 0
  ];
}

/**
 * Get the uniform scale value for Three.js
 */
export function configToScale(config) {
  return config.scale ?? 1;
}

/**
 * Get the Y-axis scale value for Three.js (height scaling)
 */
export function configToScaleY(config) {
  return config.scaleY ?? 1;
}

/**
 * Get necklace top blur amount (0-100, default 18)
 */
export function configToNecklaceBlur(config) {
  return config.necklaceBlur ?? 18;
}
