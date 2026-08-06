(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Wrist = global.EnsureAR.Wrist || {};

    global.EnsureAR.Wrist.WristMapper = class WristMapper {
        constructor() {
            this._pos = new THREE.Vector3();
            this._quat = new THREE.Quaternion();
            this._scale = new THREE.Vector3();
            this._occPos = new THREE.Vector3();
            this._occQuat = new THREE.Quaternion();
            this._occScale = new THREE.Vector3();
        }

        map(handResult, modelMeta, W, H, DEPTH_SCALE, ts) {
            if (!THREE || !handResult?.landmarks?.length) return null;

            const LM = global.EnsureAR.Landmarker;
            const HAND = LM.HAND;
            const hIdx = 0;

            const wristRaw = LM.getHandLandmark(handResult, HAND.WRIST, hIdx);
            const midRaw = LM.getHandLandmark(handResult, HAND.MIDDLE_MCP, hIdx);
            const idxRaw = LM.getHandLandmark(handResult, HAND.INDEX_MCP, hIdx);
            const pkyRaw = LM.getHandLandmark(handResult, HAND.PINKY_MCP, hIdx);

            if (!wristRaw || !midRaw || !idxRaw || !pkyRaw) return null;

            const handLabel = handResult.handedness?.[hIdx]?.[0]?.categoryName ?? 'Right';
            const isLeft = handLabel === 'Left';

            const videoEl = document.querySelector('video');
            let dW = W, dH = H;
            if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
                const s = Math.max(W / videoEl.videoWidth, H / videoEl.videoHeight);
                dW = videoEl.videoWidth * s;
                dH = videoEl.videoHeight * s;
            }

            const toThree = (p) => new THREE.Vector3(
                (1 - p.x - 0.5) * dW,
                -(p.y - 0.5) * dH,
                p.z * DEPTH_SCALE
            );

            const wristW = toThree(wristRaw);
            const midW = toThree(midRaw);
            const idxW = toThree(idxRaw);
            const pkyW = toThree(pkyRaw);

            // Move the anchor point slightly down the arm from the wrist joint
            const armDir = new THREE.Vector3().subVectors(wristW, midW);
            // Add ~30% of the hand length in the direction pointing down the arm
            const anchorPos = wristW.clone().addScaledVector(armDir, 0.30);

            const rawX = anchorPos.x;
            const rawY = anchorPos.y;
            const rawZ = anchorPos.z;

            const handW = LM.getHandWidth(handResult, hIdx) ?? 0.18;
            const rawScale = handW * dW * 0.70;

            let ms = [1, 1, 1];
            if (modelMeta?.scale) {
                if (Array.isArray(modelMeta.scale)) ms = modelMeta.scale;
                else if (typeof modelMeta.scale === 'object') ms = [modelMeta.scale.x ?? 1, modelMeta.scale.y ?? 1, modelMeta.scale.z ?? 1];
                else ms = [modelMeta.scale, modelMeta.scale, modelMeta.scale];
            }

            return {
                rawX, rawY, rawZ,
                rawScale,
                wristW, midW, idxW, pkyW, isLeft, handW, ms, dW, dH
            };
        }

        finalize(filteredX, filteredY, filteredZ, filteredScale, mapData, modelMeta, W, H) {
            const { wristW, midW, idxW, pkyW, isLeft, handW, ms, dW, dH } = mapData;

            this._pos.set(filteredX, filteredY, filteredZ);

            const off = modelMeta?.offset ?? [0, 0, 0];
            this._pos.x += off[0] * dW;
            this._pos.y += off[1] * dH;
            this._pos.z += off[2];

            const palmNormal = global.EnsureAR.Wrist.WristTracker.getPalmNormal(wristW, idxW, pkyW, isLeft);
            const armQuat = global.EnsureAR.Wrist.WristTracker.buildWristQuaternion(wristW, midW, palmNormal);
            const modelQuat = armQuat.clone();

            if (modelMeta?.rotationOffset && (modelMeta.rotationOffset[0] || modelMeta.rotationOffset[1] || modelMeta.rotationOffset[2])) {
                const ro = modelMeta.rotationOffset;
                const extra = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(ro[0] * Math.PI / 180, ro[1] * Math.PI / 180, ro[2] * Math.PI / 180)
                );
                modelQuat.multiply(extra);
            }

            this._quat.copy(modelQuat);
            this._scale.set(filteredScale * ms[0], filteredScale * ms[1], filteredScale * ms[2]);

            // Wrist is narrower than the palm. Reduce X scale so it doesn't hide the sides of the watch strap.
            const occRadius = handW * dW * 0.55;
            this._occPos.copy(this._pos);

            // CRITICAL FIX: The occluder must align with the physical arm (armQuat), 
            // NOT the 3D model's corrected rotation (modelQuat), or else the oval becomes twisted!
            this._occQuat.copy(armQuat);

            // Z scale is slightly flattened to match wrist anatomy.
            // Y scale (length along the arm) is reduced to prevent clipping into the hand.
            this._occScale.set(occRadius, handW * dW * 0.9, occRadius * 0.65);

            return {
                model: {
                    position: this._pos.clone(),
                    quaternion: this._quat.clone(),
                    scale: this._scale.clone()
                },
                occluder: {
                    position: this._occPos.clone(),
                    quaternion: this._occQuat.clone(),
                    scale: this._occScale.clone()
                }
            };
        }
    };
})(window);
