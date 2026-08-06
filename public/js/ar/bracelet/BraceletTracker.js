(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Bracelet = global.EnsureAR.Bracelet || {};

    global.EnsureAR.Bracelet.BraceletTracker = class BraceletTracker {
        static getPalmNormal(wristW, idxW, pkyW, isLeft) {
            const v1 = new THREE.Vector3().subVectors(idxW, wristW).normalize();
            const v2 = new THREE.Vector3().subVectors(pkyW, wristW).normalize();
            const n = new THREE.Vector3().crossVectors(v1, v2).normalize();
            if (isLeft) n.negate();
            return n;
        }

        static buildWristQuaternion(wristW, midW, palmNormal) {
            const yAxis = new THREE.Vector3().subVectors(midW, wristW).normalize();
            const zAxis = palmNormal.clone().addScaledVector(yAxis, -palmNormal.dot(yAxis)).normalize();
            const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
            const mat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
            return new THREE.Quaternion().setFromRotationMatrix(mat);
        }
    };
})(window);
