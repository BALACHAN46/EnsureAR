(function (global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Ring = global.EnsureAR.Ring || {};

    global.EnsureAR.Ring.RingMapper = class RingMapper {
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

            const preferredFinger = modelMeta?.finger ?? 'ring';

            const fingerMap = {
                ring: { mcp: HAND.RING_MCP, pip: HAND.RING_PIP },
                index: { mcp: HAND.INDEX_MCP, pip: HAND.INDEX_PIP },
                middle: { mcp: HAND.MIDDLE_MCP, pip: HAND.MIDDLE_PIP },
            };
            const finger = fingerMap[preferredFinger] ?? fingerMap.ring;

            const mcpRaw = LM.getHandLandmark(handResult, finger.mcp, hIdx);
            const pipRaw = LM.getHandLandmark(handResult, finger.pip, hIdx);
            const wristRaw = LM.getHandLandmark(handResult, HAND.WRIST, hIdx);
            const idxRaw = LM.getHandLandmark(handResult, HAND.INDEX_MCP, hIdx);
            const pkyRaw = LM.getHandLandmark(handResult, HAND.PINKY_MCP, hIdx);

            if (!mcpRaw || !pipRaw || !wristRaw || !idxRaw || !pkyRaw) return null;

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

            const mcpW = toThree(mcpRaw);
            const pipW = toThree(pipRaw);
            const wristW = toThree(wristRaw);
            const idxW = toThree(idxRaw);
            const pkyW = toThree(pkyRaw);

            // Place the ring slightly higher up the finger (towards the middle knuckle / PIP)
            // 0.0 is MCP (base), 1.0 is PIP (middle). 0.70 sits naturally just below the knuckle.
            const rawPos = new THREE.Vector3().lerpVectors(mcpW, pipW, 0.70);

            let segLen = LM.getRingFingerSegmentLength?.(handResult, hIdx);
            const handW = LM.getHandWidth(handResult, hIdx) ?? 0.15;
            if (!segLen) segLen = handW * 0.55;

            // Approximate finger width is about 25% of hand width.
            const fingerWidth = handW * 0.25;
            // Scale ring relative to the finger width
            const rawScale = fingerWidth * dW * 1.5;

            let ms = [1, 1, 1];
            // If the automatic normalizer is active, ignore catalog.json manual scales
            if (modelMeta?.scale && typeof global.EnsureAR.RingScaleNormalizer === 'undefined') {
                if (Array.isArray(modelMeta.scale)) ms = modelMeta.scale;
                else if (typeof modelMeta.scale === 'object') ms = [modelMeta.scale.x ?? 1, modelMeta.scale.y ?? 1, modelMeta.scale.z ?? 1];
                else ms = [modelMeta.scale, modelMeta.scale, modelMeta.scale];
            }

            return {
                rawX: rawPos.x, rawY: rawPos.y, rawZ: rawPos.z,
                rawScale,
                mcpW, pipW, wristW, idxW, pkyW, isLeft, segLen, fingerLen: mcpW.distanceTo(pipW), fingerWidth, ms, dW, dH
            };
        }

        finalize(filteredX, filteredY, filteredZ, filteredScale, mapData, modelMeta, W, H) {
            const { mcpW, pipW, wristW, idxW, pkyW, isLeft, segLen, fingerLen, fingerWidth, ms, dW, dH } = mapData;

            this._pos.set(filteredX, filteredY, filteredZ);

            const off = modelMeta?.offset ?? [0, 0, 0];
            this._pos.x += off[0] * dW;
            this._pos.y += off[1] * dH;
            this._pos.z += off[2];

            // ── Ring-specific quaternion ──────────────────────────────────────────
            // ── Ring-specific quaternion (2D Billboard Mode) ──────────────────────
            // The user requested to only show the front face of the ring without full 3D rotation.
            // We calculate the 2D slope of the finger on the screen and only roll around the Z-axis.
            const dx = pipW.x - mcpW.x;
            const dy = pipW.y - mcpW.y;
            const angle = Math.atan2(dy, dx);
            
            // Apply 2D roll so the X-axis (hole) aligns with the finger, keeping the ring flat to the camera
            const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);

            // Admin rotation offset from catalog
            if (modelMeta?.rotationOffset) {
                const ro = modelMeta.rotationOffset;
                if (ro[0] || ro[1] || ro[2]) {
                    const extra = new THREE.Quaternion().setFromEuler(
                        new THREE.Euler(ro[0] * Math.PI / 180, ro[1] * Math.PI / 180, ro[2] * Math.PI / 180)
                    );
                    quat.multiply(extra);
                }
            }

            this._quat.copy(quat);
            this._scale.set(filteredScale * ms[0], filteredScale * ms[1], filteredScale * ms[2]);

            // Occluder: a thin cylinder enclosing the proximal phalanx.
            // CylinderGeometry is aligned along its Y-axis. Since the ring model's 
            // finger axis is X, we must rotate the occluder -90 degrees on Z so its Y matches X.
            // OccRadius should be half the fingerWidth since the cylinder geometry is radius=1
            const occRadius = (fingerWidth / 2) * dW * 0.9;
            this._occPos.copy(this._pos);
            
            this._occQuat.copy(this._quat);
            this._occQuat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2));

            this._occScale.set(occRadius, fingerLen * 1.5, occRadius);

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
