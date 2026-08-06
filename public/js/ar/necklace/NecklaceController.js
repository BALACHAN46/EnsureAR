(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    const CONFIDENCE_TIMEOUT_MS = 300; 

    global.EnsureAR.Necklace.NecklaceController = class NecklaceController {
        constructor(scene) {
            this.scene = scene;
            this.mapper = new global.EnsureAR.Necklace.NecklaceMapper();

            const AdaptiveOneEuroFilter = global.EnsureAR.Shared.AdaptiveOneEuroFilter;
            this.filters = {
                x: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                y: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                z: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                scaleX: new AdaptiveOneEuroFilter(30, 0.5, 0.002, 1.0),
                scaleY: new AdaptiveOneEuroFilter(30, 0.5, 0.002, 1.0),
            };

            this.lastValidTime = 0;
            this.lastValidState = null;
        }

        reset() {
            this.mapper.reset();
            Object.values(this.filters).forEach(f => f.reset());
            this.lastValidTime = 0;
            this.lastValidState = null;
        }

        update(faceResult, poseResult, modelNode, occluderNode, modelMeta, W, H) {
            const ts = performance.now();
            const DEPTH_SCALE = -200;

            const mapData = this.mapper.map(faceResult, poseResult, modelMeta, W, H, DEPTH_SCALE, ts);

            if (!mapData) {
                if (ts - this.lastValidTime < CONFIDENCE_TIMEOUT_MS && this.lastValidState) {
                    this._applyState(this.lastValidState, modelNode, occluderNode);
                    return { isTracking: true, tooClose: false, usingProxy: false, missingMsg: null };
                } else {
                    modelNode.visible = false;
                    if (occluderNode) occluderNode.visible = false;
                    return { isTracking: false, tooClose: false, usingProxy: false, missingMsg: 'Adjust position to fit face and shoulders' };
                }
            }

            if (mapData.tooClose) {
                // Freeze transform
                if (this.lastValidState) {
                    this._applyState(this.lastValidState, modelNode, occluderNode);
                }
                return { isTracking: true, tooClose: true, usingProxy: mapData.usingProxy, missingMsg: 'Too close to camera' };
            }

            const fx = this.filters.x.filter(mapData.rawX, ts, mapData.distRatio);
            const fy = this.filters.y.filter(mapData.rawY, ts, mapData.distRatio);
            const fz = this.filters.z.filter(mapData.rawZ, ts, mapData.distRatio);
            const fsX = this.filters.scaleX.filter(mapData.smoothedScaleX, ts, mapData.distRatio);
            const fsY = this.filters.scaleY.filter(mapData.smoothedScaleX, ts, mapData.distRatio);

            const finalState = this.mapper.finalize(fx, fy, fz, fsX, fsY, mapData, modelMeta, faceResult, poseResult, W, H, DEPTH_SCALE);

            this.lastValidTime = ts;
            this.lastValidState = finalState;

            this._applyState(finalState, modelNode, occluderNode);

            // Pass data to renderer
            modelNode.userData = modelNode.userData || {};
            modelNode.userData.velocity = finalState.velocity;
            modelNode.userData.warpParams = finalState.warpParams;
            modelNode.userData.neckCenter = finalState.neckCenter;
            modelNode.userData.neckW = finalState.neckW;

            return { isTracking: true, tooClose: false, usingProxy: finalState.usingProxy, missingMsg: null, debugData: finalState.debugData };
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
