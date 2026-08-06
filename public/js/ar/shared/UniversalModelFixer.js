(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Shared = global.EnsureAR.Shared || {};

    const CATEGORY_RULES = {
        'ring': {
            scaleRef: 'max', targetScale: 1.0, pivot: 'center',
            logic: 'shortest_axis_is_z'
        },
        'eyewear': {
            scaleRef: 'x', targetScale: 1.30, pivot: 'center',
            logic: 'none' // Do not auto-rotate eyewear, rely on designer
        },
        'watch': {
            scaleRef: 'max', targetScale: 1.0, pivot: 'wrist',
            logic: 'none'
        },
        'necklace': {
            scaleRef: 'x', targetScale: 1.0, pivot: 'top',
            logic: 'none'
        },
        'bracelet': {
            scaleRef: 'max', targetScale: 1.0, pivot: 'center',
            logic: 'none'
        },
        'earrings': {
            scaleRef: 'x', targetScale: 1.0, pivot: 'center',
            logic: 'none'
        }
    };

    class UniversalModelFixer {
        constructor() {
            this.metadataCache = new Map();
        }

        normalize(wrapper, category) {
            console.groupCollapsed(`[UniversalModelFixer] Analyzing ${category} model...`);

            // Default to necklace rules if category is unknown
            const rule = CATEGORY_RULES[category] || CATEGORY_RULES['necklace'];
            const innerModel = wrapper.children[0];

            // 1. ModelAnalyzer: Gather meshes and material info
            const report = this._analyzeMeshes(innerModel);

            // 2. MaterialValidator: Fix materials (depth sorting, side)
            this._validateMaterials(innerModel);

            // Temporarily disabled highly aggressive Bounding-Box auto-rotation.
            // Bounding box ratios for jewelry are extremely unpredictable (e.g. rings with large gems).
            // this._detectAndAlignOrientation(innerModel, rule.logic);

            // 4. ScaleNormalizer
            let box = new THREE.Box3().setFromObject(innerModel);
            let size = box.getSize(new THREE.Vector3());

            let scaleFactor = 1.0;
            if (rule.scaleRef === 'x' && size.x > 0) {
                scaleFactor = rule.targetScale / size.x;
            } else if (rule.scaleRef === 'max') {
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 0) scaleFactor = rule.targetScale / maxDim;
            }

            innerModel.scale.setScalar(scaleFactor);
            innerModel.updateMatrixWorld(true);

            // 5. PivotCorrector (Translate geometry to center/top)
            box = new THREE.Box3().setFromObject(innerModel);
            size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            if (rule.pivot === 'top') {
                innerModel.position.x -= center.x;
                innerModel.position.y -= box.max.y; // Top at origin
                innerModel.position.z -= center.z;
            } else if (rule.pivot === 'center') {
                innerModel.position.x -= center.x;
                innerModel.position.y -= center.y;
                innerModel.position.z -= center.z;

                // RESTORE MISSING EYEWEAR OFFSETS
                if (category === 'eyewear') {
                    innerModel.position.z -= size.z * 0.45; // Push glasses toward face
                    innerModel.position.y -= size.y * 0.02; // Rest on nose bridge
                }
            } else if (rule.pivot === 'wrist') {
                // Watches: usually sit on top of the wrist (positive Z relative to center)
                innerModel.position.x -= center.x;
                innerModel.position.y -= center.y;
                innerModel.position.z -= center.z;
            }

            // 6. Generate Metadata Report
            const metadata = {
                category: category,
                meshCount: report.meshes,
                vertices: report.vertices,
                correctedScale: scaleFactor.toFixed(4),
                pivotStrategy: rule.pivot,
                finalBoundingBox: size.toArray().map(v => v.toFixed(3)),
            };
            this.lastReport = metadata;
            console.log("Auto-Correction Metadata:", metadata);
            console.groupEnd();

            return metadata;
        }

        _analyzeMeshes(model) {
            let meshCount = 0;
            let vertices = 0;
            model.traverse(node => {
                if (node.isMesh) {
                    meshCount++;
                    if (node.geometry && node.geometry.attributes.position) {
                        vertices += node.geometry.attributes.position.count;
                    }
                }
            });
            return { meshes: meshCount, vertices };
        }

        _validateMaterials(model) {
            model.traverse(node => {
                if (node.isMesh && node.material) {
                    const mats = Array.isArray(node.material) ? node.material : [node.material];
                    mats.forEach(m => {
                        m.depthWrite = true;
                        m.depthTest = true;
                        m.side = THREE.DoubleSide;
                        m.needsUpdate = true;
                    });
                }
            });
        }
    }

    global.EnsureAR.Shared.UniversalModelFixer = new UniversalModelFixer();

})(window);
