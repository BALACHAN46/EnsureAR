import React, { useRef, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { Environment, useGLTF, useTexture, Html, useProgress, Center } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import NecklaceMesh, { JewelrySparkles } from './components/ar/NecklaceMesh';
import RingMesh from './components/ar/RingMesh';

import ModelErrorBoundary from './components/ar/ModelErrorBoundary';
import { applyAndExtractMaterials } from './utils/materialHelper';
import { useDragOffset } from './utils/useDragOffset';

// Shared read-only zero offset for refs that may not have been given a drag offset
const ZERO_VECTOR = new THREE.Vector3();

// Categories that use the face-landmark eyewear & earrings AR
const FACE_AR_CATEGORIES = ['eyewear', 'earrings'];
// Ring AR: fixed position in frame (no body tracking)
const RING_AR_CATEGORIES = ['rings'];


const FullFaceMesh = ({ landmarksRef, showFaceMesh, showOccluder, sharedState, isNoseOccluder }) => {
  const meshRef = useRef();

  const uniformsRef = useRef({
    uNoseCenter: { value: new THREE.Vector3() },
    uClipRadius: { value: 0.5 },
    uIsNoseOccluder: { value: false }
  });

  // Convert MediaPipe's edge tesselation into solid triangles (3-cycles)
  const triangles = React.useMemo(() => {
    if (!window.FACEMESH_TESSELATION) return [];

    let maxIdx = 0;
    for (const [u, v] of window.FACEMESH_TESSELATION) {
      if (u > maxIdx) maxIdx = u;
      if (v > maxIdx) maxIdx = v;
    }

    const adj = Array.from({ length: maxIdx + 1 }, () => new Set());
    for (const [u, v] of window.FACEMESH_TESSELATION) {
      adj[u].add(v);
      adj[v].add(u);
    }

    const tris = [];
    for (let u = 0; u <= maxIdx; u++) {
      for (const v of adj[u]) {
        if (v > u) {
          for (const w of adj[v]) {
            if (w > v && adj[u].has(w)) {
              tris.push(u, v, w);
            }
          }
        }
      }
    }
    return tris;
  }, []);

  const geometry = React.useMemo(() => {
    if (triangles.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    // 478 is the max number of landmarks (including irises) in Mediapipe FaceMesh
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(478 * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(triangles), 1));
    return geo;
  }, [triangles]);

  const occluderGeometry = React.useMemo(() => {
    if (triangles.length === 0 || !geometry) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', geometry.attributes.position);

    // Perfectly seal the eye holes using a triangle fan from the iris center!
    const rightEyeContour = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
    const leftEyeContour = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];

    const eyeTris = [];
    // Right Eye (Iris Center: 468)
    for (let i = 0; i < rightEyeContour.length; i++) {
      eyeTris.push(468, rightEyeContour[i], rightEyeContour[(i + 1) % rightEyeContour.length]);
    }
    // Left Eye (Iris Center: 473)
    for (let i = 0; i < leftEyeContour.length; i++) {
      eyeTris.push(473, leftEyeContour[i], leftEyeContour[(i + 1) % leftEyeContour.length]);
    }

    const occluderTris = [...triangles, ...eyeTris];
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(occluderTris), 1));
    return geo;
  }, [triangles, geometry]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 468 || !geometry) {
      if (meshRef.current) meshRef.current.visible = false;
      return;
    }

    if (meshRef.current) meshRef.current.visible = true;

    const positions = geometry.attributes.position.array;
    const { viewport } = state;

    // Read the master lerp factor from the shared tracking engine
    // This absolutely guarantees the face mask and glasses move at the EXACT same speed!
    const adaptiveLerp = sharedState ? sharedState.current.adaptiveLerp : 0.5;

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (i * 3 + 2 >= positions.length) break;

      // Account for object-fit: cover scaling
      const videoNode = document.querySelector('.webcam-video'); const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
      const containerAspect = viewport.width / viewport.height;
      let scaleX = 1; let scaleY = 1;
      if (containerAspect > videoAspect) {
        scaleY = containerAspect / videoAspect;
      } else {
        scaleX = videoAspect / containerAspect;
      }

      const targetX = -(lm.x - 0.5) * (viewport.width * scaleX);
      const targetY = -(lm.y - 0.5) * (viewport.height * scaleY);
      const targetZ = -lm.z * viewport.width * 1.5;

      // Initial snap if uninitialized
      if (positions[i * 3] === 0 && positions[i * 3 + 1] === 0) {
        positions[i * 3] = targetX;
        positions[i * 3 + 1] = targetY;
        positions[i * 3 + 2] = targetZ;
      } else {
        // Apply synchronized smoothing
        positions[i * 3] += (targetX - positions[i * 3]) * adaptiveLerp;
        positions[i * 3 + 1] += (targetY - positions[i * 3 + 1]) * adaptiveLerp;
        positions[i * 3 + 2] += (targetZ - positions[i * 3 + 2]) * adaptiveLerp;
      }
    }

    uniformsRef.current.uIsNoseOccluder.value = !!isNoseOccluder;
    if (isNoseOccluder) {
      const nIdx = 4 * 3; // Nose tip
      if (positions[nIdx] !== undefined) {
        uniformsRef.current.uNoseCenter.value.set(positions[nIdx], positions[nIdx + 1], positions[nIdx + 2]);

        const leftX = positions[234 * 3];
        const rightX = positions[454 * 3];
        const faceWidth = Math.abs(rightX - leftX);
        uniformsRef.current.uClipRadius.value = faceWidth * 0.22; // ~22% of face width covers the nose perfectly
      }
    }

    geometry.attributes.position.needsUpdate = true;
  });

  if (!geometry) return null;

  return (
    <group ref={meshRef}>
      {/* 1. Debug Occluder: Rendered visibly for debugging if showOccluder is true */}
      <mesh geometry={occluderGeometry} renderOrder={-1}>
        <meshBasicMaterial
          color="#add8e6"
          side={THREE.DoubleSide}
          transparent={true}
          opacity={showOccluder ? 0.5 : 0.0}   // Visible light color if toggled
          depthWrite={true}
          colorWrite={showOccluder} // Writes to color buffer if toggled
          // Push the mask backward by a tiny fraction.
          // This prevents the lenses and the rest of the model from clipping into the cheeks during rotation, 
          // but is small enough that the temples still get hidden properly!
          polygonOffset={true}
          polygonOffsetFactor={0.1}
          polygonOffsetUnits={5}
          onBeforeCompile={(shader) => {
            shader.uniforms.uNoseCenter = uniformsRef.current.uNoseCenter;
            shader.uniforms.uClipRadius = uniformsRef.current.uClipRadius;
            shader.uniforms.uIsNoseOccluder = uniformsRef.current.uIsNoseOccluder;

            shader.vertexShader = `
              varying vec3 vPos;
              ${shader.vertexShader}
            `.replace(
              `#include <begin_vertex>`,
              `#include <begin_vertex>
               vPos = position;`
            );

            shader.fragmentShader = `
              uniform vec3 uNoseCenter;
              uniform float uClipRadius;
              uniform bool uIsNoseOccluder;
              varying vec3 vPos;
              ${shader.fragmentShader}
            `.replace(
              `void main() {`,
              `void main() {
                 if (uIsNoseOccluder && distance(vPos.xy, uNoseCenter.xy) > uClipRadius) {
                   discard;
                 }
              `
            );
          }}
        />
      </mesh>

      {/* 2. Colored Overlay: Show/hide based on user preference */}
      {showFaceMesh && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color="#a855f7"
            opacity={100}
            depthWrite={false}
            side={THREE.DoubleSide}
            onBeforeCompile={(shader) => {
              shader.uniforms.uNoseCenter = uniformsRef.current.uNoseCenter;
              shader.uniforms.uClipRadius = uniformsRef.current.uClipRadius;
              shader.uniforms.uIsNoseOccluder = uniformsRef.current.uIsNoseOccluder;
              shader.vertexShader = `varying vec3 vPos;\n${shader.vertexShader}`.replace(`#include <begin_vertex>`, `#include <begin_vertex>\nvPos = position;`);
              shader.fragmentShader = `uniform vec3 uNoseCenter;\nuniform float uClipRadius;\nuniform bool uIsNoseOccluder;\nvarying vec3 vPos;\n${shader.fragmentShader}`.replace(`void main() {`, `void main() {\nif (uIsNoseOccluder && distance(vPos.xy, uNoseCenter.xy) > uClipRadius) discard;`);
            }}
          />
        </mesh>
      )}
    </group>
  );
};

const HandMesh = ({ landmarksRef, showMesh }) => {
  const pointsRef = useRef();
  const linesRef = useRef();

  const { pointsGeo, linesGeo } = React.useMemo(() => {
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(21 * 3), 3));

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', pGeo.attributes.position);

    const indices = [];
    const HAND_CONNECTIONS = [
      // Only draw the fingers, starting from the palm (knuckles)
      [1, 2], [2, 3], [3, 4], // Thumb
      [5, 6], [6, 7], [7, 8], // Index
      [9, 10], [10, 11], [11, 12], // Middle
      [13, 14], [14, 15], [15, 16], // Ring
      [17, 18], [18, 19], [19, 20] // Pinky
    ];
    for (const [start, end] of HAND_CONNECTIONS) {
      indices.push(start, end);
    }
    lGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
    return { pointsGeo: pGeo, linesGeo: lGeo };
  }, []);

  const glowTexture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Create radial gradient for a soft glowing dot
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(255, 150, 255, 0.8)');
    grad.addColorStop(0.5, 'rgba(200, 100, 255, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 468 || !showMesh) {
      if (pointsRef.current) pointsRef.current.visible = false;
      if (linesRef.current) linesRef.current.visible = false;
      return;
    }

    if (pointsRef.current) pointsRef.current.visible = true;
    if (linesRef.current) linesRef.current.visible = true;

    const positions = pointsGeo.attributes.position.array;
    const { viewport, camera } = state;
    const camZ = camera.position.z;

    // Account for object-fit: cover scaling
    const videoNode = document.querySelector('.webcam-video'); const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
    const containerAspect = viewport.width / viewport.height;
    let scaleX = 1; let scaleY = 1;
    if (containerAspect > videoAspect) {
      scaleY = containerAspect / videoAspect;
    } else {
      scaleX = videoAspect / containerAspect;
    }

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (i * 3 + 2 >= positions.length) break;

      const rawX = -(lm.x - 0.5) * (viewport.width * scaleX);
      const rawY = -(lm.y - 0.5) * (viewport.height * scaleY);
      // Use the exact same scale multiplier for Z to maintain isometric 3D proportions
      const rawZ = -lm.z * (viewport.width * scaleX);

      positions[i * 3] = rawX;
      positions[i * 3 + 1] = rawY;
      positions[i * 3 + 2] = rawZ;
    }
    pointsGeo.attributes.position.needsUpdate = true;
  });

  if (!showMesh) return null;

  return (
    <group>
      <lineSegments ref={linesRef} geometry={linesGeo}>
        <lineBasicMaterial
          color="#ffffff"
          transparent={true}
          opacity={0.4}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <points ref={pointsRef} geometry={pointsGeo}>
        <pointsMaterial
          map={glowTexture}
          color="#ffffff"
          size={1.2}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </points>
    </group>
  );
};

