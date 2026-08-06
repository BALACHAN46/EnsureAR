//(function(global) {
//    'use strict';
//    global.EnsureAR = global.EnsureAR || {};
//    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

//    global.EnsureAR.Eyewear.FacePoseEstimator = class FacePoseEstimator {
//        /**
//         * Extracts full 3-DOF head pose (roll, pitch, yaw) from the MediaPipe
//         * facial transformation matrix.
//         * @returns {THREE.Quaternion} The rotation quaternion.
//         */
//        getPose(faceResult) {
//            const q = new THREE.Quaternion();
//            if (!THREE) return q;

//            if (faceResult?.facialTransformationMatrixes?.[0]) {
//                const m = faceResult.facialTransformationMatrixes[0].data;
//                const mat4 = new THREE.Matrix4().fromArray(m);
//                // Flip X and Z to map MediaPipe coordinate system to Three.js
//                const flip = new THREE.Matrix4().makeScale(1, -1, -1);
//                mat4.premultiply(flip).multiply(flip);
//                q.setFromRotationMatrix(mat4);
//            }
//            return q;
//        }
//    };
//})(window);

(function (global) {
    'use strict';

    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Eyewear = global.EnsureAR.Eyewear || {};

    global.EnsureAR.Eyewear.FacePoseEstimator = class FacePoseEstimator {

        getPose(faceResult) {

            const q = new THREE.Quaternion();

            if (!THREE) return q;

            const matrix = faceResult?.facialTransformationMatrixes?.[0];

            if (!matrix) return q;

            const mat = new THREE.Matrix4().fromArray(matrix.data);

            // Convert MediaPipe coordinate system to Three.js
            const flip = new THREE.Matrix4().makeScale(1, -1, -1);
            mat.premultiply(flip);
            mat.multiply(flip);

            // Remove scale and translation
            const pos = new THREE.Vector3();
            const rot = new THREE.Quaternion();
            const scl = new THREE.Vector3();

            mat.decompose(pos, rot, scl);

            return rot;
        }
    };

})(window);
