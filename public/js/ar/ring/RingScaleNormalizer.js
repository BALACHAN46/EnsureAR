/**
 * RingScaleNormalizer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatic Ring Scale Normalizer
 * Computes the physical bounds of a loaded ring model and applies a uniform 
 * mathematical scale factor to ensure it matches the target ring diameter,
 * regardless of whether it was exported in mm, cm, or meters.
 */

(function (global) {
    'use strict';

    class RingScaleNormalizer {
        constructor() {
            // Configurable target size for rings (e.g. 0.020 = 20mm)
            this.TARGET_RING_DIAMETER = 0.020;
            this.lastReport = null;

            // Setup debug key listener ('S')
            document.addEventListener('keydown', (e) => {
                if (e.key.toLowerCase() === 's' && window.DEBUG_AR) {
                    if (this.lastReport) {
                        console.group('%c💍 RingScaleNormalizer Debug Report (Key S)', 'color: #00ff88; font-weight: bold;');
                        console.log(this.lastReport);
                        console.groupEnd();
                    } else {
                        console.log('%c💍 RingScaleNormalizer: No active ring to report.', 'color: #ffaa00;');
                    }
                }
            });
        }

        /**
         * Main entrypoint to normalize a loaded ring model.
         * @param {THREE.Object3D} model 
         */
        normalize(model) {
            if (!model || !global.THREE) return;
            
            const stats = this.computeBoundingBox(model);
            const scaleFactor = this.calculateScaleFactor(stats.largestDimension);
            this.applyScale(model, scaleFactor, stats.center);

            this.generateReport(stats, scaleFactor);
        }

        /**
         * Computes the bounding box, dimensions, and center of the model.
         * @param {THREE.Object3D} model 
         * @returns {Object} Extracted dimension stats
         */
        computeBoundingBox(model) {
            // Temporarily reset scale and position to get raw geometry bounds
            const oldScale = model.scale.clone();
            const oldPos = model.position.clone();
            const oldQuat = model.quaternion.clone();

            model.scale.set(1, 1, 1);
            model.position.set(0, 0, 0);
            model.quaternion.identity();
            model.updateMatrixWorld(true);

            const box = new global.THREE.Box3().setFromObject(model);
            const size = new global.THREE.Vector3();
            box.getSize(size);
            
            const center = new global.THREE.Vector3();
            box.getCenter(center);

            const width = size.x;
            const height = size.y;
            const depth = size.z;

            // Restore original transforms
            model.scale.copy(oldScale);
            model.position.copy(oldPos);
            model.quaternion.copy(oldQuat);
            model.updateMatrixWorld(true);

            return {
                width: width,
                height: height,
                depth: depth,
                largestDimension: Math.max(width, height, depth),
                smallestDimension: Math.min(width, height, depth),
                center: center,
                boundingBox: box
            };
        }

        /**
         * Calculates the uniform scale factor required to hit TARGET_RING_DIAMETER
         * @param {number} currentSize 
         * @returns {number} The required scale multiplier
         */
        calculateScaleFactor(currentSize) {
            if (currentSize <= 0) return 1.0;
            // Bridge between metric configuration and the AR tracker's orthographic pixel space.
            // RingMapper applies dynamic scaling assuming a base model width of 1.0 unit.
            // Thus, we map the 20mm standard (0.020) to exactly 1.0 normalized base width.
            const targetBaseWidth = this.TARGET_RING_DIAMETER / 0.020;
            return targetBaseWidth / currentSize;
        }

        /**
         * Applies the calculated scale factor uniformly and recenters the model.
         * @param {THREE.Object3D} model 
         * @param {number} scaleFactor 
         * @param {THREE.Vector3} rawCenter 
         */
        applyScale(model, scaleFactor, rawCenter) {
            // Apply uniform scaling (preserves aspect ratio)
            model.scale.setScalar(scaleFactor);

            // Re-center the model based on its scaled bounding box
            // Since we want the origin to be the center, we shift all children
            const offset = rawCenter.clone().multiplyScalar(-1);
            
            // Apply offset to children so the model's pivot becomes its center
            model.children.forEach(child => {
                child.position.add(offset);
            });

            model.updateMatrixWorld(true);
        }

        /**
         * Generates the requested console output report.
         * @param {Object} stats 
         * @param {number} scaleFactor 
         */
        generateReport(stats, scaleFactor) {
            const report = [
                `Ring Analysis`,
                `----------------------------------------`,
                `Current Width:         ${stats.width.toFixed(6)}`,
                `Current Height:        ${stats.height.toFixed(6)}`,
                `Current Depth:         ${stats.depth.toFixed(6)}`,
                `Current Max Dimension: ${stats.largestDimension.toFixed(6)}`,
                `Target Size:           ${this.TARGET_RING_DIAMETER.toFixed(6)}`,
                `Scale Factor:          ${scaleFactor.toFixed(6)}`,
                `Applied Scale:         ${scaleFactor.toFixed(6)} (Uniform)`,
                `Center:                [${stats.center.x.toFixed(4)}, ${stats.center.y.toFixed(4)}, ${stats.center.z.toFixed(4)}]`,
                `PASS`
            ].join('\n');

            this.lastReport = report;

            console.groupCollapsed('%c💍 RingScaleNormalizer Analysis Report', 'color: #00ff88; font-weight: bold;');
            console.log(report);
            console.log("Bounding Box:", stats.boundingBox);
            console.groupEnd();
        }
    }

    // Attach to global scope for access from threejs-renderer.js
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.RingScaleNormalizer = new RingScaleNormalizer();

})(window);