// Shared tracking logic for both 3D GLTF earrings and 2D Image earrings
const useEarringTracker = (landmarksRef, leftGroupRef, rightGroupRef, occluderRef, leftSkullRef, rightSkullRef, modelScale, sharedState, modelPos, leftModelPos, is2D = false, leftDragOffsetRef, rightDragOffsetRef) => {
  // Memory states for Smart Calibration
  const calibratedLeftDrop = useRef(null);
  const calibratedRightDrop = useRef(null);
  const stableCalibrationFrames = useRef(0);
  const emaLeftEarLength = useRef(null);
  const emaRightEarLength = useRef(null);
  const smoothedPitchFactor = useRef(0);

  useFrame((state, delta) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 468 || !leftGroupRef.current || !rightGroupRef.current) {
      if (leftGroupRef.current) leftGroupRef.current.visible = false;
      if (rightGroupRef.current) rightGroupRef.current.visible = false;
      return;
    }

    if (leftGroupRef.current) leftGroupRef.current.visible = true;
    if (rightGroupRef.current) rightGroupRef.current.visible = true;

    const { viewport } = state;

    const videoNode = document.querySelector('.webcam-video');
    const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
    const containerAspect = viewport.width / viewport.height;
    let scaleX = 1; let scaleY = 1;
    if (containerAspect > videoAspect) {
      scaleY = containerAspect / videoAspect;
    } else {
      scaleX = videoAspect / containerAspect;
    }

    const getMapped = (index) => {
      const lm = landmarks[index];
      return new THREE.Vector3(
        -(lm.x - 0.5) * (viewport.width * scaleX),
        -(lm.y - 0.5) * (viewport.height * scaleY),
        -lm.z * viewport.width * 1.5
      );
    };

    const leftTragus = getMapped(234);
    const rightTragus = getMapped(454);
    const leftJaw = getMapped(132);
    const rightJaw = getMapped(361);

    const top = getMapped(10);
    const bottom = getMapped(152);

    const centerPos = getMapped(1); // Set head mesh center to nose tip as requested

    const rawDiffX = -(landmarks[454].x - landmarks[234].x) * (viewport.width * scaleX);
    const rawDiffY = -(landmarks[454].y - landmarks[234].y) * (viewport.height * scaleY);
    const rawDiffZ = -(landmarks[454].z - landmarks[234].z) * viewport.width;
    const faceWidth = Math.sqrt(rawDiffX * rawDiffX + rawDiffY * rawDiffY + rawDiffZ * rawDiffZ);

    const noseTip = getMapped(1);
    const headLeft = new THREE.Vector3().subVectors(leftTragus, rightTragus).normalize();
    const headRight = headLeft.clone().negate();
    const headUp = new THREE.Vector3().subVectors(top, bottom).normalize();
    const headDown = headUp.clone().negate();
    const headForward = new THREE.Vector3().crossVectors(headLeft, headUp).normalize();
    const headBackward = headForward.clone().negate();

    const rotMatrix = new THREE.Matrix4().makeBasis(headLeft, headUp, headForward);
    const fullQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

    // Earrings should dangle straight down (gravity) but still turn with the head's yaw
    const dangleUp = new THREE.Vector3(0, 1, 0);
    const dangleForward = new THREE.Vector3(headForward.x, 0, headForward.z).normalize();
    if (dangleForward.lengthSq() < 0.001) {
      dangleForward.set(0, 0, 1);
    }
    const dangleLeft = new THREE.Vector3().crossVectors(dangleUp, dangleForward).normalize();
    const dangleRotMatrix = new THREE.Matrix4().makeBasis(dangleLeft, dangleUp, dangleForward);
    const targetQuat = is2D
      ? new THREE.Quaternion()
      : new THREE.Quaternion().setFromRotationMatrix(dangleRotMatrix);

    const headForwardXZ = new THREE.Vector3(headForward.x, 0, headForward.z).normalize();
    const yawAngle = Math.atan2(headForwardXZ.x, headForwardXZ.z);

    // Calculate pitch angle to ensure user is looking somewhat straight vertically too
    const headForwardYZ = new THREE.Vector3(0, headForward.y, headForward.z).normalize();
    const pitchAngle = Math.atan2(headForwardYZ.y, headForwardYZ.z);

    // Dynamic Anchor Blend based on yaw
    const absYaw = Math.abs(yawAngle);
    // blendWeight: 0 when looking straight, smoothly becomes 1 when turned > ~25 degrees
    const blendWeight = Math.min(1.0, absYaw * 2.5);

    // Pitch Distortion Fix with Deadzone:
    // Acts exactly like looking straight until tilted beyond the threshold.
    const pitchThreshold = 0.25;
    let pitchCompensation = 0;

    if (headForward.y > pitchThreshold) {
      // Looking up beyond threshold
      pitchCompensation = (headForward.y - pitchThreshold) * faceWidth * 0.95;
    } else if (headForward.y < -pitchThreshold) {
      // Looking down beyond threshold
      pitchCompensation = (headForward.y + pitchThreshold) * faceWidth * 0.90;
    }

    const noseBaseLeft = noseTip.clone()
      .addScaledVector(headLeft, faceWidth * 0.48)
      .addScaledVector(headDown, pitchCompensation);

    const noseBaseRight = noseTip.clone()
      .addScaledVector(headRight, faceWidth * 0.48)
      .addScaledVector(headDown, pitchCompensation);

    // Dynamic Earlobe Drop: Automatically adjust for long vs short ears.
    // Tragus-to-jaw distance alone is a weak proxy (mostly reflects jaw angle, not ear length),
    // so blend it with a face-thirds proxy (forehead-to-chin / 3 approximates ear length,
    // per the classic facial-proportion "thirds" rule) for a more reliable per-user estimate.
    const leftJawDist = leftTragus.distanceTo(leftJaw);
    const rightJawDist = rightTragus.distanceTo(rightJaw);
    const faceHeight = top.distanceTo(bottom);
    const earLengthProxy = faceHeight / 3;

    const leftEarLengthEstimate = (earLengthProxy * 0.35) + (leftJawDist * 0.65);
    const rightEarLengthEstimate = (earLengthProxy * 0.35) + (rightJawDist * 0.65);

    // Silent auto-calibration: average the estimate over ~0.5s of stable, front-facing tracking,
    // then lock it in so per-frame landmark jitter stops moving the earring vertically.
    const isStableForCalibration = absYaw < 0.15 && Math.abs(pitchAngle) < 0.2;
    const CALIBRATION_FRAMES = 30;

    if (calibratedLeftDrop.current === null && isStableForCalibration) {
      emaLeftEarLength.current = emaLeftEarLength.current === null
        ? leftEarLengthEstimate
        : THREE.MathUtils.lerp(emaLeftEarLength.current, leftEarLengthEstimate, 0.15);
      emaRightEarLength.current = emaRightEarLength.current === null
        ? rightEarLengthEstimate
        : THREE.MathUtils.lerp(emaRightEarLength.current, rightEarLengthEstimate, 0.15);
      stableCalibrationFrames.current += 1;

      if (stableCalibrationFrames.current >= CALIBRATION_FRAMES) {
        calibratedLeftDrop.current = emaLeftEarLength.current;
        calibratedRightDrop.current = emaRightEarLength.current;
      }
    }

    const leftEarLengthSignal = calibratedLeftDrop.current ?? (emaLeftEarLength.current ?? leftEarLengthEstimate);
    const rightEarLengthSignal = calibratedRightDrop.current ?? (emaRightEarLength.current ?? rightEarLengthEstimate);

    // Baseline drop for short ears + proportional scaling for long ears
    const leftEarlobeDrop = (faceWidth * 0.03) + (leftEarLengthSignal * 0.18);
    const rightEarlobeDrop = (faceWidth * 0.03) + (rightEarLengthSignal * 0.18);

    const leftLobeTarget = leftTragus.clone().addScaledVector(headDown, leftEarlobeDrop);
    const rightLobeTarget = rightTragus.clone().addScaledVector(headDown, rightEarlobeDrop);

    const leftAnchor = noseBaseLeft.lerp(leftLobeTarget, blendWeight);
    const rightAnchor = noseBaseRight.lerp(rightLobeTarget, blendWeight);

    const finalScale = faceWidth * 1.05 * (modelScale || 1);
    const occluderScale = faceWidth * 0.85;

    const leftUserPos = leftModelPos || modelPos || [0, 0, 0];
    const rightUserPos = modelPos || [0, 0, 0];

    const leftUserVec = new THREE.Vector3(leftUserPos[0], leftUserPos[1], leftUserPos[2]).multiplyScalar(finalScale);
    const rightUserVec = new THREE.Vector3(-rightUserPos[0], rightUserPos[1], rightUserPos[2]).multiplyScalar(finalScale);

    const xPushDistance = 0.04 * faceWidth;
    const zPushDistance = 0.09 * faceWidth;

    const leftUserOffset = new THREE.Vector3()
      .addScaledVector(headLeft, leftUserVec.x)
      .addScaledVector(headUp, leftUserVec.y)
      .addScaledVector(headForward, leftUserVec.z);

    const rightUserOffset = new THREE.Vector3()
      .addScaledVector(headLeft, rightUserVec.x)
      .addScaledVector(headUp, rightUserVec.y)
      .addScaledVector(headForward, rightUserVec.z);

    // Dynamic Pitch Correction: When looking down, MediaPipe pulls the jaw forward onto the cheek.
    // We detect pitch-down and dynamically pull the earlobe back up to counteract the jaw sliding.
    const targetPitchFactor = Math.max(0, -headForwardYZ.y);
    smoothedPitchFactor.current = THREE.MathUtils.lerp(smoothedPitchFactor.current, targetPitchFactor, 0.1);
    const pitchDownFactor = smoothedPitchFactor.current;

    const yawFactor = Math.abs(headForward.x);
    const pitchCorrectionDistance = 0.10 * faceWidth * pitchDownFactor;
    const dynamicZPush = zPushDistance + (0.08 * faceWidth * pitchDownFactor * yawFactor);

    // Earlobe correctly tracks 2D mesh directly using Jaw angle, independent of 3D pitch perspective squash
    const leftEarlobe = leftAnchor.clone()
      .lerp(leftJaw, 0.35)
      .addScaledVector(headLeft, xPushDistance)
      .addScaledVector(headBackward, dynamicZPush)
      .addScaledVector(dangleUp, pitchCorrectionDistance)
      .add(leftUserOffset)
      .add(leftDragOffsetRef?.current || ZERO_VECTOR);

    const rightEarlobe = rightAnchor.clone()
      .lerp(rightJaw, 0.35)
      .addScaledVector(headRight, xPushDistance)
      .addScaledVector(headBackward, dynamicZPush)
      .addScaledVector(dangleUp, pitchCorrectionDistance)
      .add(rightUserOffset)
      .add(rightDragOffsetRef?.current || ZERO_VECTOR);



    const masterLerp = sharedState?.current?.adaptiveLerp || 0.35;
    // rigidLerp = 1.0 → instant position copy every frame so the earring
    // never drifts away from the ear when the head turns quickly.
    const rigidLerp = 1.0;

    // Give more tolerance before hiding the ear so it doesn't flicker when facing forward
    let isLeftEarVisible = headLeft.z > -0.20;
    let isRightEarVisible = headRight.z > -0.20;
    let warningMsg = null;

    // If head is pitched up or down beyond the 0.25 threshold, show "Face Not Detected"
    if (Math.abs(headForward.y) > 0.75) {
      warningMsg = 'Face Not Detected';
      isLeftEarVisible = false;
      isRightEarVisible = false;
    }

    if (sharedState?.current) {
      sharedState.current.earringWarning = warningMsg;
    }

    if (leftGroupRef.current.scale.x === 1) { // Uninitialized
      leftGroupRef.current.position.copy(leftEarlobe);
      leftGroupRef.current.quaternion.copy(targetQuat);
      leftGroupRef.current.scale.set(finalScale, finalScale, finalScale);
      leftGroupRef.current.visible = isLeftEarVisible;

      rightGroupRef.current.position.copy(rightEarlobe);
      rightGroupRef.current.quaternion.copy(targetQuat);
      rightGroupRef.current.scale.set(-finalScale, finalScale, finalScale);
      rightGroupRef.current.visible = isRightEarVisible;

      if (leftSkullRef?.current) {
        leftSkullRef.current.position.copy(leftEarlobe);
        leftSkullRef.current.quaternion.copy(targetQuat);
        leftSkullRef.current.scale.set(finalScale, finalScale, finalScale);
        leftSkullRef.current.visible = isLeftEarVisible;
      }
      if (rightSkullRef?.current) {
        rightSkullRef.current.position.copy(rightEarlobe);
        rightSkullRef.current.quaternion.copy(targetQuat);
        rightSkullRef.current.scale.set(-finalScale, finalScale, finalScale);
        rightSkullRef.current.visible = isRightEarVisible;
      }

      if (occluderRef.current) {
        occluderRef.current.position.copy(centerPos);
        occluderRef.current.quaternion.copy(targetQuat);
        occluderRef.current.scale.set(occluderScale, occluderScale, occluderScale);
      }
    } else {
      // Distance-based adaptive lerp: smooth when still to remove jitter, fast when moving to eliminate lag
      const dist = leftGroupRef.current.position.distanceTo(leftEarlobe);
      const normalizedDist = dist / (faceWidth || 1);
      // Base lerp is 0.3 (smooth). Scales up to 0.9 (fast) during rapid head movements.
      const earringLerp = Math.min(Math.max(0.3 + (normalizedDist * 8.0), 0.3), 0.9);

      leftGroupRef.current.position.lerp(leftEarlobe, earringLerp);
      leftGroupRef.current.quaternion.slerp(targetQuat, earringLerp);
      leftGroupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), earringLerp);
      leftGroupRef.current.visible = isLeftEarVisible;

      rightGroupRef.current.position.lerp(rightEarlobe, earringLerp);
      rightGroupRef.current.quaternion.slerp(targetQuat, earringLerp);
      rightGroupRef.current.scale.lerp(new THREE.Vector3(-finalScale, finalScale, finalScale), earringLerp);
      rightGroupRef.current.visible = isRightEarVisible;

      if (leftSkullRef?.current) {
        leftSkullRef.current.position.lerp(leftEarlobe, earringLerp);
        leftSkullRef.current.quaternion.slerp(targetQuat, earringLerp);
        leftSkullRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), earringLerp);
        leftSkullRef.current.visible = isLeftEarVisible;
      }
      if (rightSkullRef?.current) {
        rightSkullRef.current.position.lerp(rightEarlobe, earringLerp);
        rightSkullRef.current.quaternion.slerp(targetQuat, earringLerp);
        rightSkullRef.current.scale.lerp(new THREE.Vector3(-finalScale, finalScale, finalScale), earringLerp);
        rightSkullRef.current.visible = isRightEarVisible;
      }

      if (occluderRef.current) {
        occluderRef.current.position.lerp(centerPos, earringLerp);
        occluderRef.current.quaternion.slerp(targetQuat, earringLerp);
        occluderRef.current.scale.lerp(new THREE.Vector3(occluderScale, occluderScale, occluderScale), earringLerp);
      }
    }
  });
};

