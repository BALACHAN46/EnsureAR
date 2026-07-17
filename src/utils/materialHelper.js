import * as THREE from 'three';

/**
 * Extracts all meshes from a scene, optionally applies custom material properties,
 * and ensures materials are cloned so we don't mutate globally cached models.
 *
 * @param {THREE.Object3D} scene - The original scene from useGLTF or OBJLoader
 * @param {Object} customMaterials - Object mapping mesh names to material properties e.g., { "Mesh_1": { color: "#ff0000" } }
 * @returns {Object} { clonedScene: THREE.Object3D, availableMeshes: Array<{name: string, originalColor: string}> }
 */
export function applyAndExtractMaterials(scene, customMaterials = {}) {
  if (!scene) return { clonedScene: null, availableMeshes: [] };

  const clonedScene = scene.clone();
  const availableMeshes = [];

  // We need to keep track of cloned materials to avoid redundant cloning 
  // if multiple meshes share the same material in the original scene.
  const clonedMaterials = new Map();

  clonedScene.traverse((child) => {
    if (child.isMesh) {
      const meshName = child.name || child.uuid;
      
      // Store info for the UI
      let originalColor = '#ffffff';
      
      if (child.material) {
        // Handle array of materials (MultiMaterial) or single material
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(mat => {
           if (mat.color) {
               originalColor = '#' + mat.color.getHexString();
           }
        });

        // Clone material if not already cloned
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => {
            if (!clonedMaterials.has(mat.uuid)) {
              clonedMaterials.set(mat.uuid, mat.clone());
            }
            return clonedMaterials.get(mat.uuid);
          });
        } else {
          if (!clonedMaterials.has(child.material.uuid)) {
            clonedMaterials.set(child.material.uuid, child.material.clone());
          }
          child.material = clonedMaterials.get(child.material.uuid);
        }
      }

      availableMeshes.push({
        id: meshName,
        name: meshName,
        originalColor: originalColor
      });

      // Apply custom materials if defined for this mesh
      if (customMaterials[meshName] && child.material) {
        const props = customMaterials[meshName];
        const materialsToUpdate = Array.isArray(child.material) ? child.material : [child.material];
        
        materialsToUpdate.forEach(mat => {
          if (props.color && mat.color) {
            mat.color.set(props.color);
          }
          if (props.metalness !== undefined && mat.metalness !== undefined) {
             mat.metalness = props.metalness;
          }
          if (props.roughness !== undefined && mat.roughness !== undefined) {
             mat.roughness = props.roughness;
          }
        });
      }
    }
  });

  return { clonedScene, availableMeshes };
}
