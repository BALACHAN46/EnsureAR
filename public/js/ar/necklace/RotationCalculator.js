(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    global.EnsureAR.Necklace.RotationCalculator = class RotationCalculator {
        static compute(faceResult, poseResult, W, H, depthScale) {
            const LM = global.EnsureAR.Landmarker;
            const quat = new THREE.Quaternion();
            const chestNormal = new THREE.Vector3(0, 0, 1);
            if (!LM || !poseResult?.landmarks?.length) return { quat, chestNormal };

            const ls = LM.getPoseLandmark(poseResult, LM.POSE.LEFT_SHOULDER);
            const rs = LM.getPoseLandmark(poseResult, LM.POSE.RIGHT_SHOULDER);
            const lh = LM.getPoseLandmark(poseResult, LM.POSE.LEFT_HIP);
            const rh = LM.getPoseLandmark(poseResult, LM.POSE.RIGHT_HIP);

            if (!ls || !rs || !lh || !rh) return { quat, chestNormal };

            const toThreeLocal = (raw) => new THREE.Vector3(
                (1 - raw.x - 0.5) * W,
                -(raw.y - 0.5) * H,
                raw.z * depthScale
            );

            const vLS = toThreeLocal(ls);
            const vRS = toThreeLocal(rs);
            const vLH = toThreeLocal(lh);
            const vRH = toThreeLocal(rh);

            const vecShoulder = new THREE.Vector3().subVectors(vLS, vRS).normalize();
            const midHip = new THREE.Vector3().addVectors(vLH, vRH).multiplyScalar(0.5);
            const midShoulder = new THREE.Vector3().addVectors(vLS, vRS).multiplyScalar(0.5);
            const vecSpine = new THREE.Vector3().subVectors(midShoulder, midHip).normalize();
            chestNormal.crossVectors(vecShoulder, vecSpine).normalize();

            const orthoRight = new THREE.Vector3().crossVectors(vecSpine, chestNormal).normalize();

            const mat = new THREE.Matrix4().makeBasis(orthoRight, vecSpine, chestNormal);
            quat.setFromRotationMatrix(mat);

            let headPitch = 0;
            if (faceResult?.facialTransformationMatrixes?.[0]) {
                const m = faceResult.facialTransformationMatrixes[0].data;
                const mat4 = new THREE.Matrix4().fromArray(m);
                const flip = new THREE.Matrix4().makeScale(1, -1, -1);
                mat4.premultiply(flip).multiply(flip);
                const headQ = new THREE.Quaternion().setFromRotationMatrix(mat4);
                
                const euler = new THREE.Euler().setFromQuaternion(headQ, 'YXZ');
                headPitch = euler.x; 

                const headBlendAlpha = Math.max(0, Math.min(1, (headPitch + 0.2) * 2));
                quat.slerp(headQ, headBlendAlpha * 0.15);
            }

            return { quat, chestNormal };
        }
    };
})(window);
