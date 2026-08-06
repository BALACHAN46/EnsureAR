(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    global.EnsureAR.Eyewear.EyewearMapper = class EyewearMapper {
        constructor() {
            this.eyeTracker = new global.EnsureAR.Eyewear.EyeTracker();
            this.poseEstimator = new global.EnsureAR.Eyewear.FacePoseEstimator();
            this.scaleEstimator = new global.EnsureAR.Eyewear.ScaleEstimator();
            this.anchorCalculator = new global.EnsureAR.Eyewear.AnchorCalculator();
            this.filter = new global.EnsureAR.Eyewear.LandmarkFilter();
        }

        /**
         * Computes the final Transform (position, rotation, scale) for the eyewear.
         * @returns {Object|null} { model: { position, quaternion, scale }, isBlinking, landmarks, rawAnchor, rawScale }
         */
        map(faceResult, modelMeta, w, h) {
            if (!THREE) return null;

            // 1. Extract specific landmarks & detect blinks
            const landmarks = this.eyeTracker.track(faceResult);
            if (!landmarks) return null;

            // 2. Compute base anchor (blending eyes and nose)
            const rawAnchor = this.anchorCalculator.compute(landmarks, landmarks.isBlinking, w, h);

            // 3. Estimate scale (IPD + face width + matrix depth)
            const rawScale = this.scaleEstimator.estimate(landmarks, w, h, landmarks.isBlinking, faceResult);
            // filtered.position.z += Math.abs(Math.sin(yaw)) * 20;

            // 4. Estimate full head pose (quaternion)
            //const rawQuat = this.poseEstimator.getPose(faceResult);

            //// 5. Apply temporal smoothing (One-Euro)
            //// 5. Apply temporal smoothing (One-Euro)
            //const ts = performance.now();
            //const filtered = this.filter.filterTransform(rawAnchor, rawQuat, rawScale, ts);

            //// ----------------------------------------------------
            //// Default eyewear pitch correction
            //// Rotates glasses slightly downward
            //// ----------------------------------------------------
            //const DOWN_PITCH = THREE.MathUtils.degToRad(-8); // try -6 to -10

            //const pitchQuat = new THREE.Quaternion().setFromEuler(
            //    new THREE.Euler(DOWN_PITCH, 0, 0, 'XYZ')
            //);

            //// Apply after head tracking
            //filtered.quaternion.multiply(pitchQuat);
            //// 6. Apply admin overrides from modelMeta
            //const off = modelMeta?.offset ?? [0, 0, 0];

            //// Use world units instead of screen pixels
            //filtered.position.x += off[0];
            //filtered.position.y += off[1];
            //filtered.position.z += off[2];

            ////if (modelMeta?.rotationOffset) {
            ////    const ro = modelMeta.rotationOffset;
            ////    if (ro[0] || ro[1] || ro[2]) {
            ////        const extra = new THREE.Quaternion().setFromEuler(
            ////            new THREE.Euler(ro[0] * Math.PI / 180, ro[1] * Math.PI / 180, ro[2] * Math.PI / 180)
            ////        );
            ////        filtered.quaternion.multiply(extra);
            ////    }
            ////}
            //if (modelMeta?.rotationOffset) {

            //    const ro = modelMeta.rotationOffset;

            //    const adminQuat = new THREE.Quaternion().setFromEuler(
            //        new THREE.Euler(
            //            THREE.MathUtils.degToRad(ro[0]),
            //            THREE.MathUtils.degToRad(ro[1]),
            //            THREE.MathUtils.degToRad(ro[2]),
            //            'XYZ'
            //        )
            //    );

            //    filtered.quaternion.multiply(adminQuat);
            //}

            //const ms = modelMeta?.scale ?? [1, 1, 1];
            //filtered.scale = new THREE.Vector3(filtered.scale * ms[0], filtered.scale * ms[1], filtered.scale * ms[2]);
            // 4. Estimate head pose
            const rawQuat = this.poseEstimator.getPose(faceResult);

            // 5. Smooth transform
            const ts = performance.now();
            const filtered = this.filter.filterTransform(rawAnchor, rawQuat, rawScale, ts);

            // ----------------------------------------------------
            // Head pose compensation
            // ----------------------------------------------------
            const euler = new THREE.Euler().setFromQuaternion(filtered.quaternion, 'YXZ');

            const yaw = euler.y;
            const pitch = euler.x;

            // Distance between eyes
            const eyeDistance = Math.abs(
                landmarks.faceLeftEyeOuter.x -
                landmarks.faceRightEyeOuter.x
            );

            // ----------------------------------------------------
            // Position compensation while turning
            // ----------------------------------------------------
            // Removed manual position compensation based on yaw per requirements

            // ----------------------------------------------------
            // Removed manual scale compensation for head rotation
            // ----------------------------------------------------
            // ----------------------------------------------------
            // Default downward pitch
            // ----------------------------------------------------
            const pitchQuat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    THREE.MathUtils.degToRad(-8),
                    0,
                    0,
                    'XYZ'
                )
            );

            filtered.quaternion.multiply(pitchQuat);

            // ----------------------------------------------------
            // Save pure face tracking state for the occluder
            // ----------------------------------------------------
            const occluderState = {
                position: filtered.position.clone(),
                quaternion: filtered.quaternion.clone(),
                scale: new THREE.Vector3(filtered.scale, filtered.scale, filtered.scale)
            };

            // ----------------------------------------------------
            // Model offset
            // ----------------------------------------------------
            let off = [0, 0, 0];
            if (modelMeta?.offset) {
                if (Array.isArray(modelMeta.offset)) off = modelMeta.offset;
                else if (typeof modelMeta.offset === 'object') off = [modelMeta.offset.x ?? 0, modelMeta.offset.y ?? 0, modelMeta.offset.z ?? 0];
                else off = [modelMeta.offset, modelMeta.offset, modelMeta.offset];
            }

            filtered.position.x += off[0];
            filtered.position.y += off[1];
            filtered.position.z += off[2];

            // ----------------------------------------------------
            // Model rotation (Removed: Now baked at load time)
            // ----------------------------------------------------

            // ----------------------------------------------------
            // Model scale
            // ----------------------------------------------------
            let ms = [1, 1, 1];
            if (modelMeta?.scale) {
                if (Array.isArray(modelMeta.scale)) ms = modelMeta.scale;
                else if (typeof modelMeta.scale === 'object') ms = [modelMeta.scale.x ?? 1, modelMeta.scale.y ?? 1, modelMeta.scale.z ?? 1];
                else ms = [modelMeta.scale, modelMeta.scale, modelMeta.scale];
            }

            filtered.scale = new THREE.Vector3(
                filtered.scale * ms[0],
                filtered.scale * ms[1],
                filtered.scale * ms[2]
            );
            return {
                model: {
                    position: filtered.position,
                    quaternion: filtered.quaternion,
                    scale: filtered.scale
                },
                occluder: occluderState,
                landmarks: landmarks,
                rawAnchor: rawAnchor,
                rawScale: rawScale,
                isBlinking: landmarks.isBlinking
            };
        }

        reset() {
            this.scaleEstimator.reset();
            this.anchorCalculator.reset();
            this.filter.reset();
        }
    };
})(window);
