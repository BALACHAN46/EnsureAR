(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    // Note: Depends on DEPTH_SCALE (-200) typical in EnsureAR projects
    const DEPTH_SCALE = -200;

    global.EnsureAR.Eyewear.AnchorCalculator = class AnchorCalculator {
        constructor() {
            this.lastAnchor = null;
        }

        /**
         * Blends eye midpoint and nose bridge to find the perfect resting position.
         */
        compute(landmarks, isBlinking, w, h) {
            // Blink handling: keep previous anchor
            if (isBlinking && this.lastAnchor !== null) {
                return this.lastAnchor;
            }

            //const left = landmarks.leftEyeCenter;
            //const right = landmarks.rightEyeCenter;
            //const eyeMidpoint = {
            //    x: (left.x + right.x) * 0.5,
            //    y: (left.y + right.y) * 0.5,
            //    z: (left.z + right.z) * 0.5
            //};

            //const bridge = landmarks.noseBridge;


            //const left = landmarks.leftEyeCenter;
            //const right = landmarks.rightEyeCenter;
            //const left = landmarks.faceLeftEyeOuter;   // landmark 33
            //const right = landmarks.faceRightEyeOuter; // landmark 263
            //const bridge = landmarks.noseBridge;

            //const eyeMid = {
            //    x: (left.x + right.x) * 0.5,
            //    y: (left.y + right.y) * 0.5,
            //    z: (left.z + right.z) * 0.5
            //};


            // X comes mostly from eye midpoint for perfect horizontal centering
            //const anchorX = eyeMidpoint.x

            const left = landmarks.leftEyeCenter;
            const right = landmarks.rightEyeCenter;
            const upper = landmarks.noseUpper; // 168, exactly between eyes
            const lower = landmarks.noseBridge; // 6, lower on the nose bridge

            // Move the glasses slightly down by blending the upper and lower nose landmarks
            // A 60% weight towards the lower bridge moves it down nicely.
            const anchorX = upper.x * 0.4 + lower.x * 0.6;
            const anchorY = upper.y * 0.4 + lower.y * 0.6;
            const anchorZ = upper.z * 0.4 + lower.z * 0.6;

            // Calculate the actual displayed video dimensions due to object-fit: cover
            const videoEl = document.querySelector('video');
            let dW = w, dH = h;
            if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
                const s = Math.max(w / videoEl.videoWidth, h / videoEl.videoHeight);
                dW = videoEl.videoWidth * s;
                dH = videoEl.videoHeight * s;
            }

            // Map normalised coordinates to world space
            const worldPos = new THREE.Vector3(
                (1 - anchorX - 0.5) * dW,
                -(anchorY - 0.5) * dH,
                anchorZ * DEPTH_SCALE
            );

            this.lastAnchor = worldPos;
            return worldPos;
        }
        
        reset() {
            this.lastAnchor = null;
        }
    };
})(window);
