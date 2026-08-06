(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    global.EnsureAR.Necklace.NeckAnchor = class NeckAnchor {
        static compute(faceResult, poseResult, w, h, depthScale, shoulders) {
            const LM = global.EnsureAR.Landmarker;
            if (!LM) return null;

            let ls, rs;
            if (shoulders) {
                ls = shoulders.ls;
                rs = shoulders.rs;
            } else {
                if (!poseResult?.landmarks?.length) return null;
                ls = LM.getPoseLandmark(poseResult, LM.POSE.LEFT_SHOULDER);
                rs = LM.getPoseLandmark(poseResult, LM.POSE.RIGHT_SHOULDER);
            }
            if (!ls || !rs) return null;

            const chin = LM.getFaceLandmark(faceResult, LM.FACE.CHIN);
            const faceLeft = LM.getFaceLandmark(faceResult, 234);
            const faceRight = LM.getFaceLandmark(faceResult, 454);

            const shoulderWidthNorm = Math.abs(rs.x - ls.x);
            const shoulderX = (ls.x + rs.x) * 0.5;
            const shoulderY = (ls.y + rs.y) * 0.5;
            const shoulderZ = (ls.z + rs.z) * 0.5;

            // Collarbone anchor
            let midX = shoulderX;
            let midY = shoulderY - shoulderWidthNorm * 0.10;
            let midZ = shoulderZ;

            if (chin) {
                midY = THREE.MathUtils.lerp(chin.y, shoulderY, 0.40);
            }

            // Face-based neck width
            let neckWidthNorm = shoulderWidthNorm * 0.40;
            if (faceLeft && faceRight) {
                neckWidthNorm = Math.abs(faceRight.x - faceLeft.x) * 0.95;
            }

            const neckLift = shoulderWidthNorm * 0.05;

            const leftNeckSide = {
                x: midX - neckWidthNorm * 0.50,
                y: midY - neckLift,
                z: midZ
            };

            const rightNeckSide = {
                x: midX + neckWidthNorm * 0.50,
                y: midY - neckLift,
                z: midZ
            };

            const neckBaseRaw = { x: midX, y: midY + shoulderWidthNorm * 0.02, z: midZ - 0.02 };

            const toThree = (p) => new THREE.Vector3(
                (1 - p.x - 0.5) * w,
                -(p.y - 0.5) * h,
                p.z * depthScale
            );

            return {
                anchor: toThree({ x: midX, y: midY, z: midZ }),
                leftNeckSide: toThree(leftNeckSide),
                rightNeckSide: toThree(rightNeckSide),
                neckBase: toThree(neckBaseRaw),
                neckWidthNorm,
                shoulderWidthNorm,
            };
        }
    };
})(window);