const EarringGLTFMesh = ({ landmarksRef, modelPos, modelRot, leftModelPos, leftModelRot, modelScale, modelSparkles, sharedState, activeModel, customMaterials, showOccluder, dragResetTick }) => {
  const leftGroupRef = useRef();
  const rightGroupRef = useRef();
  const leftSkullRef = useRef();
  const rightSkullRef = useRef();
  const occluderRef = useRef();

  const gltfPath = activeModel?.glbPath;
  const { scene } = useGLTF(gltfPath || '');

  const { clonedScene } = React.useMemo(() => applyAndExtractMaterials(scene, customMaterials), [scene, customMaterials]);

  const { leftScene, rightScene, autoYOffset } = React.useMemo(() => {
    if (!clonedScene) return { leftScene: null, rightScene: null, autoYOffset: 0 };
    const left = clonedScene.clone();
    const right = clonedScene.clone();

    const box = new THREE.Box3().setFromObject(clonedScene);
    const maxY = box.max.y !== -Infinity ? box.max.y : 0;
    const autoYOffset = -maxY - 0.01;

    return { leftScene: left, rightScene: right, autoYOffset };
  }, [clonedScene]);

  const leftDrag = useDragOffset(leftGroupRef, dragResetTick);
  const rightDrag = useDragOffset(rightGroupRef, dragResetTick);

  useEarringTracker(landmarksRef, leftGroupRef, rightGroupRef, occluderRef, leftSkullRef, rightSkullRef, modelScale, sharedState, modelPos, leftModelPos, false, leftDrag.offsetRef, rightDrag.offsetRef);

  if (!leftScene || !rightScene) return null;

  return (
    <group>
      <group ref={occluderRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} renderOrder={-1}>
          <cylinderGeometry args={[0.01, 0.01, 2.5, 8]} />
          <meshBasicMaterial
            color="red"
            transparent={true}
            opacity={showOccluder ? 0.5 : 0.0}
            depthWrite={true}
            colorWrite={showOccluder}
            polygonOffset={true}
            polygonOffsetFactor={0.1}
            polygonOffsetUnits={5}
          />
        </mesh>
      </group>

      {/* Ear Occluders: These rigidly follow the skull's pitch/yaw/roll to occlude the back of the earring */}
      <group ref={leftSkullRef}>
        <mesh renderOrder={-1} position={[0, 0, -0.08]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial colorWrite={false} depthWrite={true} polygonOffset={true} polygonOffsetFactor={0.1} polygonOffsetUnits={5} />
        </mesh>
      </group>
      <group ref={rightSkullRef}>
        <mesh renderOrder={-1} position={[0, 0, -0.08]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial colorWrite={false} depthWrite={true} polygonOffset={true} polygonOffsetFactor={0.1} polygonOffsetUnits={5} />
        </mesh>
      </group>
      <group ref={leftGroupRef} {...leftDrag.dragHandlers}>
        <primitive object={leftScene} rotation={leftModelRot || modelRot || [0, 0, 0]} position={[0, autoYOffset, 0]} />
        {modelSparkles && <JewelrySparkles count={45} isPlane={false} modelScene={leftScene} />}
      </group>
      <group ref={rightGroupRef} {...rightDrag.dragHandlers}>
        <primitive object={rightScene} rotation={modelRot || [0, 0, 0]} position={[0, autoYOffset, 0]} />
        {modelSparkles && <JewelrySparkles count={45} isPlane={false} modelScene={rightScene} />}
      </group>
    </group>
  );
};

const EarringImageMesh = ({ landmarksRef, modelPos, modelRot, leftModelPos, leftModelRot, modelScale, modelSparkles, sharedState, activeModel, showOccluder, dragResetTick }) => {
  const leftGroupRef = useRef();
  const rightGroupRef = useRef();
  const leftSkullRef = useRef();
  const rightSkullRef = useRef();
  const occluderRef = useRef();

  const leftImagePath = activeModel?.leftGlbPath || activeModel?.glbPath;
  const rightImagePath = activeModel?.rightGlbPath || activeModel?.glbPath;

  const leftTexture = useTexture(leftImagePath || '');
  const rightTexture = useTexture(rightImagePath || leftImagePath || '');

  React.useEffect(() => {
    if (leftTexture) leftTexture.colorSpace = THREE.SRGBColorSpace;
    if (rightTexture) rightTexture.colorSpace = THREE.SRGBColorSpace;
  }, [leftTexture, rightTexture]);

  const leftAspect = leftTexture.image ? (leftTexture.image.width / leftTexture.image.height) : 1;
  const rightAspect = rightTexture.image ? (rightTexture.image.width / rightTexture.image.height) : 1;

  const leftMaterial = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ map: leftTexture, transparent: true, side: THREE.DoubleSide });
    mat.toneMapped = false;
    return mat;
  }, [leftTexture]);

  const rightMaterial = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ map: rightTexture, transparent: true, side: THREE.DoubleSide });
    mat.toneMapped = false;
    return mat;
  }, [rightTexture]);

  const leftDrag = useDragOffset(leftGroupRef, dragResetTick);
  const rightDrag = useDragOffset(rightGroupRef, dragResetTick);

  useEarringTracker(landmarksRef, leftGroupRef, rightGroupRef, occluderRef, leftSkullRef, rightSkullRef, modelScale, sharedState, modelPos, leftModelPos, true, leftDrag.offsetRef, rightDrag.offsetRef);

  return (
    <group>
      <mesh ref={occluderRef} renderOrder={-1}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial
          color="#add8e6"
          transparent={true}
          opacity={showOccluder ? 0.5 : 0.0}
          depthWrite={true}
          colorWrite={showOccluder}
          polygonOffset={true}
          polygonOffsetFactor={0.1}
          polygonOffsetUnits={5}
        />
      </mesh>

      <group ref={leftSkullRef}>
        <mesh renderOrder={-1} position={[0, 0, -0.02]}>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshBasicMaterial colorWrite={false} depthWrite={true} polygonOffset={true} polygonOffsetFactor={0.1} polygonOffsetUnits={5} />
        </mesh>
      </group>
      <group ref={rightSkullRef}>
        <mesh renderOrder={-1} position={[0, 0, -0.02]}>
          <sphereGeometry args={[0.015, 16, 16]} />
          <meshBasicMaterial colorWrite={false} depthWrite={true} polygonOffset={true} polygonOffsetFactor={0.1} polygonOffsetUnits={5} />
        </mesh>
      </group>

      <group ref={leftGroupRef} {...leftDrag.dragHandlers}>
        <mesh rotation={leftModelRot || modelRot || [0, 0, 0]} position={[0, -0.25 / leftAspect, 0]}>
          <planeGeometry args={[0.5, 0.5 / leftAspect]} />
          <primitive object={leftMaterial} attach="material" />
        </mesh>
        {modelSparkles && <JewelrySparkles count={45} isPlane={true} />}
      </group>

      <group ref={rightGroupRef} {...rightDrag.dragHandlers}>
        <mesh rotation={modelRot || [0, 0, 0]} position={[0, -0.25 / rightAspect, 0]}>
          <planeGeometry args={[0.5, 0.5 / rightAspect]} />
          <primitive object={rightMaterial} attach="material" />
        </mesh>
        {modelSparkles && <JewelrySparkles count={45} isPlane={true} />}
      </group>
    </group>
  );
};

