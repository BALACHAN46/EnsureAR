(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    const BLINK_THRESHOLD = 0.015; // Vertical distance threshold for blinks

    global.EnsureAR.Eyewear.EyeTracker = class EyeTracker {
        constructor() {
            this.isBlinking = false;
        }

        /**
         * Extracts key landmarks and detects blinks.
         * @returns {Object|null} Extracted landmarks or null if missing.
         */
        track(faceResult) {
            const LM = global.EnsureAR?.Landmarker;
            if (!LM || !faceResult?.faceLandmarks?.length) return null;

            // Target landmarks for eyewear
            // Left eye: 33, 133, 159 (top), 145 (bottom)
            // Right eye: 263, 362, 386 (top), 374 (bottom)
            // Nose bridge: 6, 168
            // Face sides: 234, 454
            // Chin: 152
            // Forehead: 10

            const lEyeIn = LM.getFaceLandmark(faceResult, 133);
            const lEyeOut = LM.getFaceLandmark(faceResult, 33);
            const lEyeTop = LM.getFaceLandmark(faceResult, 159);
            const lEyeBot = LM.getFaceLandmark(faceResult, 145);

            const rEyeIn = LM.getFaceLandmark(faceResult, 362);
            const rEyeOut = LM.getFaceLandmark(faceResult, 263);
            const rEyeTop = LM.getFaceLandmark(faceResult, 386);
            const rEyeBot = LM.getFaceLandmark(faceResult, 374);

            const nose6 = LM.getFaceLandmark(faceResult, 6);
            const nose168 = LM.getFaceLandmark(faceResult, 168);
            const faceLeft = LM.getFaceLandmark(faceResult, 234);
            const faceRight = LM.getFaceLandmark(faceResult, 454);
            const chin = LM.getFaceLandmark(faceResult, 152);
            const forehead = LM.getFaceLandmark(faceResult, 10);

            if (!lEyeIn || !lEyeOut || !rEyeIn || !rEyeOut || !nose6 || !nose168 || !faceLeft || !faceRight) {
                return null;
            }

            // Blink detection (vertical distance between eyelids)
            const leftEyeHeight = Math.abs(lEyeTop.y - lEyeBot.y);
            const rightEyeHeight = Math.abs(rEyeTop.y - rEyeBot.y);
            
            // Require both eyes to be closed to register as a blink.
            // When turning the head, perspective can compress one eye vertically,
            // falsely triggering a blink if an OR condition is used.
            this.isBlinking = leftEyeHeight < BLINK_THRESHOLD && rightEyeHeight < BLINK_THRESHOLD;

            return {
                leftEyeCenter: {
                    x: (lEyeIn.x + lEyeOut.x) * 0.5,
                    y: (lEyeTop.y + lEyeBot.y) * 0.5,
                    z: (lEyeIn.z + lEyeOut.z) * 0.5
                },
                rightEyeCenter: {
                    x: (rEyeIn.x + rEyeOut.x) * 0.5,
                    y: (rEyeTop.y + rEyeBot.y) * 0.5,
                    z: (rEyeIn.z + rEyeOut.z) * 0.5
                },

                faceLeftEyeOuter: lEyeOut,
                faceRightEyeOuter: rEyeOut,
                noseBridge: nose6,
                noseUpper: nose168,
                faceLeft,
                faceRight,
                chin,
                forehead,
                isBlinking: this.isBlinking
            };
        }
    };
})(window);
