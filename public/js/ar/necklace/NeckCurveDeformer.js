(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    const CURVE_EMA = 0.18;

    global.EnsureAR.Necklace.NeckCurveDeformer = class NeckCurveDeformer {
        constructor() {
            this._sideStretch = 1.0;
            this._curvature = 1.0;
        }

        compute(leftNeckSide, rightNeckSide, neckBase, anchor) {
            if (!leftNeckSide || !rightNeckSide || !neckBase || !anchor) {
                return { sideStretch: this._sideStretch, curvature: this._curvature };
            }

            const chainWidth = leftNeckSide.distanceTo(rightNeckSide);
            const anchorHalfW = Math.max(anchor.distanceTo(leftNeckSide), 1);

            const rawStretch = THREE.MathUtils.clamp(chainWidth / (anchorHalfW * 2), 0.85, 1.15);

            const midZ = (leftNeckSide.z + rightNeckSide.z) * 0.5;
            const baseProtrusion = neckBase.z - midZ; 
            const rawCurvature = THREE.MathUtils.clamp(
                1.0 + (baseProtrusion / Math.max(chainWidth, 1)) * 0.40,
                0.90, 1.12
            );

            this._sideStretch = CURVE_EMA * rawStretch + (1 - CURVE_EMA) * this._sideStretch;
            this._curvature = CURVE_EMA * rawCurvature + (1 - CURVE_EMA) * this._curvature;

            return { sideStretch: this._sideStretch, curvature: this._curvature };
        }

        reset() { this._sideStretch = 1.0; this._curvature = 1.0; }
    };
})(window);
