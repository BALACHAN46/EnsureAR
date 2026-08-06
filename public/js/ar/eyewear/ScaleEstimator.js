(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    global.EnsureAR.Eyewear.ScaleEstimator = class ScaleEstimator {
        constructor() {
            this.lastScale = null;
        }

        /**
         * Calculates a stable scale combining IPD and face width.
         */
        estimate(landmarks, w, h, isBlinking, faceResult) {
            // Blink handling: prevent scale jumps during blinks
            if (isBlinking && this.lastScale !== null) {
                return this.lastScale;
            }

            // ── Yaw-rotation freeze ───────────────────────────────────────────────
            // During yaw rotation the 2D IPD shrinks due to perspective foreshortening
            // and MediaPipe's depth estimate becomes unreliable. Freeze scale to the
            // last frontal-face value to prevent the glasses from shrinking on rotation.
            // Threshold: ~12° — freezes scale as soon as the head starts turning away.
            const YAW_FREEZE_DEG = 12;
            if (faceResult?.facialTransformationMatrixes?.[0] && this.lastScale !== null) {
                const mat = new THREE.Matrix4().fromArray(faceResult.facialTransformationMatrixes[0].data);
                const pos = new THREE.Vector3();
                const rot = new THREE.Quaternion();
                const scl = new THREE.Vector3();
                mat.decompose(pos, rot, scl);
                const euler = new THREE.Euler().setFromQuaternion(rot, 'YXZ');
                const yawDeg = Math.abs(THREE.MathUtils.radToDeg(euler.y));
                if (yawDeg > YAW_FREEZE_DEG) {
                    // Face is turned: hold the last known-good frontal scale
                    return this.lastScale;
                }
            }

            // Calculate the actual displayed video dimensions due to object-fit: cover
            const videoEl = document.querySelector('video');
            let dW = w;
            if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
                const s = Math.max(w / videoEl.videoWidth, h / videoEl.videoHeight);
                dW = videoEl.videoWidth * s;
            }

            let rawScale = null;

            // Use the true camera depth from the facial transformation matrix
            if (faceResult?.facialTransformationMatrixes?.[0]) {
                const mat = new THREE.Matrix4().fromArray(faceResult.facialTransformationMatrixes[0].data);
                const pos = new THREE.Vector3();
                const rot = new THREE.Quaternion();
                const scl = new THREE.Vector3();
                mat.decompose(pos, rot, scl);

                const depth = Math.abs(pos.z);

                if (!this.depthMultiplier && depth > 0.1) {
                    // Calibrate the multiplier on the first valid frame using the 2D projected IPD
                    const left = landmarks.leftEyeCenter;
                    const right = landmarks.rightEyeCenter;
                    const ipd = Math.hypot(left.x - right.x, left.y - right.y);
                    const initialScale = ipd * dW * 1.8;
                    this.depthMultiplier = initialScale * depth;
                }

                if (this.depthMultiplier && depth > 0.01) {
                    rawScale = this.depthMultiplier / depth;
                }
            }

            // Fallback if matrix is unavailable or depth calibration failed
            if (rawScale === null) {
                const left = landmarks.leftEyeCenter;
                const right = landmarks.rightEyeCenter;
                const ipd = Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);

                const faceW = Math.hypot(
                    landmarks.faceLeft.x - landmarks.faceRight.x,
                    landmarks.faceLeft.y - landmarks.faceRight.y,
                    landmarks.faceLeft.z - landmarks.faceRight.z
                );

                const ipdScale = ipd * dW * 1.8;
                const faceScale = faceW * dW * 0.95;

                rawScale = (ipdScale * 0.4) + (faceScale * 0.6);
            }

            // ── Frame-to-frame outlier clamp ──────────────────────────────────────
            // Tightened from 30% to 5% to prevent sudden collapses in scale during fast motion
            if (this.lastScale !== null && rawScale !== null) {
                const ratio = rawScale / this.lastScale;
                if (ratio < 0.95) rawScale = this.lastScale * 0.95;
                if (ratio > 1.05) rawScale = this.lastScale * 1.05;
            }

            this.lastScale = rawScale;
            return rawScale;
        }

        reset() {
            this.lastScale = null;
            this.depthMultiplier = null;
        }
    };
})(window);