const EarringMesh = (props) => {
  const gltfPath = props.activeModel?.glbPath || '';
  const isImage = gltfPath.toLowerCase().match(/\.(png|jpe?g|webp)$/i);
  return isImage ? <EarringImageMesh {...props} /> : <EarringGLTFMesh {...props} />;
};

// Shared by both the GLTF and OBJ nose pin variants: injects a per-fragment
// world-space fade into every material on the model, so whatever part of it
// nears the real nostril-hole position fades/blurs away smoothly instead of
// a hard occluder that can swallow the whole model.
const useHoleFadeShader = (object3d, holeUniformsRef) => {
  React.useEffect(() => {
    if (!object3d) return;
    object3d.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        mat.transparent = true;
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uHoleCenter = holeUniformsRef.current.uHoleCenter;
          shader.uniforms.uHoleInnerRadius = holeUniformsRef.current.uHoleInnerRadius;
          shader.uniforms.uHoleOuterRadius = holeUniformsRef.current.uHoleOuterRadius;

          shader.vertexShader = `
            varying vec3 vWorldPos;
            ${shader.vertexShader}
          `.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
             vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
          );

          shader.fragmentShader = `
            uniform vec3 uHoleCenter;
            uniform float uHoleInnerRadius;
            uniform float uHoleOuterRadius;
            varying vec3 vWorldPos;
            ${shader.fragmentShader}
          `.replace(
            `#include <dithering_fragment>`,
            `#include <dithering_fragment>
             float holeDist = distance(vWorldPos, uHoleCenter);
             float holeFade = smoothstep(uHoleInnerRadius, uHoleOuterRadius, holeDist);
             if (holeFade < 0.05) discard;
             gl_FragColor.a *= holeFade;`
          );
        };
        mat.needsUpdate = true;
      });
    });
  }, [object3d, holeUniformsRef]);
};

// Shared by both the GLTF and OBJ nose pin variants: all the face-landmark
// tracking math (position/rotation/scale/visibility), so only the model
// loading itself differs between the two.
const useNosePinTracker = (landmarksRef, groupRef, leftNostrilDebugRef, rightNostrilDebugRef, holeUniformsRef, modelScale, sharedState, yawMultiplier = -1) => {
  // Landmark noise gets amplified into visible spin/wobble by atan2/asin,
  // especially as the head turns toward profile (roll's atan2(diffY, diffX)
  // gets very sensitive once diffX shrinks). Low-pass filter the raw angles
  // themselves - independent of the position/rotation lerp below, which
  // actually responds FASTER the bigger a frame-to-frame jump looks, so it
  // can't tell noise apart from genuine fast head motion on its own.
  const smoothedAnglesRef = useRef({ roll: 0, yaw: 0, pitch: 0, initialized: false });

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 468 || !groupRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    const { viewport } = state;

    // Account for object-fit: cover scaling
    const videoNode = document.querySelector('.webcam-video'); const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
    const containerAspect = viewport.width / viewport.height;
    let scaleX = 1; let scaleY = 1;
    if (containerAspect > videoAspect) {
      scaleY = containerAspect / videoAspect;
    } else {
      scaleX = videoAspect / containerAspect;
    }

    const getMapped = (index) => {
      const lm = landmarks[index];
      return new THREE.Vector3(
        -(lm.x - 0.5) * (viewport.width * scaleX),
        -(lm.y - 0.5) * (viewport.height * scaleY),
        -lm.z * viewport.width * 1.5
      );
    };

    // Use the left nostril (landmark 358) as the primary anchor for nose pins
    // This is much closer to where a nose pin naturally sits than the nose tip (4).
    const anchor = getMapped(358);
    const noseCenter = getMapped(1);

    // DEBUG: mark both nostril landmarks directly in world space so we can see
    // where MediaPipe thinks the real holes are. The raw ala points (129/358)
    // sit too far outward on the wing of the nose - blend 35% toward the nose
    // center to approximate the actual hole position instead.
    const otherAla = getMapped(129);
    const leftHoleGuess = otherAla.clone().lerp(noseCenter, 0.48);
    const rightHoleGuess = anchor.clone().lerp(noseCenter, 0.48);

    // Calculate physical face width
    const rawDiffX = -(landmarks[454].x - landmarks[234].x) * (viewport.width * scaleX);
    const rawDiffY = -(landmarks[454].y - landmarks[234].y) * (viewport.height * scaleY);
    const rawDiffZ = -(landmarks[454].z - landmarks[234].z) * viewport.width;
    const faceWidth = Math.sqrt(rawDiffX * rawDiffX + rawDiffY * rawDiffY + rawDiffZ * rawDiffZ);

    // Head rotation estimation
    // Head rotation estimation (screenRight - screenLeft to maintain positive X axis)
    const screenRightAnchor = getMapped(234);
    const screenLeftAnchor = getMapped(454);
    const diffX = screenRightAnchor.x - screenLeftAnchor.x;
    const diffY = screenRightAnchor.y - screenLeftAnchor.y;
    const diffZ = screenRightAnchor.z - screenLeftAnchor.z;

    const roll = Math.atan2(diffY, diffX);
    // Clamp before asin: floating-point drift can push the ratio slightly past +/-1,
    // which returns NaN and makes the whole quaternion NaN for a frame (visible flicker/snap).
    const yawArg = THREE.MathUtils.clamp(diffZ / Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ), -1, 1);
    const yaw = Math.asin(yawArg);

    const top = getMapped(10);
    const bottom = getMapped(152);

    const verticalDist = bottom.distanceTo(top);
    const pitchArg = THREE.MathUtils.clamp((bottom.z - top.z) / verticalDist, -1, 1);
    const pitch = -Math.asin(pitchArg);

    // Lift the nose pin slightly upwards (along the face's local Up vector)
    // as the head turns to the side, to counteract MediaPipe's tendency
    // to drop the ala landmark when viewed from profile.
    const headUp = new THREE.Vector3().subVectors(top, bottom).normalize();
    const headRight = new THREE.Vector3().subVectors(screenRightAnchor, screenLeftAnchor).normalize();
    const absYaw = Math.abs(yaw);
    // Apply different vertical lift and side offset depending on if head is turned left or right
    let liftAmount = 0;
    let sideAmount = 0; // Positive moves outward (to the side), negative moves inward (to center)

    if (yaw > 0) {
      // Turning to one side
      liftAmount = absYaw * faceWidth * -0.02;
      sideAmount = 0;
    } else {
      // Turning to the other side
      liftAmount = absYaw * faceWidth * 0.01;
      sideAmount = absYaw * faceWidth * 0.08; // Adjust this value to push it more right/outside
    }

    // Apply vertical lift
    leftHoleGuess.addScaledVector(headUp, liftAmount);
    rightHoleGuess.addScaledVector(headUp, liftAmount);

    // Apply horizontal side shift (outwards)
    leftHoleGuess.addScaledVector(headRight, sideAmount); // user's right nostril
    rightHoleGuess.addScaledVector(headRight, -sideAmount); // user's left nostril

    // The pin is anchored to ONE nostril (358). When the head turns far enough that
    // this side of the nose faces away from the camera, MediaPipe still reports an
    // estimated (guessed) 3D position for it, so without this check the pin would
    // keep rendering right through the head. Same threshold/technique as the earring
    // per-side visibility check.
    // Also cut off at an extreme turn on the OTHER side (near-profile), where
    // landmark tracking for a tiny feature like a nostril gets unreliable.
    // Extreme up/down tilt is unreliable the same way (perspective distortion on
    // a tiny feature) - hide + show the same warning rather than a wrong position.
    // Widen visibility angles so the pin doesn't disappear too easily on fast head turns
    const isPinYawOk = yawArg < 0.75 && yawArg > -0.95;
    const isPinPitchOk = Math.abs(pitch) < 0.75;
    const isPinSideVisible = isPinYawOk && isPinPitchOk;
    groupRef.current.visible = isPinSideVisible;
    if (sharedState) sharedState.current.nosePinWarning = isPinSideVisible ? null : (isPinYawOk ? 'Face the camera to see the nose pin' : 'Turn back to see the nose pin');

    if (leftNostrilDebugRef.current) leftNostrilDebugRef.current.position.copy(leftHoleGuess);
    if (rightNostrilDebugRef.current) rightNostrilDebugRef.current.position.copy(rightHoleGuess);

    if (!smoothedAnglesRef.current.initialized) {
      smoothedAnglesRef.current.roll = roll;
      smoothedAnglesRef.current.yaw = yaw;
      smoothedAnglesRef.current.pitch = pitch;
      smoothedAnglesRef.current.initialized = true;
    } else {
      const angleSmoothing = 0.5; // Faster angle tracking
      smoothedAnglesRef.current.roll = THREE.MathUtils.lerp(smoothedAnglesRef.current.roll, roll, angleSmoothing);
      smoothedAnglesRef.current.yaw = THREE.MathUtils.lerp(smoothedAnglesRef.current.yaw, yaw, angleSmoothing);
      smoothedAnglesRef.current.pitch = THREE.MathUtils.lerp(smoothedAnglesRef.current.pitch, pitch, angleSmoothing);
    }

    // The nosepin must rotate fully with the head so it stays flush against the nose surface
    // instead of staying flat to the camera when the user turns their head.
    const targetEuler = new THREE.Euler(smoothedAnglesRef.current.pitch, smoothedAnglesRef.current.yaw * yawMultiplier, smoothedAnglesRef.current.roll, 'YXZ');
    const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);

    const finalScale = faceWidth * 1.05 * (modelScale || 1);

    if (groupRef.current.scale.x === 1) { // Uninitialized
      groupRef.current.position.copy(rightHoleGuess);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale, finalScale);
    } else {
      // Nosepins are rigidly attached, so they should snap instantly on fast movement
      // and have minimal lag. Use an aggressive quadratic lerp.
      const dist = groupRef.current.position.distanceTo(rightHoleGuess);
      const angle = groupRef.current.quaternion.angleTo(targetQuat);

      const posLerp = Math.max(0.25, Math.min(1.0, Math.pow(dist * 15.0, 2)));
      const rotLerp = Math.max(0.25, Math.min(1.0, Math.pow(angle * 10.0, 2)));
      const masterLerp = Math.max(posLerp, rotLerp);

      if (sharedState) sharedState.current.adaptiveLerp = masterLerp;

      groupRef.current.position.lerp(rightHoleGuess, masterLerp);
      groupRef.current.quaternion.slerp(targetQuat, masterLerp);
      // Scale never needs to snap fast - keep it on a fixed gentle lerp to avoid pulsing.
      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), 0.25);
    }

    // Soft fade: update the shader uniform driving the per-fragment hole fade
    // on the ring's own material (see useHoleFadeShader above). Uses the ring's
    // ACTUAL (lerped/lagged) rendered position, not the raw instantaneous
    // target - otherwise during a turn the hole-center races ahead of where
    // the ring visually is, and the ring's leading edge gets eaten by the
    // fade, looking like it sinks into the nose the moment the head moves.
    holeUniformsRef.current.uHoleCenter.value.copy(groupRef.current.position);
  });
};

