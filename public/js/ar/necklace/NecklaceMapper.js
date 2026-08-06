(function(global) {
    'use strict';
    global.EnsureAR = global.EnsureAR || {};
    global.EnsureAR.Necklace = global.EnsureAR.Necklace || {};

    global.EnsureAR.Necklace.NecklaceMapper = class NecklaceMapper {
        constructor() {
            this.baseFaceWidth = null;
            this.baseScale = null;
            this.lastRawScaleX = null;
            this.lastPosition = null;

            this.tooCloseGuard = new global.EnsureAR.Necklace.TooCloseGuard();
            this.proxyNeck = new global.EnsureAR.Necklace.ProxyNeckEstimator();
            this.neckCurveDeformer = new global.EnsureAR.Necklace.NeckCurveDeformer();

            // Scratch vector for performance
            this._neckCenter = new THREE.Vector3();
            this._occluderPos = new THREE.Vector3();
        }

        reset() {
            this.baseFaceWidth = null;
            this.baseScale = null;
            this.lastRawScaleX = null;
            this.lastPosition = null;
            this.tooCloseGuard.reset();
            this.proxyNeck.reset();
            this.neckCurveDeformer.reset();
        }

        map(faceResult, poseResult, modelMeta, W, H, DEPTH_SCALE, timestamp) {
            if (!THREE) return null;
            const LM = global.EnsureAR.Landmarker;

            const POSE = LM.POSE;

            const rawLS = LM.getPoseLandmark(poseResult, POSE.LEFT_SHOULDER);
            const rawRS = LM.getPoseLandmark(poseResult, POSE.RIGHT_SHOULDER);
            if (!rawLS && !rawRS) return null;

            const proxyResult = this.proxyNeck.update(rawLS, rawRS);
            if (!proxyResult) return null;

            const { usingProxy } = proxyResult;

            const neckData = global.EnsureAR.Necklace.NeckAnchor.compute(faceResult, poseResult, W, H, DEPTH_SCALE, proxyResult);
            if (!neckData) return null;

            const { anchor: anchorPt, leftNeckSide, rightNeckSide, neckBase, neckWidthNorm, shoulderWidthNorm } = neckData;

            let rawX = anchorPt.x;
            let rawY = anchorPt.y;
            let rawZ = anchorPt.z;

            let ms = [1, 1, 1];
            if (modelMeta?.scale) {
                if (Array.isArray(modelMeta.scale)) {
                    ms = modelMeta.scale;
                } else if (typeof modelMeta.scale === 'object') {
                    ms = [modelMeta.scale.x ?? 1, modelMeta.scale.y ?? 1, modelMeta.scale.z ?? 1];
                } else if (typeof modelMeta.scale === 'number') {
                    ms = [modelMeta.scale, modelMeta.scale, modelMeta.scale];
                }
            }
            const catalogScale = ms[0] ?? 1;

            const leftFace = LM.getFaceLandmark(faceResult, 234);
            const rightFace = LM.getFaceLandmark(faceResult, 454);
            if (!leftFace || !rightFace) return null;

            const faceWidth = Math.hypot(leftFace.x - rightFace.x, leftFace.y - rightFace.y);

            if (!this.baseFaceWidth || faceWidth > this.baseFaceWidth) {
                this.baseFaceWidth = faceWidth;
                this.baseScale = neckWidthNorm * W * 1.30;
            }

            const ratio = faceWidth / this.baseFaceWidth;

            if (ratio > 1.15) {
                this.baseFaceWidth = faceWidth;
            }

            let rawScaleBase = neckWidthNorm * W * 1.30;
            rawScaleBase = Math.min(rawScaleBase, this.baseScale ?? rawScaleBase);
            rawScaleBase = THREE.MathUtils.clamp(
                rawScaleBase,
                (this.baseScale ?? rawScaleBase) * 0.35,
                this.baseScale ?? rawScaleBase
            );

            let smoothedScaleX = rawScaleBase;
            if (this.lastRawScaleX) {
                smoothedScaleX = THREE.MathUtils.lerp(this.lastRawScaleX, rawScaleBase, 0.18);
            }
            this.lastRawScaleX = smoothedScaleX;

            const tooClose = this.tooCloseGuard.check(faceResult);

            return {
                rawX, rawY, rawZ,
                smoothedScaleX,
                distRatio: Math.max(ratio, 0.25),
                anchorPt, neckBase, leftNeckSide, rightNeckSide, neckWidthNorm, shoulderWidthNorm,
                ms, catalogScale, tooClose, usingProxy
            };
        }

        finalize(filteredX, filteredY, filteredZ, filteredScaleX, filteredScaleY, mapData, modelMeta, faceResult, poseResult, W, H, DEPTH_SCALE) {
            const { anchorPt, neckBase, leftNeckSide, rightNeckSide, neckWidthNorm, shoulderWidthNorm, ms, catalogScale, tooClose, usingProxy } = mapData;

            const fsZ = filteredScaleX * 0.95; 

            this._neckCenter.set(filteredX, filteredY, filteredZ);

            const upwardOffset = (anchorPt.y - neckBase.y) * 0.5;
            this._neckCenter.y -= upwardOffset;

            let velocity = 0;
            if (this.lastPosition) {
                velocity = this._neckCenter.distanceTo(this.lastPosition);
            }
            if (!this.lastPosition) this.lastPosition = new THREE.Vector3();
            this.lastPosition.copy(this._neckCenter);

            const rotData = global.EnsureAR.Necklace.RotationCalculator.compute(faceResult, poseResult, W, H, DEPTH_SCALE);
            const quat = new THREE.Quaternion(); 
            const chestNormal = rotData.chestNormal;
            const midShoulder = rotData.midShoulder || this._neckCenter.clone();

            const off = modelMeta?.offset ?? [0, 0, 0];
            this._neckCenter.x += off[0] * W;
            this._neckCenter.y += off[1] * H;
            this._neckCenter.z += off[2];
            
            if (modelMeta?.rotationOffset && (modelMeta.rotationOffset[0] || modelMeta.rotationOffset[1] || modelMeta.rotationOffset[2])) {
                const ro = modelMeta.rotationOffset;
                const extra = new THREE.Quaternion().setFromEuler(
                    new THREE.Euler(ro[0] * Math.PI / 180, ro[1] * Math.PI / 180, ro[2] * Math.PI / 180)
                );
                quat.multiply(extra);
            }

            const neckH = shoulderWidthNorm * W * 0.75;
            const neckW = shoulderWidthNorm * W * 0.48;
            this._occluderPos.set(this._neckCenter.x, this._neckCenter.y, this._neckCenter.z - neckW * 0.65);
            const occluderQuat = new THREE.Quaternion();

            const warpParams = this.neckCurveDeformer.compute(leftNeckSide, rightNeckSide, neckBase, anchorPt);

            return {
                model: {
                    position: this._neckCenter.clone(),
                    quaternion: quat,
                    scale: new THREE.Vector3(filteredScaleX * ms[0], filteredScaleY * ms[1], fsZ * ms[2]),
                },
                occluder: {
                    position: this._occluderPos.clone(),
                    quaternion: occluderQuat,
                    scale: new THREE.Vector3(neckW, neckH, neckW * 0.50),
                },
                neckW,
                neckCenter: this._neckCenter.clone(),
                warpParams,          
                velocity,            
                usingProxy,          
                tooClose,            
                debugData: {
                    leftNeckSide,
                    rightNeckSide,
                    neckBase,
                    chestNormal,
                    midShoulder,
                    catalogScale,
                }
            };
        }
    };
})(window);
