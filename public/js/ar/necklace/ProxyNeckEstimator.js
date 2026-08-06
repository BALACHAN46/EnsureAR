(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    const PROXY_VIS_THRESHOLD = 0.50;
    const PROXY_VEL_DECAY = 0.82;
    const PROXY_EMA_ALPHA = 0.35;

    global.EnsureAR.Necklace.ProxyNeckEstimator = class ProxyNeckEstimator {
        constructor() {
            this._ls = { x: 0.5, y: 0.5, z: 0, vx: 0, vy: 0, vz: 0, valid: false };
            this._rs = { x: 0.5, y: 0.5, z: 0, vx: 0, vy: 0, vz: 0, valid: false };
        }

        update(rawLS, rawRS) {
            const getLMVis = global.EnsureAR.Landmarker?.getLandmarkVisibility ?? ((lm) => lm?.visibility ?? 1);
            const lsVis = getLMVis(rawLS);
            const rsVis = getLMVis(rawRS);

            let usingProxy = false;

            // Left shoulder
            if (rawLS && lsVis >= PROXY_VIS_THRESHOLD) {
                if (this._ls.valid) {
                    const dx = rawLS.x - this._ls.x;
                    const dy = rawLS.y - this._ls.y;
                    const dz = rawLS.z - this._ls.z;
                    this._ls.vx = PROXY_EMA_ALPHA * dx + (1 - PROXY_EMA_ALPHA) * this._ls.vx;
                    this._ls.vy = PROXY_EMA_ALPHA * dy + (1 - PROXY_EMA_ALPHA) * this._ls.vy;
                    this._ls.vz = PROXY_EMA_ALPHA * dz + (1 - PROXY_EMA_ALPHA) * this._ls.vz;
                }
                this._ls.x = rawLS.x; this._ls.y = rawLS.y; this._ls.z = rawLS.z;
                this._ls.valid = true;
            } else if (this._ls.valid) {
                this._ls.x += this._ls.vx;
                this._ls.y += this._ls.vy;
                this._ls.z += this._ls.vz;
                this._ls.vx *= PROXY_VEL_DECAY;
                this._ls.vy *= PROXY_VEL_DECAY;
                this._ls.vz *= PROXY_VEL_DECAY;
                usingProxy = true;
            } else {
                return null;
            }

            // Right shoulder
            if (rawRS && rsVis >= PROXY_VIS_THRESHOLD) {
                if (this._rs.valid) {
                    const dx = rawRS.x - this._rs.x;
                    const dy = rawRS.y - this._rs.y;
                    const dz = rawRS.z - this._rs.z;
                    this._rs.vx = PROXY_EMA_ALPHA * dx + (1 - PROXY_EMA_ALPHA) * this._rs.vx;
                    this._rs.vy = PROXY_EMA_ALPHA * dy + (1 - PROXY_EMA_ALPHA) * this._rs.vy;
                    this._rs.vz = PROXY_EMA_ALPHA * dz + (1 - PROXY_EMA_ALPHA) * this._rs.vz;
                }
                this._rs.x = rawRS.x; this._rs.y = rawRS.y; this._rs.z = rawRS.z;
                this._rs.valid = true;
            } else if (this._rs.valid) {
                this._rs.x += this._rs.vx;
                this._rs.y += this._rs.vy;
                this._rs.z += this._rs.vz;
                this._rs.vx *= PROXY_VEL_DECAY;
                this._rs.vy *= PROXY_VEL_DECAY;
                this._rs.vz *= PROXY_VEL_DECAY;
                usingProxy = true;
            } else {
                return null;
            }

            return { ls: this._ls, rs: this._rs, usingProxy };
        }

        reset() {
            this._ls = { x: 0.5, y: 0.5, z: 0, vx: 0, vy: 0, vz: 0, valid: false };
            this._rs = { x: 0.5, y: 0.5, z: 0, vx: 0, vy: 0, vz: 0, valid: false };
        }
    };
})(window);