const NosePinDebugMarkers = ({ leftNostrilDebugRef, rightNostrilDebugRef, showOccluder }) => {
  if (!showOccluder) return null;
  return (
    <>
      <mesh ref={leftNostrilDebugRef} renderOrder={999}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#22ff22" depthTest={false} />
      </mesh>
      <mesh ref={rightNostrilDebugRef} renderOrder={999}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#22ff22" depthTest={false} />
      </mesh>
    </>
  );
};

const NosePinGLTFMesh = ({ landmarksRef, modelPos, modelRot, modelScale, modelSparkles, sharedState, activeModel, customMaterials, showOccluder }) => {
  const groupRef = useRef();
  const leftNostrilDebugRef = useRef();
  const rightNostrilDebugRef = useRef();
  const holeUniformsRef = useRef({
    uHoleCenter: { value: new THREE.Vector3(9999, 9999, 9999) },
    uHoleInnerRadius: { value: 0.02 },
    uHoleOuterRadius: { value: 0.045 },
  });

  const gltfPath = activeModel?.glbPath;
  const { scene } = useGLTF(gltfPath || '');

  const { clonedScene } = React.useMemo(() => {
    const { clonedScene: s } = applyAndExtractMaterials(scene, customMaterials);
    if (!s) return { clonedScene: null };
    // Automatically center the model to prevent orbiting if origin is off-center
    const box = new THREE.Box3().setFromObject(s);
    const center = box.getCenter(new THREE.Vector3());
    s.position.sub(center);
    return { clonedScene: s };
  }, [scene, customMaterials]);

  useHoleFadeShader(clonedScene, holeUniformsRef);
  useNosePinTracker(landmarksRef, groupRef, leftNostrilDebugRef, rightNostrilDebugRef, holeUniformsRef, modelScale, sharedState, -1);

  if (!scene) return null;

  return (
    <group>      <group ref={groupRef}>
      <primitive
        object={clonedScene}
        rotation={modelRot || [0, 0, 0]}
        position={modelPos || [0, 0, 0]}
      />
      {modelSparkles && <JewelrySparkles count={30} isPlane={false} modelScene={clonedScene} />}
    </group>
      <NosePinDebugMarkers leftNostrilDebugRef={leftNostrilDebugRef} rightNostrilDebugRef={rightNostrilDebugRef} showOccluder={showOccluder} />
    </group>
  );
};

const NosePinOBJMesh = ({ landmarksRef, modelPos, modelRot, modelScale, modelSparkles, sharedState, activeModel, customMaterials, showOccluder }) => {
  const groupRef = useRef();
  const leftNostrilDebugRef = useRef();
  const rightNostrilDebugRef = useRef();
  const holeUniformsRef = useRef({
    uHoleCenter: { value: new THREE.Vector3(9999, 9999, 9999) },
    uHoleInnerRadius: { value: 0.02 },
    uHoleOuterRadius: { value: 0.045 },
  });

  const objPath = activeModel?.glbPath;
  const obj = useLoader(OBJLoader, objPath);

  const { clonedScene } = React.useMemo(() => {
    // Rhino/plain OBJ exports with no .mtl have no material at all - OBJLoader
    // already falls back to a default MeshPhongMaterial per mesh, so this just
    // gives it a metal-ish look instead of the flat default grey.
    obj.traverse((child) => {
      if (child.isMesh && (!child.material || child.material.type === 'MeshPhongMaterial')) {
        child.material = new THREE.MeshStandardMaterial({ color: '#d43b3b', metalness: 0.7, roughness: 0.3 });
      }
    });
    const { clonedScene: s } = applyAndExtractMaterials(obj, customMaterials);
    if (!s) return { clonedScene: null };
    const box = new THREE.Box3().setFromObject(s);
    const center = box.getCenter(new THREE.Vector3());
    s.position.sub(center);
    return { clonedScene: s };
  }, [obj, customMaterials]);

  useHoleFadeShader(clonedScene, holeUniformsRef);
  useNosePinTracker(landmarksRef, groupRef, leftNostrilDebugRef, rightNostrilDebugRef, holeUniformsRef, modelScale, sharedState, -1);

  if (!obj) return null;

  return (
    <group>      <group ref={groupRef}>
      <primitive
        object={clonedScene}
        rotation={modelRot || [0, 0, 0]}
        position={modelPos || [0, 0, 0]}
      />
      {modelSparkles && <JewelrySparkles count={30} isPlane={false} modelScene={clonedScene} />}
    </group>
      <NosePinDebugMarkers leftNostrilDebugRef={leftNostrilDebugRef} rightNostrilDebugRef={rightNostrilDebugRef} showOccluder={showOccluder} />
    </group>
  );
};

const NosePinImageMesh = ({ landmarksRef, modelPos, modelRot, modelScale, modelSparkles, sharedState, activeModel, customMaterials, showOccluder }) => {
  const groupRef = useRef();
  const [meshObj, setMeshObj] = useState(null);
  const leftNostrilDebugRef = useRef();
  const rightNostrilDebugRef = useRef();
  const holeUniformsRef = useRef({
    uHoleCenter: { value: new THREE.Vector3(9999, 9999, 9999) },
    uHoleInnerRadius: { value: 0.02 },
    uHoleOuterRadius: { value: 0.045 },
  });

  const imagePath = activeModel?.glbPath || '';
  const texture = useTexture(imagePath);

  const material = React.useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthTest: false
    });
  }, [texture]);

  useNosePinTracker(landmarksRef, groupRef, leftNostrilDebugRef, rightNostrilDebugRef, holeUniformsRef, modelScale, sharedState, 1);

  if (!texture) return null;

  const aspect = texture.image ? (texture.image.width / texture.image.height) : 1;

  return (
    <group>
      <group ref={groupRef}>
        <mesh ref={setMeshObj} rotation={modelRot || [0, 0, 0]} position={modelPos || [0, 0, 0]} renderOrder={100}>
          <planeGeometry args={[0.05, 0.05 / aspect]} />
          <primitive object={material} attach="material" />
        </mesh>
        {modelSparkles && <JewelrySparkles count={30} isPlane={true} />}
      </group>
      <NosePinDebugMarkers leftNostrilDebugRef={leftNostrilDebugRef} rightNostrilDebugRef={rightNostrilDebugRef} showOccluder={showOccluder} />
    </group>
  );
};

const NosePinMesh = (props) => {
  const path = props.activeModel?.glbPath || '';
  const isObj = path.toLowerCase().endsWith('.obj');
  const isImage = path.toLowerCase().match(/\.(png|jpe?g|webp)$/i);
  if (isImage) {
    return <NosePinImageMesh {...props} />;
  }
  return isObj ? <NosePinOBJMesh {...props} /> : <NosePinGLTFMesh {...props} />;
};

