(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    global.EnsureAR.Necklace.ScaleCalibrator = class ScaleCalibrator {
        constructor(framesToLearn = 30) {
            this.framesToLearn = framesToLearn;
            this.framesSeen = 0;
            this.refShoulderWidth = null;
            this.refNeckLength = null;
            this.refNeckWidth = null;
            this.refCameraZ = null;
            this.alpha = 0.15;
        }

        update(shoulderWidth, neckLength, neckWidth, cameraZ) {
            if (this.framesSeen < this.framesToLearn) {
                if (this.refShoulderWidth === null) {
                    this.refShoulderWidth = shoulderWidth;
                    this.refNeckLength = neckLength;
                    this.refNeckWidth = neckWidth;
                    this.refCameraZ = cameraZ;
                } else {
                    this.refShoulderWidth = this.alpha * shoulderWidth + (1 - this.alpha) * this.refShoulderWidth;
                    this.refNeckLength = this.alpha * neckLength + (1 - this.alpha) * this.refNeckLength;
                    this.refNeckWidth = this.alpha * neckWidth + (1 - this.alpha) * this.refNeckWidth;
                    this.refCameraZ = this.alpha * cameraZ + (1 - this.alpha) * this.refCameraZ;
                }
                this.framesSeen++;
            }
        }

        reset() {
            this.framesSeen = 0;
            this.refShoulderWidth = null;
            this.refNeckLength = null;
            this.refNeckWidth = null;
            this.refCameraZ = null;
        }

        get isReady() { return this.framesSeen > 0 && this.refShoulderWidth !== null; }
    };
})(window);
