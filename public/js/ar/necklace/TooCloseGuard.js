(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    const TCG_FACE_WIDTH_MAX = 0.30;
    const TCG_EYE_DIST_MAX = 0.105;
    const TCG_CHIN_Y_MIN = 0.18;
    const TCG_NOSE_Z_MAX = -0.06;
    const TCG_MIN_FACTORS = 2;
    const TCG_RELEASE_FRAMES = 10;

    global.EnsureAR.Necklace.TooCloseGuard = class TooCloseGuard {
        constructor() {
            this._triggered = false;
            this._clearFrames = 0;
        }

        check(faceResult) {
            const LM = global.EnsureAR.Landmarker;
            if (!LM || !faceResult?.faceLandmarks?.length) return this._triggered;

            const leftFace = LM.getFaceLandmark(faceResult, 234);
            const rightFace = LM.getFaceLandmark(faceResult, 454);
            const chin = LM.getFaceLandmark(faceResult, LM.FACE.CHIN);
            const nose = LM.getFaceLandmark(faceResult, LM.FACE.NOSE_TIP);

            let factors = 0;

            if (leftFace && rightFace) {
                const faceWidth = Math.abs(rightFace.x - leftFace.x);
                if (faceWidth > TCG_FACE_WIDTH_MAX) factors++;
            }

            const interEye = LM.getInterEyeDistance?.(faceResult);
            if (interEye !== null && interEye > TCG_EYE_DIST_MAX) factors++;

            if (chin && chin.y < TCG_CHIN_Y_MIN) factors++;

            if (nose && nose.z < TCG_NOSE_Z_MAX) factors++;

            const isTooClose = factors >= TCG_MIN_FACTORS;

            if (isTooClose) {
                this._triggered = true;
                this._clearFrames = 0;
            } else if (this._triggered) {
                this._clearFrames++;
                if (this._clearFrames >= TCG_RELEASE_FRAMES) {
                    this._triggered = false;
                }
            }

            return this._triggered;
        }

        reset() { this._triggered = false; this._clearFrames = 0; }
    };
})(window);
