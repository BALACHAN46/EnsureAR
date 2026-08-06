(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Earring = global.EnsureAR.Earring || {};

    global.EnsureAR.Earring.EarringMapper = class EarringMapper {
        constructor() {
            this._leftPos = new THREE.Vector3();
            this._leftQuat = new THREE.Quaternion();
            this._leftScale = new THREE.Vector3();
            this._rightPos = new THREE.Vector3();
            this._rightQuat = new THREE.Quaternion();
            this._rightScale = new THREE.Vector3();
        }

        map(faceResult, modelMeta, W, H, DEPTH_SCALE, ts) {
            if (!THREE || !faceResult?.faceLandmarks?.length) return null;

            const LM = global.EnsureAR.Landmarker;
            const FACE = LM.FACE;

            const lEarRaw = LM.getFaceLandmark(faceResult, FACE.LEFT_EAR);
            const rEarRaw = LM.getFaceLandmark(faceResult, FACE.RIGHT_EAR);
            if (!lEarRaw || !rEarRaw) return null;

            const toThree = (p) => new THREE.Vector3(
                (1 - p.x - 0.5) * W,
                -(p.y - 0.5) * H,
                p.z * DEPTH_SCALE
            );

            const DROP = 0.025;
            const lEar = toThree({ x: lEarRaw.x, y: lEarRaw.y + DROP, z: lEarRaw.z });
            const rEar = toThree({ x: rEarRaw.x, y: rEarRaw.y + DROP, z: rEarRaw.z });

            let headPitch = 0;
            let headQuat = new THREE.Quaternion();
            if (faceResult?.facialTransformationMatrixes?.[0]) {
                const m = faceResult.facialTransformationMatrixes[0].data;
                const mat4 = new THREE.Matrix4().fromArray(m);
                const flip = new THREE.Matrix4().makeScale(1, -1, -1);
                mat4.premultiply(flip).multiply(flip);
                headQuat.setFromRotationMatrix(mat4);
            }

            const faceW = LM.getFaceWidth(faceResult) ?? 0.25;
            const earScale = faceW * W * 0.45;

            let ms = [1, 1, 1];
            if (modelMeta?.scale) {
                if (Array.isArray(modelMeta.scale)) ms = modelMeta.scale;
                else if (typeof modelMeta.scale === 'object') ms = [modelMeta.scale.x ?? 1, modelMeta.scale.y ?? 1, modelMeta.scale.z ?? 1];
                else ms = [modelMeta.scale, modelMeta.scale, modelMeta.scale];
            }

            return {
                rawLx: lEar.x, rawLy: lEar.y, rawLz: lEar.z,
                rawRx: rEar.x, rawRy: rEar.y, rawRz: rEar.z,
                rawScale: earScale,
                headQuat, ms
            };
        }

        finalize(fLx, fLy, fLz, fRx, fRy, fRz, fScale, mapData, modelMeta, W, H) {
            const { headQuat, ms } = mapData;

            this._leftPos.set(fLx, fLy, fLz);
            this._rightPos.set(fRx, fRy, fRz);

            const off = modelMeta?.offset ?? [0, 0, 0];
            this._leftPos.x += off[0] * W; this._leftPos.y += off[1] * H; this._leftPos.z += off[2];
            this._rightPos.x += off[0] * W; this._rightPos.y += off[1] * H; this._rightPos.z += off[2];

            this._leftQuat.copy(headQuat);
            this._rightQuat.copy(headQuat);

            if (modelMeta?.rotationOffset && (modelMeta.rotationOffset[0] || modelMeta.rotationOffset[1] || modelMeta.rotationOffset[2])) {
                const ro = modelMeta.rotationOffset;
                const extra = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(ro[0] * Math.PI / 180, ro[1] * Math.PI / 180, ro[2] * Math.PI / 180)
                );
                this._leftQuat.multiply(extra);
                this._rightQuat.multiply(extra);
            }

            this._leftScale.set(fScale * ms[0], fScale * ms[1], fScale * ms[2]);
            this._rightScale.set(fScale * ms[0], fScale * ms[1], fScale * ms[2]);

            return {
                left: {
                    position: this._leftPos.clone(),
                    quaternion: this._leftQuat.clone(),
                    scale: this._leftScale.clone()
                },
                right: {
                    position: this._rightPos.clone(),
                    quaternion: this._rightQuat.clone(),
                    scale: this._rightScale.clone()
                }
            };
        }
    };
})(window);
