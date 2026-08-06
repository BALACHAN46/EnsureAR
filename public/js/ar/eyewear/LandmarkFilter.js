(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    // Internal One Euro Filter implementation
    class OneEuroFilter {
        constructor(freq = 30, minCutoff = 1.5, beta = 0.008, dCutoff = 1.0) {
            this.freq = freq; this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
            this._x = null; this._dx = null; this._lastTime = null;
        }
        _alpha(cutoff) { const tau = 1 / (2 * Math.PI * cutoff); const te = 1 / this.freq; return 1 / (1 + tau / te); }
        filter(x, timestamp) {
            if (this._lastTime !== null) {
                const dt = (timestamp - this._lastTime) / 1000;
                if (dt > 0) this.freq = 1 / dt;
            }
            this._lastTime = timestamp;
            if (this._x === null) { this._x = x; this._dx = 0; return x; }
            const aD = this._alpha(this.dCutoff);
            const dx = (x - this._x) * this.freq;
            this._dx = aD * dx + (1 - aD) * this._dx;
            const cutoff = this.minCutoff + this.beta * Math.abs(this._dx);
            const a = this._alpha(cutoff);
            this._x = a * x + (1 - a) * this._x;
            return this._x;
        }
        reset() { this._x = null; this._dx = null; this._lastTime = null; }
    }

    class AdaptiveOneEuroFilter extends OneEuroFilter {
        constructor(freq = 30, minCutoff = 1.5, baseBeta = 0.008, dCutoff = 1.0, velocityGain = 0.25, velTau = 0.06) {
            super(freq, minCutoff, baseBeta, dCutoff);
            this._baseBeta = baseBeta; this._velocityGain = velocityGain; this._velTau = velTau; this._velocityEMA = 0;
        }
        filter(x, timestamp, scale = 1.0) {
            if (this._x !== null && this._lastTime !== null) {
                const dt = Math.max((timestamp - this._lastTime) / 1000, 1e-4);
                const rawVel = (Math.abs(x - this._x) / scale) / dt;
                const velAlpha = dt / (this._velTau + dt);
                this._velocityEMA = velAlpha * rawVel + (1 - velAlpha) * this._velocityEMA;
            }
            this.beta = Math.min(this._baseBeta * 10, this._baseBeta + this._velocityGain * this._velocityEMA);
            return super.filter(x, timestamp);
        }
        reset() { super.reset(); this._velocityEMA = 0; this.beta = this._baseBeta; }
    }

    global.EnsureAR.Eyewear.LandmarkFilter = class LandmarkFilter {
        constructor() {
            // Tighter minCutoff for eyewear face locking
            this.x = new AdaptiveOneEuroFilter(30, 2.0, 0.012, 1.0, 0.40, 0.06);
            this.y = new AdaptiveOneEuroFilter(30, 2.0, 0.012, 1.0, 0.40, 0.06);
            this.z = new AdaptiveOneEuroFilter(30, 2.0, 0.012, 1.0, 0.30, 0.06);
            // Higher minCutoff (1.8) + velocityGain (0.35) so scale recovery after
            // a quick head-rotation spike is fast, while steady-state is still smooth.
            this.scale = new AdaptiveOneEuroFilter(30, 1.8, 0.008, 1.0, 0.35, 0.08);
            
            // Euler rotation filters
            this.rotX = new AdaptiveOneEuroFilter(30, 2.0, 0.012, 1.0, 0.30, 0.06);
            this.rotY = new AdaptiveOneEuroFilter(30, 2.0, 0.012, 1.0, 0.30, 0.06);
            this.rotZ = new AdaptiveOneEuroFilter(30, 2.0, 0.012, 1.0, 0.30, 0.06);
        }

        filterTransform(pos, quat, scale, timestamp) {
            const fx = this.x.filter(pos.x, timestamp);
            const fy = this.y.filter(pos.y, timestamp);
            const fz = this.z.filter(pos.z, timestamp);
            const fs = this.scale.filter(scale, timestamp);

            // Convert quaternion to Euler for continuous filtering
            const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
            
            // Handle Euler angle wrapping (-180 to 180) to prevent 360 spin jumps
            if (this.rotX._x !== null) {
                if (euler.x - this.rotX._x > Math.PI) euler.x -= Math.PI * 2;
                else if (euler.x - this.rotX._x < -Math.PI) euler.x += Math.PI * 2;
            }
            if (this.rotY._x !== null) {
                if (euler.y - this.rotY._x > Math.PI) euler.y -= Math.PI * 2;
                else if (euler.y - this.rotY._x < -Math.PI) euler.y += Math.PI * 2;
            }
            if (this.rotZ._x !== null) {
                if (euler.z - this.rotZ._x > Math.PI) euler.z -= Math.PI * 2;
                else if (euler.z - this.rotZ._x < -Math.PI) euler.z += Math.PI * 2;
            }

            const frx = this.rotX.filter(euler.x, timestamp);
            const fry = this.rotY.filter(euler.y, timestamp);
            const frz = this.rotZ.filter(euler.z, timestamp);

            const filteredQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(frx, fry, frz, 'YXZ'));

            return {
                position: new THREE.Vector3(fx, fy, fz),
                quaternion: filteredQuat,
                scale: fs
            };
        }

        reset() {
            this.x.reset(); this.y.reset(); this.z.reset(); this.scale.reset();
            this.rotX.reset(); this.rotY.reset(); this.rotZ.reset();
        }
    };
})(window);