const EyewearMesh = ({ landmarksRef, modelPos, modelRot, modelScale, modelSparkles, sharedState, activeModel, customMaterials }) => {
  const groupRef = useRef();

  // Custom uniforms for dynamic temple fade-out
  const uniformsRef = useRef({
    uNosePos: { value: new THREE.Vector3() },
    uHeadBackward: { value: new THREE.Vector3(0, 0, -1) },
    fadeStart: { value: 0 },
    fadeEnd: { value: 10 }
  });

  // Dynamically load the selected model
  const gltfPath = activeModel?.glbPath || '/glasses.glb';
  const { scene } = useGLTF(gltfPath);

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  // Inject custom shader logic to beautifully fade out the temples!
  React.useEffect(() => {
    if (clonedScene) {
      clonedScene.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.transparent = true;

          child.material.onBeforeCompile = (shader) => {
            shader.uniforms.uNosePos = uniformsRef.current.uNosePos;
            shader.uniforms.uHeadBackward = uniformsRef.current.uHeadBackward;
            shader.uniforms.fadeStart = uniformsRef.current.fadeStart;
            shader.uniforms.fadeEnd = uniformsRef.current.fadeEnd;

            shader.vertexShader = shader.vertexShader.replace(
              '#include <common>',
              `#include <common>
               varying vec3 vWorldPosFade;`
            );
            shader.vertexShader = shader.vertexShader.replace(
              '#include <worldpos_vertex>',
              `#include <worldpos_vertex>
               vWorldPosFade = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `#include <common>
               varying vec3 vWorldPosFade;
               uniform vec3 uNosePos;
               uniform vec3 uHeadBackward;
               uniform float fadeStart;
               uniform float fadeEnd;`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <dithering_fragment>',
              `#include <dithering_fragment>
               // Calculate physical depth into the head!
               vec3 fromNose = vWorldPosFade - uNosePos;
               float depthIntoHead = dot(fromNose, uHeadBackward);
               
               // Fade out temples as they go deep behind the ears, completely ignoring lens width!
               float fadeAlpha = 1.0 - smoothstep(fadeStart, fadeEnd, depthIntoHead);
               gl_FragColor.a *= fadeAlpha;
              `
            );
          };
        }
      });
    }
  }, [clonedScene]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 468 || !groupRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    if (groupRef.current) groupRef.current.visible = true;

    const { viewport } = state;

    // Account for object-fit: cover scaling
    const videoNode = document.querySelector('.webcam-video'); const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
    const containerAspect = viewport.width / viewport.height;
    let scaleX = 1; let scaleY = 1;
    if (containerAspect > videoAspect) {
      scaleY = containerAspect / videoAspect;
    } else {
      scaleX = videoAspect / containerAspect;
    }

    // Use the nose bridge as the exact pivot point (landmark 168 is exactly between the eyes)
    const bridge = landmarks[168];
    const anchorX = -(bridge.x - 0.5) * (viewport.width * scaleX);
    const anchorY = -(bridge.y - 0.5) * (viewport.height * scaleY);

    // Scale Z to match viewport depth dynamically
    const anchorZ = -bridge.z * viewport.width * 1.5;

    // --- DYNAMIC SCALE (ROTATION INDEPENDENT) ---
    // Calculate face width using a true 1:1 Z-ratio so the scale doesn't artificially inflate when the head turns!
    const rawDiffX = -(landmarks[454].x - landmarks[234].x) * (viewport.width * scaleX);
    const rawDiffY = -(landmarks[454].y - landmarks[234].y) * (viewport.height * scaleY);
    const rawDiffZ = -(landmarks[454].z - landmarks[234].z) * viewport.width; // 1.0 ratio, no 1.5 multiplier!

    // Physical width of the user's face in the 3D scene (constant during rotation)
    const faceWidth = Math.sqrt(rawDiffX * rawDiffX + rawDiffY * rawDiffY + rawDiffZ * rawDiffZ);

    // --- 3D ROTATION (POSE ESTIMATION) ---
    // NOTE: yaw/pitch must be computed from the same true 1:1-Z-ratio vectors
    // as faceWidth above (rawDiffX/Y/Z), not from getMapped()'s leftTemple/
    // rightTemple/top/bottom — those have Z scaled by an extra 1.5x relative
    // to X/Y (see getMapped's "* viewport.width * 1.5" vs. the 1x used for
    // rawDiffZ), which distorts the vector's direction and made asin()
    // over-rotate at larger head-turn angles (glasses flying off to the side
    // instead of tracking a real side-profile turn).

    // Removed negative sign to fix inverted roll!
    const roll = Math.atan2(rawDiffY, rawDiffX);
    const yaw = Math.asin(rawDiffZ / faceWidth);

    const rawVDiffX = -(landmarks[152].x - landmarks[10].x) * (viewport.width * scaleX);
    const rawVDiffY = -(landmarks[152].y - landmarks[10].y) * (viewport.height * scaleY);
    const rawVDiffZ = -(landmarks[152].z - landmarks[10].z) * viewport.width; // 1:1, no 1.5 multiplier

    const verticalDist = Math.sqrt(rawVDiffX * rawVDiffX + rawVDiffY * rawVDiffY + rawVDiffZ * rawVDiffZ);
    const pitch = -Math.asin(rawVDiffZ / verticalDist);

    // Apply rotation with correct Euler order (using slerp for smooth rotation)
    const targetEuler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
    const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);

    // Define the target scale based on face width, multiplied by the user's custom scale tuning
    const finalScale = faceWidth * 1.05 * (modelScale || 1);

    // Initial snap if scale is 0 (uninitialized)
    if (groupRef.current.scale.x === 1) { // 1 is default Three.js scale
      groupRef.current.position.set(anchorX, anchorY, anchorZ);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale, finalScale);
    } else {
      // Adaptive Tracking Stabilization Engine!
      const targetPos = new THREE.Vector3(anchorX, anchorY, anchorZ);

      // Calculate translational speed
      const dist = groupRef.current.position.distanceTo(targetPos);
      // Quadratic curve: dead-still when distance is small (0.04 base), snaps when moving fast
      const posLerp = Math.max(0.04, Math.min(1.0, Math.pow(dist * 12.0, 2)));

      // Calculate rotational speed (angle is in radians)
      const angle = groupRef.current.quaternion.angleTo(targetQuat);
      // Quadratic curve for rotation: heavily filters micro-twitches, keeps large head turns fast
      const rotLerp = Math.max(0.04, Math.min(1.0, Math.pow(angle * 8.0, 2)));

      // If either moving OR rotating fast, drop the filter to instantly snap!
      const masterLerp = Math.max(posLerp, rotLerp);

      // SHARE WITH FACE MASK TO GUARANTEE SYNCHRONIZATION!
      if (sharedState) sharedState.current.adaptiveLerp = masterLerp;

      groupRef.current.position.lerp(targetPos, masterLerp);
      groupRef.current.quaternion.slerp(targetQuat, masterLerp);
      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), masterLerp);
    }

    // Update dynamic fade boundaries!
    uniformsRef.current.uNosePos.value.copy(groupRef.current.position);

    // Calculate the physical backward vector into the head (to perfectly fade temples only)
    const backward = new THREE.Vector3(0, 0, -1);
    backward.applyQuaternion(groupRef.current.quaternion);
    uniformsRef.current.uHeadBackward.value.copy(backward).normalize();

    // Start fading temples halfway to the ear, fully invisible right at the ear
    uniformsRef.current.fadeStart.value = finalScale * 0.25;
    uniformsRef.current.fadeEnd.value = finalScale * 0.55;
  });

  if (!clonedScene) return null;

  return (
    <group ref={groupRef}>
      <primitive
        object={clonedScene}
        rotation={modelRot || [-Math.PI / 2, 0, Math.PI]}
        position={modelPos || [0, 0.5, 1.0]}
      />
      {modelSparkles && <JewelrySparkles count={30} isPlane={false} modelScene={clonedScene} />}
    </group>
  );
};

// -------------------------------------------------------------------
// JewelryMesh — Renders RING models in AR (fixed position in frame)
//   - posX  → left/right position in viewport units
//   - posY  → up/down position in viewport units (negative = lower)
//   - posZ  → depth only (layering)
// -------------------------------------------------------------------
const JewelryMesh = ({ landmarksRef, modelPos, modelRot, modelScale, activeModel, category, customMaterials }) => {
  const groupRef = useRef();
  const gltfPath = activeModel?.glbPath || activeModel?.modelPath;
  if (!gltfPath) return null;

  return (
    <JewelryMeshInner
      groupRef={groupRef}
      landmarksRef={landmarksRef}
      modelPos={modelPos}
      modelRot={modelRot}
      modelScale={modelScale}
      gltfPath={gltfPath}
      customMaterials={customMaterials}
    />
  );
};

const JewelryMeshInner = ({ groupRef, landmarksRef, modelPos, modelRot, modelScale, gltfPath, customMaterials }) => {
  const { scene } = useGLTF(gltfPath);

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  // Keep a ref to latest props so useFrame always reads current values (avoids stale closure)
  const propsRef = useRef({ modelPos, modelRot, modelScale });
  React.useEffect(() => {
    propsRef.current = { modelPos, modelRot, modelScale };
  });

  useFrame((state) => {
    if (!groupRef.current) return;
    const { viewport } = state;

    // Always read the freshest tuning values
    const { modelPos: mp, modelRot: mr, modelScale: ms } = propsRef.current;
    const offsetX = mp ? (mp[0] ?? 0) : 0;
    const offsetY = mp ? (mp[1] ?? 0) : 0;
    const offsetZ = mp ? (mp[2] ?? 0) : 0;

    // Rings: fixed position in frame (no hand/body tracking)
    groupRef.current.visible = true;

    // Default position: center horizontally, slightly below center vertically
    const targetX = offsetX;
    const targetY = offsetY !== 0 ? offsetY : -viewport.height * 0.25;
    const targetZ = offsetZ;
    const finalScale = ms || 1;

    const rx = mr ? (mr[0] ?? 0) : 0;
    const ry = mr ? (mr[1] ?? 0) : 0;
    const rz = mr ? (mr[2] ?? 0) : 0;

    groupRef.current.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.15);
    groupRef.current.rotation.set(rx, ry, rz);
    groupRef.current.scale.set(finalScale, finalScale, finalScale);
  });

  if (!clonedScene) return null;

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
};


const VideoBackground = ({ videoFrameRef }) => {
  const { scene } = useThree();
  const textureRef = useRef(null);
  const meshRef = useRef(null);

  React.useEffect(() => {
    const tex = new THREE.Texture();
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, depthTest: false, depthWrite: false, toneMapped: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -9999;
    scene.add(mesh);
    meshRef.current = mesh;

    return () => {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
      tex.dispose();
    };
  }, [scene]);

  useFrame(({ viewport }) => {
    if (videoFrameRef.current && textureRef.current && meshRef.current) {
      const tex = textureRef.current;
      tex.image = videoFrameRef.current;
      tex.needsUpdate = true;

      const videoNode = document.querySelector('.webcam-video');
      const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
      const containerAspect = viewport.width / viewport.height;

      let width = viewport.width;
      let height = viewport.height;

      // Fill the pane fully (crop overflow) instead of shrinking to fit inside it —
      // matches the "object-fit: cover" assumption the landmark scaleX/scaleY
      // compensation elsewhere in this file (FullFaceMesh, HandMesh, earring/nosepin
      // trackers, NecklaceMesh, RingMesh) is already written for.
      if (containerAspect > videoAspect) {
        height = viewport.width / videoAspect;
      } else {
        width = viewport.height * videoAspect;
      }

      meshRef.current.scale.set(-width, height, 1);
      meshRef.current.position.set(0, 0, -50);
    }
  });

  return null;
};

// Estimates ambient light color/intensity from the live webcam feed so jewelry gets
// lit by roughly the same light as the user's face, instead of a fixed generic light
// that makes the model look pasted on regardless of the room. Downsamples the current
// video frame to a tiny 16x16 canvas and averages it — cheap enough to run every frame,
// but throttled further since room lighting changes slowly.
const DynamicLighting = ({ videoFrameRef }) => {
  const ambientRef = useRef();
  const dirRef = useRef();
  const sampleCanvasRef = useRef(null);
  const frameCountRef = useRef(0);

  useFrame(() => {
    frameCountRef.current++;
    if (frameCountRef.current % 15 !== 0) return; // ~2x/sec at 30fps is plenty for ambient light

    const video = videoFrameRef.current;
    if (!video || !ambientRef.current || !dirRef.current) return;

    if (!sampleCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      sampleCanvasRef.current = c;
    }

    const canvas = sampleCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    try {
      ctx.drawImage(video, 0, 0, 16, 16);
    } catch {
      return; // frame not yet a drawable source
    }

    const { data } = ctx.getImageData(0, 0, 16, 16);
    let r = 0, g = 0, b = 0;
    const pixelCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    r /= pixelCount; g /= pixelCount; b /= pixelCount;

    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    ambientRef.current.color.setRGB(r / 255, g / 255, b / 255);
    ambientRef.current.intensity = 0.35 + luminance * 0.4;

    dirRef.current.color.setRGB(r / 255, g / 255, b / 255);
    dirRef.current.intensity = 0.5 + luminance * 0.8;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.5} />
      <directionalLight ref={dirRef} position={[10, 10, 10]} intensity={1} />
    </>
  );
};

const Loader = () => {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{
        color: 'white', background: 'rgba(0,0,0,0.8)', padding: '10px 20px',
        borderRadius: '20px', fontWeight: 'bold', border: '1px solid #3b82f6',
        boxShadow: '0 0 15px rgba(59, 130, 246, 0.5)', whiteSpace: 'nowrap'
      }}>
        Loading Model... {progress.toFixed(0)}%
      </div>
    </Html>
  );
};

const TrackingStatus = ({ landmarksRef, isHandTracking, category, sharedState }) => {
  const [warningMsg, setWarningMsg] = useState('');
  // Rings don't need face detection — suppress warning
  const needsFace = category !== 'rings';

  useFrame(() => {
    if (!needsFace) return;
    const lms = landmarksRef.current;
    let msg = '';

    if (!lms || lms.length === 0) {
      msg = isHandTracking ? 'Hand Not Detected' : 'Face Not Detected';
    } else if (category === 'earrings' && sharedState?.current?.earringWarning) {
      msg = sharedState.current.earringWarning;
    } else if (category === 'nosepin' && sharedState?.current?.nosePinWarning) {
      msg = sharedState.current.nosePinWarning;
    }

    if (warningMsg !== msg) {
      setWarningMsg(msg);
    }
  });

  if (!needsFace || !warningMsg) return null;
  return (
    <Html center>
      <div style={{
        color: 'white', background: 'rgba(220,38,38,0.9)', padding: '15px 30px',
        borderRadius: '30px', fontWeight: 'bold', fontSize: '18px',
        border: '2px solid #f87171', boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)',
        whiteSpace: 'nowrap'
      }}>
        ⚠️ {warningMsg}
      </div>
    </Html>
  );
};

const WristMesh = ({ landmarksRef, modelPos, modelRot, leftModelPos, leftModelRot, modelScale, modelSparkles, activeModel, showMesh, customMaterials }) => {
  const groupRef = useRef();
  const innerGroupRef = useRef();

  const gltfPath = activeModel?.glbPath;
  const { scene } = useGLTF(gltfPath || '/models/watch/f2917202433f.glb');

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 21 || !groupRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    if (groupRef.current) groupRef.current.visible = true;

    const { viewport, camera } = state;
    const camZ = camera.position.z;

    // Account for object-fit: cover scaling
    const videoNode = document.querySelector('.webcam-video'); const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
    const containerAspect = viewport.width / viewport.height;
    let scaleX = 1; let scaleY = 1;
    if (containerAspect > videoAspect) {
      scaleY = containerAspect / videoAspect;
    } else {
      scaleX = videoAspect / containerAspect;
    }

    const getMapped = (index) => {
      const lm = landmarks[index];
      return new THREE.Vector3(
        -(lm.x - 0.5) * (viewport.width * scaleX),
        -(lm.y - 0.5) * (viewport.height * scaleY),
        -lm.z * viewport.width * 1.5
      );
    };

    const p0 = getMapped(0);
    const p5 = getMapped(5);
    const p9 = getMapped(9);
    const p17 = getMapped(17);

    // Define the absolute normal of the palm using the knuckles
    const vAcross = new THREE.Vector3().subVectors(p17, p5).normalize();
    const vForwardRaw = new THREE.Vector3().subVectors(p9, p0).normalize();
    const vUp = new THREE.Vector3().crossVectors(vAcross, vForwardRaw).normalize();

    // MediaPipe unmirrored mode: label 'Right' means physical Right hand.
    const isPhysicalRight = landmarks.handedness?.label === 'Right';
    if (isPhysicalRight) {
      vUp.negate(); // Now vUp ALWAYS points out of the back of the hand (+Z)
    }

    // PALM PLANE PROJECTION: 
    const vForward = vForwardRaw.clone().sub(vUp.clone().multiplyScalar(vForwardRaw.dot(vUp))).normalize();

    // Orthogonal right vector (points across the wrist)
    const vRight = new THREE.Vector3().crossVectors(vUp, vForward).normalize();

    const rotationMatrix = new THREE.Matrix4().makeBasis(vRight, vUp, vForward);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

    const palmLength3D = p9.distanceTo(p0);

    const viewFactor = THREE.MathUtils.clamp(vUp.z, -0.5, 0.5);
    const normalizedView = viewFactor + 0.5;
    const dynamicMultiplier = 0.60 - (0.10 * normalizedView);
    let finalScale = palmLength3D * dynamicMultiplier;

    const isActuallyRightHand = landmarks.handedness?.label === 'Left';
    if (isActuallyRightHand) {
      finalScale *= 0.95;
    }

    const targetPos = p0.clone();

    if (groupRef.current.scale.x === 1) {
      groupRef.current.position.copy(targetPos);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale, finalScale);
    } else {
      const dist = groupRef.current.position.distanceTo(targetPos);
      const posLerp = THREE.MathUtils.clamp(dist * 3.0, 0.2, 0.9);
      const rotLerp = THREE.MathUtils.clamp(dist * 3.0, 0.2, 0.85);

      const currentScale = groupRef.current.scale.x;
      const scaleDiff = Math.abs(currentScale - finalScale);
      const scaleLerp = THREE.MathUtils.clamp(scaleDiff * 5.0, 0.2, 0.9);

      groupRef.current.position.lerp(targetPos, posLerp);
      groupRef.current.quaternion.slerp(targetQuat, rotLerp);
      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), scaleLerp);
    }

    // Dynamic inner group tuning & handedness rotation computed inside useFrame
    if (innerGroupRef.current) {
      let posX, posY, posZ, rotX, rotY, rotZ;

      if (isPhysicalRight) {
        posX = -(modelPos?.[0] ?? 0);
        posY = modelPos?.[1] ?? 0;
        posZ = modelPos?.[2] ?? 0;
        rotX = modelRot?.[0] ?? 0;
        rotY = -(modelRot?.[1] ?? 0);
        rotZ = -(modelRot?.[2] ?? 0);
      } else {
        posX = leftModelPos?.[0] ?? modelPos?.[0] ?? 0;
        posY = leftModelPos?.[1] ?? modelPos?.[1] ?? 0;
        posZ = leftModelPos?.[2] ?? modelPos?.[2] ?? 0;
        rotX = leftModelRot?.[0] ?? modelRot?.[0] ?? 0;
        rotY = leftModelRot?.[1] ?? modelRot?.[1] ?? 0;
        rotZ = leftModelRot?.[2] ?? modelRot?.[2] ?? 0;
      }
      innerGroupRef.current.position.set(posX, posY, posZ);
      innerGroupRef.current.rotation.set(rotX, rotY, rotZ);
    }
  });

  if (!clonedScene) return null;

  return (
    <group ref={groupRef}>
      <mesh renderOrder={-1} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.6]}>
        <cylinderGeometry args={[0.65, 0.65, 10, 32]} />
        <meshBasicMaterial
          color={showMesh ? "#00ff00" : undefined}
          transparent={showMesh}
          opacity={showMesh ? 0.5 : 1}
          colorWrite={showMesh}
          polygonOffset={true}
          polygonOffsetFactor={0.1}
          polygonOffsetUnits={5}
        />
      </mesh>

      {showMesh && (
        <mesh>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent={true}
            opacity={0.8}
            depthTest={false}
          />
        </mesh>
      )}

      <group ref={innerGroupRef} scale={[modelScale || 1, modelScale || 1, modelScale || 1]}>
        <primitive object={clonedScene} />
        {modelSparkles && <JewelrySparkles count={60} isPlane={false} modelScene={clonedScene} />}
      </group>
    </group>
  );
};

// const RingMesh = ({ landmarksRef, modelPos, modelRot, modelScale, modelSparkles, activeModel, showMesh, customMaterials }) => {
//   const { scene } = useGLTF(activeModel?.glbPath || '');
//   const groupRef = useRef();


//   useFrame((state) => {
//     const landmarks = landmarksRef.current;
//     if (!landmarks || landmarks.length < 21 || !activeModel) {
//       if (groupRef.current) groupRef.current.visible = false;
//       return;
//     }

//     if (groupRef.current) groupRef.current.visible = true;

//     const { viewport } = state;
//     const videoNode = document.querySelector('.webcam-video'); const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
//     const containerAspect = viewport.width / viewport.height;
//     let scaleX = 1; let scaleY = 1;
//     if (containerAspect > videoAspect) {
//       scaleY = containerAspect / videoAspect;
//     } else {
//       scaleX = videoAspect / containerAspect;
//     }

//     const getMapped = (index) => {
//       const lm = landmarks[index];
//       return new THREE.Vector3(
//         -(lm.x - 0.5) * (viewport.width * scaleX),
//         -(lm.y - 0.5) * (viewport.height * scaleY),
//         -lm.z * (viewport.width * scaleX)
//       );
//     };

//     const p0 = getMapped(0);
//     const p5 = getMapped(5);
//     const p13 = getMapped(13); // Ring finger base
//     const p14 = getMapped(14); // Ring finger first joint
//     const p17 = getMapped(17);

//     // Forward vector is exactly along the ring finger bone (from base to first joint)
//     const vForward = new THREE.Vector3().subVectors(p14, p13).normalize();

//     // Stable palm normal to anchor the rotation
//     const vPinky = new THREE.Vector3().subVectors(p17, p0).normalize();
//     const vIndex = new THREE.Vector3().subVectors(p5, p0).normalize();
//     const palmNormal = new THREE.Vector3().crossVectors(vPinky, vIndex).normalize();

//     // MediaPipe unmirrored mode: label 'Right' means physical Right hand.
//     const isPhysicalRight = landmarks.handedness?.label === 'Right';
//     if (isPhysicalRight) {
//       palmNormal.negate(); // Now palmNormal ALWAYS points out of the back of the hand (+Z)
//     }

//     // Right vector is perpendicular to palm normal and finger bone
//     const vRight = new THREE.Vector3().crossVectors(palmNormal, vForward).normalize();

//     // Up vector is perpendicular to forward and right
//     const vUp = new THREE.Vector3().crossVectors(vForward, vRight).normalize();

//     // Basis: 
//     // X -> vRight (across knuckles)
//     // Y -> vUp (out of palm) - Gem points here
//     // Z -> vForward (along the finger) - Hole points here
//     const rotationMatrix = new THREE.Matrix4().makeBasis(vRight, vUp, vForward);
//     const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

//     // Target position is near the base of the ring finger (knuckle) instead of halfway
//     const targetPos = new THREE.Vector3().lerpVectors(p13, p14, 0.15);

//     // Scale based on the width of the finger
//     // We use a small multiplier because ring models are typically quite large.
//     const segmentLength = p13.distanceTo(p14);
//     const finalScale = segmentLength * 0.2; // Physical scale for finger tracking (occluder)

//     if (groupRef.current.scale.x === 1) {
//       groupRef.current.position.copy(targetPos);
//       groupRef.current.quaternion.copy(targetQuat);
//       groupRef.current.scale.set(finalScale, finalScale, finalScale);
//     } else {
//       // Forcefully snap to the finger to prevent free-floating detaching
//       const posLerp = 0.7;
//       const rotLerp = 0.6;

//       const currentScale = groupRef.current.scale.x;
//       const scaleLerp = 0.5;

//       groupRef.current.position.lerp(targetPos, posLerp);
//       groupRef.current.quaternion.slerp(targetQuat, rotLerp);
//       groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), scaleLerp);
//     }
//   });

//   // Mirror tuning parameters anatomically for the physical right hand
//   const isPhysicalRight = landmarksRef.current?.handedness?.label === 'Right';
//   const adjustedPos = modelPos ? [...modelPos] : [0, 0, 0];
//   const adjustedRot = modelRot ? [...modelRot] : [0, 0, 0];
//   if (isPhysicalRight) {
//     // Note: We do NOT flip X position because the 3D model geometry isn't mirrored. 
//     // Any X offset used to center the ring's hole must remain the same for both hands.
//     adjustedRot[1] = -adjustedRot[1]; // Flip Y rotation (Yaw)
//     adjustedRot[2] = -adjustedRot[2]; // Flip Z rotation (Roll)
//   }

//   if (!clonedScene) return null;

//   return (
//     <group ref={groupRef}>
//       {/* Invisible Finger Occluder: hides the back of the ring so it doesn't render over the finger */}
//       <mesh renderOrder={-1} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1]}>
//         {/* Precise cylinder to match finger volume (0.68 radius). Prevents sweeping cuts when the hand rotates. */}
//         <cylinderGeometry args={[0.99, 0.99, 6, 32]} />
//         <meshBasicMaterial
//           colorWrite={false}
//           depthWrite={true}
//           polygonOffset={true}
//           polygonOffsetFactor={0.1}
//           polygonOffsetUnits={5}
//         />
//       </mesh>

//       {showMesh && (
//         <mesh>
//           <sphereGeometry args={[0.15, 16, 16]} />
//           <meshBasicMaterial color="#fbbf24" transparent={true} opacity={0.8} depthTest={false} />
//         </mesh>
//       )}

//       <group position={adjustedPos} rotation={adjustedRot} scale={[modelScale || 1, modelScale || 1, modelScale || 1]}>
//         <Center>
//           <primitive object={clonedScene} />
//           {modelSparkles && <JewelrySparkles count={50} isPlane={false} modelScene={clonedScene} />}
//         </Center>
//       </group>
//     </group>
//   );
// };

const Scene3D = ({ landmarksRef, poseLandmarksRef, videoFrameRef, showFaceMesh, showOccluder, modelPos, modelRot, leftModelPos, leftModelRot, modelScale, modelSparkles, activeModel, isHandTracking, category, customMaterials, ringTuning, dragResetTick }) => {
  // Shared state ensures the face mask and the glasses always use the EXACT same tracking speed!
  const sharedState = useRef({ adaptiveLerp: 0.5 });
  const isEyewear = FACE_AR_CATEGORIES.includes(category);
  const isNecklace = category === 'necklace';
  const isRing = RING_AR_CATEGORIES.includes(category);

  // The category route param and activeModel load on separate effects in the
  // parent, so for a beat after switching categories, activeModel can still
  // be the PREVIOUS category's model while `category` has already changed
  // (e.g. a necklace's flat PNG briefly fed into a GLB/OBJ loader). Gating
  // every mesh on this avoids ever handing a mismatched asset to the wrong
  // loader, which is what crashes the whole Canvas.
  const modelReady = !!activeModel && activeModel.category === category;

  // Drag-to-reposition is only offered on necklace & earrings (see useDragOffset) -
  // for every other category, keep letting clicks pass through the canvas as before.
  const supportsDrag = category === 'necklace' || category === 'earrings';

  return (
    <div className="canvas-container" style={{ position: 'relative', pointerEvents: supportsDrag ? 'auto' : 'none', touchAction: 'none' }}>
      <Canvas gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} orthographic camera={{ zoom: 150, position: [0, 0, 100] }}>
        <VideoBackground videoFrameRef={videoFrameRef} />
        <DynamicLighting videoFrameRef={videoFrameRef} />
        <Environment preset="city" />

        <TrackingStatus landmarksRef={landmarksRef} isHandTracking={isHandTracking} category={category} sharedState={sharedState} />

        {isHandTracking ? (
          <>
            <HandMesh landmarksRef={landmarksRef} showMesh={showFaceMesh} />
            <ModelErrorBoundary resetKey={`${category}-${activeModel?.id}`}>
              <Suspense fallback={<Loader />}>
                {modelReady && (category === 'rings' ? (
                  <RingMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    leftModelPos={leftModelPos}
                    leftModelRot={leftModelRot}
                    modelScale={modelScale}
                    modelSparkles={modelSparkles}
                    activeModel={activeModel}
                    showMesh={showFaceMesh}
                    customMaterials={customMaterials}
                    ringTuning={ringTuning}
                  />
                ) : (
                  <WristMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    leftModelPos={leftModelPos}
                    leftModelRot={leftModelRot}
                    modelScale={modelScale}
                    modelSparkles={modelSparkles}
                    activeModel={activeModel}
                    showMesh={showFaceMesh}
                    customMaterials={customMaterials}
                  />
                ))}
              </Suspense>
            </ModelErrorBoundary>
          </>
        ) : (
          <>
            {/* Face mesh depth occluder — needed for eyewear, necklace, and nosepin */}
            {(isEyewear || isNecklace || category === 'nosepin') && (
              <FullFaceMesh
                landmarksRef={landmarksRef}
                showFaceMesh={(isEyewear || category === 'nosepin') && showFaceMesh}
                showOccluder={showOccluder}
                sharedState={sharedState}
                isNoseOccluder={category === 'nosepin'}
              />
            )}

            <ModelErrorBoundary resetKey={`${category}-${activeModel?.id}`}>
              <Suspense fallback={<Loader />}>
                {modelReady && (category === 'earrings' ? (
                  <EarringMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    leftModelPos={leftModelPos}
                    leftModelRot={leftModelRot}
                    modelScale={modelScale}
                    modelSparkles={modelSparkles}
                    sharedState={sharedState}
                    activeModel={activeModel}
                    customMaterials={customMaterials}
                    showOccluder={showOccluder}
                    dragResetTick={dragResetTick}
                  />
                ) : category === 'nosepin' ? (
                  <NosePinMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    modelScale={modelScale}
                    modelSparkles={modelSparkles}
                    sharedState={sharedState}
                    activeModel={activeModel}
                    customMaterials={customMaterials}
                    showOccluder={showOccluder}
                  />
                ) : category === 'eyewear' ? (
                  <EyewearMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    modelScale={modelScale}
                    modelSparkles={modelSparkles}
                    sharedState={sharedState}
                    activeModel={activeModel}
                    customMaterials={customMaterials}
                  />
                ) : category === 'necklace' ? (
                  <NecklaceMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    poseLandmarksRef={poseLandmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    modelScale={modelScale}
                    modelSparkles={modelSparkles}
                    activeModel={activeModel}
                    showFaceMesh={showFaceMesh}
                    customMaterials={customMaterials}
                    dragResetTick={dragResetTick}
                  />
                ) : null)}
              </Suspense>
            </ModelErrorBoundary>
          </>
        )}
      </Canvas>
    </div>
  );
};

export default Scene3D;

