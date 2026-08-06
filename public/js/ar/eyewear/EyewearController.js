(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    const CONFIDENCE_TIMEOUT_MS = 300;

    global.EnsureAR.Eyewear.EyewearController = class EyewearController {
        constructor(scene) {
            this.mapper = new global.EnsureAR.Eyewear.EyewearMapper();
            this.debugRenderer = new global.EnsureAR.Eyewear.DebugRenderer(scene);

            this.lastValidTime = 0;
            this.lastValidTransform = null;
        }

        /**
         * Updates the eyewear model every frame.
         * @param {Object} faceResult 
         * @param {Object} activeNode The Three.js Object3D for the eyewear model
         * @param {Object} modelMeta 
         * @param {number} w Width
         * @param {number} h Height
         * @returns {boolean} True if tracking is active or within confidence window, false if tracking lost
         */
        update(faceResult, activeNode, occluderNode, modelMeta, w, h) {
            const now = performance.now();
            const result = this.mapper.map(faceResult, modelMeta, w, h);

            if (result) {
                // Tracking is valid
                this.lastValidTime = now;
                this.lastValidTransform = result.model;
                this.lastValidOccluderTransform = result.occluder;

                this.applyTransform(activeNode, result.model);
                if (occluderNode) {
                    this.applyTransform(occluderNode, result.occluder);
                }

                // if (global.DEBUG_AR) {
                //     this.debugRenderer.draw(result.landmarks, result.rawAnchor, result.rawScale, w, h);
                // } else {
                //     this.debugRenderer.hide();
                // }
                return true;
            }

            // Tracking lost. Check confidence window
            if (now - this.lastValidTime < CONFIDENCE_TIMEOUT_MS && this.lastValidTransform) {
                // Freeze the last valid pose to prevent flickering
                this.applyTransform(activeNode, this.lastValidTransform);
                if (occluderNode && this.lastValidOccluderTransform) {
                    this.applyTransform(occluderNode, this.lastValidOccluderTransform);
                }
                return true;
            }

            // Tracking lost longer than timeout
            this.debugRenderer.hide();
            return false; // Tells the main renderer to hide the node
        }

        /**
         * Apply transformation strictly in TRS order
         */
        applyTransform(node, transform) {
            if (!node || !transform) return;
            node.position.copy(transform.position);
            node.quaternion.copy(transform.quaternion);
            node.scale.copy(transform.scale);

            // Set visibility to true when tracking is active
            node.visible = true;

            node.updateMatrix();
        }

        reset() {
            this.mapper.reset();
            this.lastValidTime = 0;
            this.lastValidTransform = null;
            this.debugRenderer.hide();
        }

        teardown() {
            this.debugRenderer.teardown();
        }
    };
})(window);
