(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Wrist = global.EnsureAR.Wrist || {};

    const CONFIDENCE_TIMEOUT_MS = 300;

    global.EnsureAR.Wrist.WristController = class WristController {
        constructor(scene) {
            this.scene = scene;
            this.mapper = new global.EnsureAR.Wrist.WristMapper();

            const AdaptiveOneEuroFilter = global.EnsureAR.Shared.AdaptiveOneEuroFilter;
            this.filters = {
                x: new AdaptiveOneEuroFilter(30, 1.2, 0.005, 1.0),
                y: new AdaptiveOneEuroFilter(30, 1.2, 0.005, 1.0),
                z: new AdaptiveOneEuroFilter(30, 1.2, 0.005, 1.0),
                scale: new AdaptiveOneEuroFilter(30, 0.5, 0.002, 1.0),
            };

            this.debugRenderer = new global.EnsureAR.Shared.HandDebugRenderer(scene);

            this.lastValidTime = 0;
            this.lastValidState = null;
        }

        reset() {
            Object.values(this.filters).forEach(f => f.reset());
            this.lastValidTime = 0;
            this.lastValidState = null;
        }

        update(handResult, modelNode, occluderNode, modelMeta, W, H) {
            const ts = performance.now();
            const DEPTH_SCALE = -200;

            const mapData = this.mapper.map(handResult, modelMeta, W, H, DEPTH_SCALE, ts);

            if (!mapData) {
                if (ts - this.lastValidTime < CONFIDENCE_TIMEOUT_MS && this.lastValidState) {
                    this._applyState(this.lastValidState, modelNode, occluderNode);
                    if (global.DEBUG_AR) {
                        this.debugRenderer.draw(this.lastValidState.raw, this.lastValidState.model.position, 'watch');
                    } else {
                        this.debugRenderer.hide();
                    }
                    return { isTracking: true, missingMsg: null };
                } else {
                    modelNode.visible = false;
                    if (occluderNode) occluderNode.visible = false;
                    if (global.DEBUG_AR) this.debugRenderer.hide();
                    return { isTracking: false, missingMsg: 'Show your wrist to the camera' };
                }
            }

            const fx = this.filters.x.filter(mapData.rawX, ts, 1.0);
            const fy = this.filters.y.filter(mapData.rawY, ts, 1.0);
            const fz = this.filters.z.filter(mapData.rawZ, ts, 1.0);
            const fScale = this.filters.scale.filter(mapData.rawScale, ts, 1.0);

            const finalState = this.mapper.finalize(fx, fy, fz, fScale, mapData, modelMeta, W, H);

            this.lastValidTime = ts;
            this.lastValidState = finalState;

            this._applyState(finalState, modelNode, occluderNode);

            // if (global.DEBUG_AR) {
            //     this.debugRenderer.draw(mapData, finalState.model.position, 'watch');
            // } else {
            //     this.debugRenderer.hide();
            // }

            return { isTracking: true, missingMsg: null };
        }

        _applyState(state, modelNode, occluderNode) {
            modelNode.position.copy(state.model.position);
            modelNode.quaternion.copy(state.model.quaternion);
            modelNode.scale.copy(state.model.scale);
            modelNode.visible = true;

            if (occluderNode) {
                occluderNode.position.copy(state.occluder.position);
                occluderNode.quaternion.copy(state.occluder.quaternion);
                occluderNode.scale.copy(state.occluder.scale);
                occluderNode.visible = true;
            }
        }
    };
})(window);
