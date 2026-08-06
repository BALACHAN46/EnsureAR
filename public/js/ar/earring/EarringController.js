(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Earring = global.EnsureAR.Earring || {};

    const CONFIDENCE_TIMEOUT_MS = 300; 

    global.EnsureAR.Earring.EarringController = class EarringController {
        constructor(scene) {
            this.scene = scene;
            this.mapper = new global.EnsureAR.Earring.EarringMapper();

            const AdaptiveOneEuroFilter = global.EnsureAR.Shared.AdaptiveOneEuroFilter;
            this.filters = {
                Lx: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                Ly: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                Lz: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                Rx: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                Ry: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                Rz: new AdaptiveOneEuroFilter(30, 0.8, 0.005, 1.0),
                scale: new AdaptiveOneEuroFilter(30, 0.5, 0.002, 1.0),
            };

            this.lastValidTime = 0;
            this.lastValidState = null;
        }

        reset() {
            Object.values(this.filters).forEach(f => f.reset());
            this.lastValidTime = 0;
            this.lastValidState = null;
        }

        update(faceResult, modelNodeLeft, modelNodeRight, modelMeta, W, H) {
            const ts = performance.now();
            const DEPTH_SCALE = -200;

            const mapData = this.mapper.map(faceResult, modelMeta, W, H, DEPTH_SCALE, ts);

            if (!mapData) {
                if (ts - this.lastValidTime < CONFIDENCE_TIMEOUT_MS && this.lastValidState) {
                    this._applyState(this.lastValidState, modelNodeLeft, modelNodeRight);
                    return { isTracking: true, missingMsg: null };
                } else {
                    if (modelNodeLeft) modelNodeLeft.visible = false;
                    if (modelNodeRight) modelNodeRight.visible = false;
                    return { isTracking: false, missingMsg: 'Face not visible' };
                }
            }

            const fLx = this.filters.Lx.filter(mapData.rawLx, ts, 1.0);
            const fLy = this.filters.Ly.filter(mapData.rawLy, ts, 1.0);
            const fLz = this.filters.Lz.filter(mapData.rawLz, ts, 1.0);
            const fRx = this.filters.Rx.filter(mapData.rawRx, ts, 1.0);
            const fRy = this.filters.Ry.filter(mapData.rawRy, ts, 1.0);
            const fRz = this.filters.Rz.filter(mapData.rawRz, ts, 1.0);
            const fScale = this.filters.scale.filter(mapData.rawScale, ts, 1.0);

            const finalState = this.mapper.finalize(fLx, fLy, fLz, fRx, fRy, fRz, fScale, mapData, modelMeta, W, H);

            this.lastValidTime = ts;
            this.lastValidState = finalState;

            this._applyState(finalState, modelNodeLeft, modelNodeRight);

            return { isTracking: true, missingMsg: null };
        }

        _applyState(state, modelNodeLeft, modelNodeRight) {
            if (modelNodeLeft) {
                modelNodeLeft.position.copy(state.left.position);
                modelNodeLeft.quaternion.copy(state.left.quaternion);
                modelNodeLeft.scale.copy(state.left.scale);
                modelNodeLeft.visible = true;
            }
            if (modelNodeRight) {
                modelNodeRight.position.copy(state.right.position);
                modelNodeRight.quaternion.copy(state.right.quaternion);
                modelNodeRight.scale.copy(state.right.scale);
                modelNodeRight.visible = true;
            }
        }
    };
})(window);
