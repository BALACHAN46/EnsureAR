(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Bracelet = global.EnsureAR.Bracelet || {};

    global.EnsureAR.Bracelet.BraceletMapper = class BraceletMapper {
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

            // Bracelets usually sit directly on or slightly above the wrist joint
            const rawX = wristW.x;
            const rawY = wristW.y;
            const rawZ = wristW.z;

            const handW = LM.getHandWidth(handResult, hIdx) ?? 0.18;
            // Bracelets can be a bit looser than watches
            const rawScale = handW * dW * 0.90;

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

            const palmNormal = global.EnsureAR.Bracelet.BraceletTracker.getPalmNormal(wristW, idxW, pkyW, isLeft);
            const quat = global.EnsureAR.Bracelet.BraceletTracker.buildWristQuaternion(wristW, midW, palmNormal);

            if (modelMeta?.rotationOffset && (modelMeta.rotationOffset[0] || modelMeta.rotationOffset[1] || modelMeta.rotationOffset[2])) {
                const ro = modelMeta.rotationOffset;
                const extra = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(ro[0] * Math.PI / 180, ro[1] * Math.PI / 180, ro[2] * Math.PI / 180)
                );
                quat.multiply(extra);
            }

            this._quat.copy(quat);
            this._scale.set(filteredScale * ms[0], filteredScale * ms[1], filteredScale * ms[2]);

            // OccRadius needs to be slightly wider than the bracelet scale (0.90) to properly hide the back half
            const occRadius = handW * dW * 1.0;
            this._occPos.copy(this._pos);
            this._occQuat.copy(this._quat);
            // Z scale is flattened slightly
            this._occScale.set(occRadius, handW * dW * 2.8, occRadius * 0.75);

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
