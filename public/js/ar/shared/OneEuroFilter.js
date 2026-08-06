(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Shared = global.EnsureAR.Shared || {};

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

    global.EnsureAR.Shared.OneEuroFilter = OneEuroFilter;
    global.EnsureAR.Shared.AdaptiveOneEuroFilter = AdaptiveOneEuroFilter;

})(window);
