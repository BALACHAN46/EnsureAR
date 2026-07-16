import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const getAdaptiveFactor = (vel, scale, base = 0.08) => Math.min(1.0, base + Math.pow(vel * scale, 2));

/**
 * NecklaceMesh — Collarbone-stable anchor (NO chin landmark used)
 * ─────────────────────────────────────────────────────────────────────
 * Anchor strategy:
 *   X = midpoint of temples (234 + 454)
 *   Y = jaw-angle landmarks (172 + 397) → drop below jaw to collarbone area
 *
 * NO chin (152) used anywhere.
 * Proper 3D yaw/pitch from normalized 3D landmark coordinates.
 * Heavy smoothing lerp for stability.
 * ─────────────────────────────────────────────────────────────────────
 */

// ── Convert normalized landmark to viewport coordinates ────────────────
function toVP(lm, viewport) {
  return {
    x: -(lm.x - 0.5) * viewport.width,
    y: -(lm.y - 0.5) * viewport.height,
    z: -lm.z * viewport.width * 1.5,
  };
}

// ── Shared composite anchor computation ──────────────────────────────
export function computeCollarbone(faceLandmarks, poseLandmarks, viewport, offsetY = 0, chestSmoothRef = null) {
  // 1. IPD Scale Calibration (Interpupillary Distance)
  // With refineLandmarks: true, iris centers 468/473 are now available.
  // These give the TRUE interpupillary distance (biological constant ~63mm).
  const leftIris = faceLandmarks[468];
  const rightIris = faceLandmarks[473];

  if (!leftIris || !rightIris) {
    // Fallback if iris landmarks unavailable (shouldn't happen with refineLandmarks: true)
    console.warn('Iris landmarks not available, using fallback');
    return { x: 0, y: 0, z: 0, faceWidth: 1, shoulderWidth: 0, shoulderAngle: 0, yaw: 0, pitch: 0 };
  }

  // Calculate IPD in 3D viewport space (using the same projection as toVP)
  const ipdX = -(rightIris.x - leftIris.x) * viewport.width;
  const ipdY = -(rightIris.y - leftIris.y) * viewport.height;
  const ipdZ = -(rightIris.z - leftIris.z) * viewport.width;
  const IPD = Math.sqrt(ipdX * ipdX + ipdY * ipdY + ipdZ * ipdZ);

  // IPD is roughly 45% of face width (biometric average).
  // Multiply by ~2.22 to get full face width.
  const faceWidth = IPD * 2.22;

  // 2. Proper 3D Orientation (Yaw & Pitch) from NORMALIZED 3D coordinates
  // Use raw MediaPipe normalized coordinates (not screen-projected) for mathematically correct 3D angles
  const leftTemple = faceLandmarks[234];
  const rightTemple = faceLandmarks[454];
  const nose = faceLandmarks[1];
  const leftJaw = faceLandmarks[132];
  const rightJaw = faceLandmarks[361];
  const leftJawAngle = faceLandmarks[172];
  const rightJawAngle = faceLandmarks[397];

  // YAW: Angle between nose-to-mid-temple vector and temple-to-temple vector in 3D
  // In normalized space: temples form a line across the face, nose should be on centerline
  const templeMidX = (leftTemple.x + rightTemple.x) / 2;
  const templeMidY = (leftTemple.y + rightTemple.y) / 2;
  const templeMidZ = (leftTemple.z + rightTemple.z) / 2;

  // Vector from temple midpoint to nose (in normalized 3D space)
  const noseToTempleMidX = nose.x - templeMidX;
  const noseToTempleMidY = nose.y - templeMidY;
  const noseToTempleMidZ = nose.z - templeMidZ;

  // Vector from left temple to right temple (face horizontal axis)
  const templeToTempleX = rightTemple.x - leftTemple.x;
  const templeToTempleY = rightTemple.y - leftTemple.y;
  const templeToTempleZ = rightTemple.z - leftTemple.z;

  // Yaw = signed angle between face-forward and nose offset (in radians)
  // Project onto horizontal plane (X-Z) for pure yaw
  const yaw = Math.atan2(noseToTempleMidZ, noseToTempleMidX) - Math.atan2(templeToTempleZ, templeToTempleX);
  // Normalize to [-1, 1] range (roughly -45° to +45°)
  const yawNorm = Math.max(-1, Math.min(1, yaw / (Math.PI / 4)));

  // PITCH: Angle of face vertical axis relative to world up
  // Use jaw angle landmarks (more stable than chin) for vertical reference
  const jawAngleMidY = (leftJawAngle.y + rightJawAngle.y) / 2;
  const jawAngleMidZ = (leftJawAngle.z + rightJawAngle.z) / 2;

  // Vector from jaw-angle-midpoint to nose
  const noseToJawX = nose.x - (leftJawAngle.x + rightJawAngle.x) / 2;
  const noseToJawY = nose.y - jawAngleMidY;
  const noseToJawZ = nose.z - jawAngleMidZ;

  // Pitch = angle from vertical in Y-Z plane
  const pitch = Math.atan2(noseToJawZ, -noseToJawY); // negative Y is up in MediaPipe
  const pitchNorm = Math.max(-1, Math.min(1, pitch / (Math.PI / 4)));

  // 3. Face-Anchored Pivot at Jaw Angle (collarbone level)
  // Use jaw angles (172, 397) which are at the jaw corners - stable and no chin needed
  const jawAngleMid = {
    x: (leftJawAngle.x + rightJawAngle.x) / 2,
    y: (leftJawAngle.y + rightJawAngle.y) / 2,
    z: (leftJawAngle.z + rightJawAngle.z) / 2,
  };

  // Convert jaw angle midpoint to viewport for anchor positioning
  const jawAngleMidVP = toVP(jawAngleMid, viewport);

  // Anchor is below jaw angles by ~0.70 * faceWidth (collarbone area)
  const faceAnchorX = jawAngleMidVP.x;
  const faceAnchorY = jawAngleMidVP.y - (faceWidth * 0.70);
  const faceAnchorZ = jawAngleMidVP.z;

  let anchorX = faceAnchorX;
  let anchorY = faceAnchorY;
  let anchorZ = faceAnchorZ;

  // 4. Shoulder angle from temples (2D screen space is fine for roll)
  const leftTempleVP = toVP(leftTemple, viewport);
  const rightTempleVP = toVP(rightTemple, viewport);
  let shoulderAngle = Math.atan2(rightTempleVP.y - leftTempleVP.y, rightTempleVP.x - leftTempleVP.x);

  // 5. Hybrid Tracking Blend (Pose + Face)
  // The torso (shoulders) doesn't move when the head turns or tilts, so it's the
  // rotation-stable reference. The jaw/face landmarks DO shift in screen space with
  // head yaw/pitch even when the person hasn't actually moved — leaning on them too
  // heavily (previously 80% on Y/Z) is what made the necklace sway as the head turned.
  let shoulderWidth = 0;
  if (poseLandmarks && poseLandmarks.length > 12) {
    const ls = poseLandmarks[11]; // Left shoulder
    const rs = poseLandmarks[12]; // Right shoulder
    const visL = ls.visibility ?? 1;
    const visR = rs.visibility ?? 1;
    const minVis = Math.min(visL, visR);

    // Continuous confidence ramp instead of a hard visibility cutoff — a hard
    // if-branch snaps the anchor the instant visibility crosses the threshold,
    // which was itself a source of jitter. A 0.20 floor keeps a little torso
    // influence in the blend even when shoulder tracking is shaky/low-confidence —
    // without it, a bad-visibility frame goes 100% face-driven, and every small
    // head wobble (nodding, leaning side to side) reads straight through as the
    // necklace visibly shaking along with the head.
    const chestBlend = Math.max(0.20, Math.min(1, (minVis - 0.35) / (0.75 - 0.35)));

    if (chestBlend > 0) {
      const lsVP = toVP(ls, viewport);
      const rsVP = toVP(rs, viewport);
      let chestX = (lsVP.x + rsVP.x) / 2;
      let chestY = (lsVP.y + rsVP.y) / 2;
      let chestZ = (lsVP.z + rsVP.z) / 2;

      // MediaPipe Pose's shoulder landmarks are noisier frame-to-frame than the face mesh
      // (lower resolution model, more affected by low light) — and X was just tuned to lean
      // on them much harder (up to 85%) to fix the turn-stretch bug. That shifted more raw
      // shoulder noise into the anchor than before, which is what kept reading as jitter even
      // after the anchor-level smoothing downstream. Smoothing the chest point itself, before
      // it ever reaches the blend, fixes it at the source instead of chasing it after the fact.
      if (chestSmoothRef) {
        if (!chestSmoothRef.current) {
          chestSmoothRef.current = { x: chestX, y: chestY, z: chestZ };
        } else {
          // Velocity-adaptive: fast for real shoulder movement, filtered for sensor noise
          const cdx = chestX - chestSmoothRef.current.x;
          const cdy = chestY - chestSmoothRef.current.y;
          const cVel = Math.sqrt(cdx * cdx + cdy * cdy);
          const f = getAdaptiveFactor(cVel, 40.0, 0.08);
          chestSmoothRef.current.x += cdx * f;
          chestSmoothRef.current.y += cdy * f;
          chestSmoothRef.current.z += (chestZ - chestSmoothRef.current.z) * f;
        }
        chestX = chestSmoothRef.current.x;
        chestY = chestSmoothRef.current.y;
        chestZ = chestSmoothRef.current.z;
      }

      const chestShoulderAngle = Math.atan2(rsVP.y - lsVP.y, rsVP.x - lsVP.x);
      shoulderAngle = shoulderAngle * (1 - chestBlend) + chestShoulderAngle * chestBlend;

      const dx = rsVP.x - lsVP.x;
      const dy = rsVP.y - lsVP.y;
      const dz = rsVP.z - lsVP.z;
      shoulderWidth = Math.sqrt(dx*dx + dy*dy + dz*dz);

      // X (left/right) gets its own higher floor: the jaw-corner midpoint used for the
      // face-side X reading isn't symmetric under perspective once the head yaws — the
      // near-side jaw corner shifts more than the far-side one, biasing the midpoint
      // sideways in the turn direction. That's what read as "the necklace stretching to
      // one side" while turning. Leaning much harder on the shoulders (which don't move
      // just because the head turns) for X specifically removes that bias at the source.
      const xBlend = Math.max(0.45, chestBlend);
      const wX = xBlend * 0.85;
      // Y/Z: up to 55% shoulders — was 20%, so head pitch used to drag the necklace
      // up/down; now the torso anchors it while it still tracks real posture changes
      const wY = chestBlend * 0.55;
      const wZ = chestBlend * 0.55;

      anchorX = (chestX * wX) + (faceAnchorX * (1 - wX));
      anchorY = (chestY * wY) + (faceAnchorY * (1 - wY));
      anchorZ = (chestZ * wZ) + (faceAnchorZ * (1 - wZ));
    }
  }

  // Apply user manual offset (posY tuning)
  const dropRatio = (offsetY * 0.1);
  anchorY += (faceWidth * dropRatio);

  // Chin ceiling, in viewport Y — exposed (not applied here) so each consumer can clamp
  // its own visible top edge against it. This is the one place the chin landmark (152) is
  // read at all — only as a safety-clamp reference, never as the tracking driver itself,
  // so it doesn't reintroduce the instability the rest of this file avoids it for. It can't
  // be applied to anchorY directly here: the 3D chain's pivot IS its top edge, but the 2D
  // image plane is centered on the anchor, so its top edge sits half its height above —
  // only the consumer that knows its own current scale can compute the right offset.
  const chin = faceLandmarks[152];
  const chinY = chin ? toVP(chin, viewport).y : null;

  return {
    x: anchorX,
    y: anchorY,
    z: anchorZ,
    faceWidth: faceWidth,
    shoulderWidth: shoulderWidth,
    shoulderAngle: shoulderAngle,
    chinY: chinY,
    yaw: yawNorm,
    pitch: pitchNorm
  };
}


// ── NecklaceMesh ─────────────────────────────────────────────────────
const NecklaceMesh = ({ landmarksRef, poseLandmarksRef, modelPos, modelRot, modelScale, activeModel, showFaceMesh }) => {
  const groupRef = useRef();
  const boxHeightRef = useRef(0);
  const boxWidthRef = useRef(1);
  const modelPath = activeModel?.glbPath || activeModel?.modelPath;
  if (!modelPath) return null;

  const isImage = /\.(png|jpe?g|svg)$/i.test(modelPath);

  if (isImage) {
    return (
      <NecklaceImageInner
        groupRef={groupRef}
        landmarksRef={landmarksRef}
        poseLandmarksRef={poseLandmarksRef}
        modelPos={modelPos}
        modelRot={modelRot}
        modelScale={modelScale}
        imagePath={modelPath}
        showFaceMesh={showFaceMesh}
      />
    );
  }

  return (
    <NecklaceMeshInner
      groupRef={groupRef}
      landmarksRef={landmarksRef}
      poseLandmarksRef={poseLandmarksRef}
      modelPos={modelPos}
      modelRot={modelRot}
      modelScale={modelScale}
      gltfPath={modelPath}
      showFaceMesh={showFaceMesh}
    />
  );
};

const NecklaceMeshInner = ({ groupRef, landmarksRef, poseLandmarksRef, modelPos, modelRot, modelScale, gltfPath, showFaceMesh }) => {
  const { scene } = useGLTF(gltfPath);

  // Custom uniforms for dynamic depth-based fade-out (Blurring the back of the necklace)
  const uniformsRef = useRef({
    uNeckCenter: { value: new THREE.Vector3() },
    uBackward: { value: new THREE.Vector3(0, 0, -1) },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    fadeStartDepth: { value: 0 },
    fadeEndDepth: { value: 10 },
    uNecklaceTopY: { value: 0 },
    uFadeDistTip: { value: 10 }
  });

  const boxHeightRef = useRef(0);
  const boxWidthRef = useRef(1);

  // Inject custom shader logic to beautifully fade out the back of the chain!
  React.useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.transparent = true;

          child.material.onBeforeCompile = (shader) => {
            shader.uniforms.uNeckCenter = uniformsRef.current.uNeckCenter;
            shader.uniforms.uBackward = uniformsRef.current.uBackward;
            shader.uniforms.uUp = uniformsRef.current.uUp;
            shader.uniforms.fadeStartDepth = uniformsRef.current.fadeStartDepth;
            shader.uniforms.fadeEndDepth = uniformsRef.current.fadeEndDepth;
            shader.uniforms.uNecklaceTopY = uniformsRef.current.uNecklaceTopY;
            shader.uniforms.uFadeDistTip = uniformsRef.current.uFadeDistTip;

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
               uniform vec3 uNeckCenter;
               uniform vec3 uBackward;
               uniform vec3 uUp;
               uniform float fadeStartDepth;
               uniform float fadeEndDepth;
               uniform float uNecklaceTopY;
               uniform float uFadeDistTip;`
            );

            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <dithering_fragment>',
              `#include <dithering_fragment>
               // Calculate physical depth and height relative to the neck anchor!
               vec3 fromCenter = vWorldPosFade - uNeckCenter;
               float depthIntoNeck = dot(fromCenter, uBackward);
               
               // Fade based on depth (going backward behind the neck)
               float fadeAlphaDepth = 1.0 - smoothstep(fadeStartDepth, fadeEndDepth, depthIntoNeck);
               
               // Fade the sharp top tips of the necklace (blur effect)
               float distFromTop = uNecklaceTopY - vWorldPosFade.y;
               // clamp distFromTop to 0 to avoid artifacts if a vertex somehow goes above the anchor
               distFromTop = max(0.0, distFromTop);
               float fadeAlphaTip = smoothstep(0.0, uFadeDistTip, distFromTop);
               
               // Combine depth fade and tip blur
               float fadeAlpha = fadeAlphaDepth * fadeAlphaTip;
               
               gl_FragColor = vec4(gl_FragColor.rgb, gl_FragColor.a * fadeAlpha);`
            );
          };
        }
      });
    }
  }, [scene]);

  const baseModelScaleRef = useRef(1);
  const smoothedShoulderWidthRef = useRef(0);
  // Iris-based IPD width isn't perfectly rotation-invariant (MediaPipe's z-depth estimate
  // doesn't fully cancel the x/y foreshortening), so it reads noticeably wider once the head
  // yaws away from facing the camera. Since the scale clamp band below is derived from this
  // width, that drift alone made the necklace visibly balloon while turning the head — even
  // though the true (shoulder-based) width hadn't changed. Corrected live (see useFrame)
  // rather than frozen, so approaching/receding from the camera always tracks immediately.
  const stableFaceWidthRef = useRef(0);
  // Smooths the raw shoulder/chest point before it enters the anchor blend — see
  // computeCollarbone for why (Pose landmarks are noisier than the face mesh).
  const chestSmoothRef = useRef(null);
  // Dead-zone smoothing for the rotation drivers (yaw/pitch sway + shoulder roll) — these
  // were being fed straight from raw per-frame angle estimates into the quaternion slerp
  // below with zero smoothing at all, and atan2-based angles (shoulderAngle/roll especially)
  // are very noise-sensitive when the two reference points are near-level. That was very
  // likely the real remaining "shake" after position was already dead-zoned.
  const smoothedRotRef = useRef(null);
  // Smooths yaw specifically for the width-correction multiplier below (kept independent
  // of smoothedRotRef so it's available regardless of code ordering within the frame).
  const smoothedYawForScaleRef = useRef(0);
  // Low-pass filter for the raw per-frame anchor (landmark tracking noise) — the
  // position/quaternion lerp below already smooths toward the target, but its adaptive
  // factor ramps to ~1.0 for anything but the tiniest motion, so noisy input was passing
  // through almost unfiltered. This EMA removes that jitter before it ever becomes a target.
  const smoothedAnchorRef = useRef(null);

  // Auto-center the 3D model's pivot point to its true geometric center
  // This fixes models that were exported with off-center origins.
  React.useEffect(() => {
    if (!scene) return;
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());

    // We lock the main pivot point to the TOP of the chain geometry
    // so it always 'hangs' from the neck. This prevents the clasps from dropping when scaled down.
    scene.position.x = -center.x;
    scene.position.y = -box.max.y;
    scene.position.z = -center.z;
    // Calculate the absolute vertical size of the necklace so we know how long to make the tip fade
    boxHeightRef.current = box.max.y - box.min.y;
    // Calculate the absolute width so we can scale it to match the human mathematically
    const width = box.max.x - box.min.x;
    boxWidthRef.current = width > 0 ? width : 1; // Prevent division by zero
  }, [scene]);

  const propsRef = useRef({ modelPos, modelRot, modelScale });
  React.useEffect(() => {
    propsRef.current = { modelPos, modelRot, modelScale };
  });

  useFrame((state) => {
    if (!groupRef.current) return;

    const landmarks = landmarksRef.current;
    const poseLandmarks = poseLandmarksRef?.current;
    if (!landmarks || landmarks.length === 0) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const { viewport } = state;
    const { modelPos: mp, modelScale: ms } = propsRef.current;
    const offsetX = mp ? (mp[0] ?? 0) : 0;
    const offsetY = mp ? (mp[1] ?? 0) : 0;
    const offsetZ = mp ? (mp[2] ?? 0) : 0;

    // Use the composite anchor math (passing offsetY directly to compute
    // the style-specific Choker/Standard/Pendant drop percentage)
    const cb = computeCollarbone(landmarks, poseLandmarks, viewport, offsetY, chestSmoothRef);
    const trueCb = computeCollarbone(landmarks, poseLandmarks, viewport, 0, chestSmoothRef);

    // Velocity-adaptive anchor EMA:
    //   fast movement  → EMA factor → 1.0  (snaps instantly, zero lag)
    //   noise at rest  → EMA factor → 0.30 (heavy filtering, no jitter)
    // This replaces all the previous dead-zones / fixed-factor compromises.
    if (!smoothedAnchorRef.current) {
      smoothedAnchorRef.current = {
        x: cb.x, y: cb.y, z: cb.z,
        trueX: trueCb.x, trueY: trueCb.y, trueZ: trueCb.z,
      };
    } else {
      const sm = smoothedAnchorRef.current;
      const adx = cb.x - sm.x;
      const ady = cb.y - sm.y;
      const aVel = Math.sqrt(adx * adx + ady * ady);
      const anchorEMA = getAdaptiveFactor(aVel, 45.0, 0.08);
      sm.x += adx * anchorEMA;
      sm.y += ady * anchorEMA;
      sm.z += (cb.z - sm.z) * anchorEMA;
      const tdx = trueCb.x - sm.trueX;
      const tdy = trueCb.y - sm.trueY;
      const trueVel = Math.sqrt(tdx * tdx + tdy * tdy);
      const trueEMA = getAdaptiveFactor(trueVel, 45.0, 0.08);
      sm.trueX += tdx * trueEMA;
      sm.trueY += tdy * trueEMA;
      sm.trueZ += (trueCb.z - sm.trueZ) * trueEMA;
    }
    const anchor = smoothedAnchorRef.current;

    // posZ depth-perception scale multiplier
    const depthScale = Math.pow(1.15, offsetZ);

    // Shoulder width — velocity-adaptive smooth
    if (cb.shoulderWidth > 0) {
      if (smoothedShoulderWidthRef.current === 0) {
        smoothedShoulderWidthRef.current = cb.shoulderWidth;
      } else {
        const swDelta = Math.abs(cb.shoulderWidth - smoothedShoulderWidthRef.current);
        const swEMA = getAdaptiveFactor(swDelta, 25.0, 0.08);
        smoothedShoulderWidthRef.current += (cb.shoulderWidth - smoothedShoulderWidthRef.current) * swEMA;
      }
    }

    // Yaw + face width — velocity-adaptive
    const yawDelta = Math.abs(cb.yaw - smoothedYawForScaleRef.current);
    const yawEMA = getAdaptiveFactor(yawDelta, 35.0, 0.08);
    smoothedYawForScaleRef.current += (cb.yaw - smoothedYawForScaleRef.current) * yawEMA;
    const yawCorrection = 1 - Math.min(1, Math.abs(smoothedYawForScaleRef.current)) * 0.35;
    const correctedFaceWidth = cb.faceWidth * yawCorrection;
    if (stableFaceWidthRef.current === 0) {
      stableFaceWidthRef.current = correctedFaceWidth;
    } else {
      const fwDelta = Math.abs(correctedFaceWidth - stableFaceWidthRef.current);
      const fwEMA = Math.min(1.0, 0.25 + fwDelta * 25.0);
      stableFaceWidthRef.current += (correctedFaceWidth - stableFaceWidthRef.current) * fwEMA;
    }
    const faceWidth = stableFaceWidthRef.current;

    // 2. Correct Architecture Scale (No Magic Numbers!)
    const minPhysicalWidth = faceWidth * 1.10;
    const maxPhysicalWidth = faceWidth * 1.45;
    let targetPhysicalWidth = faceWidth * 1.25;
    if (smoothedShoulderWidthRef.current > 0) {
      targetPhysicalWidth = smoothedShoulderWidthRef.current * 0.42;
    }
    targetPhysicalWidth = Math.min(maxPhysicalWidth, Math.max(minPhysicalWidth, targetPhysicalWidth));

    const baseScale = targetPhysicalWidth / boxWidthRef.current;
    const finalScale = baseScale * (ms || 1) * depthScale;

    const chinCapY = cb.chinY != null ? cb.chinY - faceWidth * 0.08 : Infinity;
    const anchoredY = Math.min(anchor.y, chinCapY);

    const targetPos = new THREE.Vector3(
      anchor.x + offsetX,
      anchoredY,
      anchor.z
    );

    const rotX = propsRef.current.modelRot ? (propsRef.current.modelRot[0] ?? 0) : 0;
    const rotY = propsRef.current.modelRot ? (propsRef.current.modelRot[1] ?? 0) : 0;
    const rotZ = propsRef.current.modelRot ? (propsRef.current.modelRot[2] ?? 0) : 0;

    // Velocity-adaptive rotation smooth
    if (!smoothedRotRef.current) {
      smoothedRotRef.current = { yaw: cb.yaw, pitch: cb.pitch, shoulderAngle: cb.shoulderAngle || 0 };
    } else {
      const sr = smoothedRotRef.current;
      const ryDelta = Math.abs(cb.yaw - sr.yaw);
      sr.yaw += (cb.yaw - sr.yaw) * getAdaptiveFactor(ryDelta, 35.0, 0.08);
      const rpDelta = Math.abs(cb.pitch - sr.pitch);
      sr.pitch += (cb.pitch - sr.pitch) * getAdaptiveFactor(rpDelta, 35.0, 0.08);
      const rsDelta = Math.abs((cb.shoulderAngle || 0) - sr.shoulderAngle);
      sr.shoulderAngle += ((cb.shoulderAngle || 0) - sr.shoulderAngle) * getAdaptiveFactor(rsDelta, 35.0, 0.08);
    }
    const smoothedRot = smoothedRotRef.current;

    const swayPitch = smoothedRot.pitch * (Math.PI / 4) * 0.20;
    const swayYaw = smoothedRot.yaw * (Math.PI / 4) * 0.20;
    const finalRotX = rotX + swayPitch;
    const finalRotY = rotY + swayYaw;
    const finalRotZ = rotZ + smoothedRot.shoulderAngle;
    const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(finalRotX, finalRotY, finalRotZ));

    // Adaptive lerp on top: quadratic curve for ultimate stillness at rest
    const dist = groupRef.current.position.distanceTo(targetPos);
    const posLerp = getAdaptiveFactor(dist, 15.0, 0.20);
    groupRef.current.position.lerp(targetPos, posLerp);

    const angle = groupRef.current.quaternion.angleTo(targetQuat);
    const rotLerp = getAdaptiveFactor(angle, 15.0, 0.20);
    groupRef.current.quaternion.slerp(targetQuat, rotLerp);

    groupRef.current.scale.lerp(
      new THREE.Vector3(finalScale, finalScale, finalScale),
      posLerp
    );

    // Update dynamic fade boundaries!
    // 1. Lock the fade center to the TRUE physical collarbone (ignoring user offsets)
    // We multiply the fade depths by the user's scale (ms) so that if they scale the model up,
    // the fade boundaries grow with it, preventing the model from swallowing itself into invisibility!
    uniformsRef.current.uNeckCenter.value.set(anchor.trueX, anchor.trueY, anchor.trueZ);
    uniformsRef.current.fadeStartDepth.value = trueCb.faceWidth * 0.50 * (ms || 1);
    uniformsRef.current.fadeEndDepth.value = trueCb.faceWidth * 0.80 * (ms || 1);

    // 2. Rotate the fade axis together with the necklace's own current orientation
    // (yaw/pitch sway). A world-fixed backward vector only matches the chain's actual
    // front/back while it faces the camera dead-on — as soon as it sways with head yaw,
    // a fixed axis cuts through the loop off-center, fading one side of the chain much
    // more than the other (reads as that side "shrinking" while turning). Rotating the
    // backward vector by the mesh's live quaternion keeps the fade band symmetric no
    // matter how the necklace is currently oriented. (Same technique EyewearMesh uses
    // for its temple fade.) Roll (Z-axis / shoulder tilt) doesn't affect a vector already
    // aligned with Z, so this only reacts to yaw/pitch, which is what we want.
    const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(groupRef.current.quaternion);
    uniformsRef.current.uBackward.value.copy(backward).normalize();
    uniformsRef.current.uUp.value.set(0, 1, 0);

    // 3. Tip Blur: Pass the absolute highest point of the necklace in world space
    uniformsRef.current.uNecklaceTopY.value = anchoredY;
    uniformsRef.current.uFadeDistTip.value = (boxHeightRef.current || 0) * finalScale * 0.22; // Blur top 22%
  });

  return (
    <group>
      {/* The visible necklace model */}
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
};

const NecklaceImageInner = ({ groupRef, landmarksRef, poseLandmarksRef, modelPos, modelRot, modelScale, imagePath, showFaceMesh }) => {
  const texture = useTexture(imagePath);

  React.useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  }, [texture]);

  // aspect ratio for scaling
  const aspect = texture.image ? (texture.image.width / texture.image.height) : 1;

  // Soft top-edge fade so the flat 2D chain doesn't end in a hard cutoff line —
  // mirrors the tip-blur the 3D GLTF necklace gets from its shader (see NecklaceMeshInner).
  const material = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      // Start fading halfway up (0.53) and fully disappear by 0.93, 
      // ensuring the top tips are fully invisible to look like they go behind the neck
      shader.uniforms.uFadeStart = { value: 0.53 };
      shader.uniforms.uFadeEnd = { value: 0.93 };

      // Declare our own varying rather than relying on the built-in vUv/vMapUv
      // (its name/availability differs across three.js versions).
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec2 vFadeUv;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
         vFadeUv = uv;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec2 vFadeUv;
         uniform float uFadeStart;
         uniform float uFadeEnd;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         // Fade the top portion of the plane to transparent (blur effect) so the chain
         // appears to disappear completely behind the neck instead of sitting on top.
         float topFade = 1.0 - smoothstep(uFadeStart, uFadeEnd, vFadeUv.y);
         gl_FragColor.a *= topFade;`
      );
    };
    return mat;
  }, [texture]);

  const propsRef = useRef({ modelPos, modelRot, modelScale });
  React.useEffect(() => {
    propsRef.current = { modelPos, modelRot, modelScale };
  });

  // Low-pass filter for the raw per-frame anchor — see NecklaceMeshInner for why.
  const smoothedAnchorRef = useRef(null);
  // Yaw-corrected face-width reference — see NecklaceMeshInner for why (iris-based IPD
  // width isn't rotation-invariant, so it read wider as the head yawed, ballooning the
  // 2D necklace's scale since this component drives size straight off cb.faceWidth).
  const stableFaceWidthRef = useRef(0);
  // Smooths the raw shoulder/chest point before it enters the anchor blend — see
  // computeCollarbone for why (Pose landmarks are noisier than the face mesh).
  const chestSmoothRef = useRef(null);
  // Dead-zone smoothing for the shoulder-roll angle — see NecklaceMeshInner for why
  // (atan2-based angles are very noise-sensitive, and this fed the quaternion raw).
  const smoothedShoulderAngleRef = useRef(null);
  // Smooths yaw specifically for the width-correction multiplier below.
  const smoothedYawForScaleRef = useRef(0);

  useFrame((state) => {
    if (!groupRef.current) return;

    const landmarks = landmarksRef.current;
    const poseLandmarks = poseLandmarksRef?.current;
    if (!landmarks || landmarks.length === 0) {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    const { viewport } = state;
    const { modelPos: mp, modelScale: ms } = propsRef.current;
    const offsetX = mp ? (mp[0] ?? 0) : 0;
    const offsetY = mp ? (mp[1] ?? 0) : 0;
    const offsetZ = mp ? (mp[2] ?? 0) : 0;

    const cb = computeCollarbone(landmarks, poseLandmarks, viewport, offsetY, chestSmoothRef);

    // Velocity-adaptive anchor EMA (same as NecklaceMeshInner)
    if (!smoothedAnchorRef.current) {
      smoothedAnchorRef.current = { x: cb.x, y: cb.y, z: cb.z };
    } else {
      const sm = smoothedAnchorRef.current;
      const adx = cb.x - sm.x;
      const ady = cb.y - sm.y;
      const aVel = Math.sqrt(adx * adx + ady * ady);
      const anchorEMA = getAdaptiveFactor(aVel, 45.0, 0.08);
      sm.x += adx * anchorEMA;
      sm.y += ady * anchorEMA;
      sm.z += (cb.z - sm.z) * anchorEMA;
    }
    const anchor = smoothedAnchorRef.current;

    // Velocity-adaptive yaw + face width
    const yawDelta = Math.abs(cb.yaw - smoothedYawForScaleRef.current);
    const yawEMA = getAdaptiveFactor(yawDelta, 35.0, 0.08);
    smoothedYawForScaleRef.current += (cb.yaw - smoothedYawForScaleRef.current) * yawEMA;
    const yawCorrection = 1 - Math.min(1, Math.abs(smoothedYawForScaleRef.current)) * 0.35;
    const correctedFaceWidth = cb.faceWidth * yawCorrection;
    if (stableFaceWidthRef.current === 0) {
      stableFaceWidthRef.current = correctedFaceWidth;
    } else {
      const fwDelta = Math.abs(correctedFaceWidth - stableFaceWidthRef.current);
      const fwEMA = getAdaptiveFactor(fwDelta, 30.0, 0.08);
      stableFaceWidthRef.current += (correctedFaceWidth - stableFaceWidthRef.current) * fwEMA;
    }

    const depthScale = Math.pow(1.15, offsetZ);
    // 2D planes are exactly 1 unit wide, so we just apply the physical face width directly
    const finalScale = stableFaceWidthRef.current * 1.4 * (ms || 1) * depthScale;

    // Never let the necklace render above the chin, however close the face gets to the
    // camera. Unlike the 3D chain, this plane is centered on its anchor (not top-pivoted),
    // so its top edge sits half its rendered height above the anchor — that offset has to
    // come out of the cap too, or a big/close necklace would still poke out over the chin.
    const chinCapY = cb.chinY != null ? cb.chinY - stableFaceWidthRef.current * 0.08 - finalScale / 2 : Infinity;
    const anchoredY = Math.min(anchor.y, chinCapY);

    const targetPos = new THREE.Vector3(
      anchor.x + offsetX,
      anchoredY,
      anchor.z
    );

    // ADAPTIVE LERP — quadratic curve for ultimate stillness at rest
    const dist = groupRef.current.position.distanceTo(targetPos);
    const lerpF = getAdaptiveFactor(dist, 15.0, 0.20);
    groupRef.current.position.lerp(targetPos, lerpF);

    const rotX = propsRef.current.modelRot ? (propsRef.current.modelRot[0] ?? 0) : 0;
    const rotY = propsRef.current.modelRot ? (propsRef.current.modelRot[1] ?? 0) : 0;

    // Velocity-adaptive shoulder angle
    if (smoothedShoulderAngleRef.current === null) {
      smoothedShoulderAngleRef.current = cb.shoulderAngle || 0;
    } else {
      const saDelta = Math.abs((cb.shoulderAngle || 0) - smoothedShoulderAngleRef.current);
      smoothedShoulderAngleRef.current += ((cb.shoulderAngle || 0) - smoothedShoulderAngleRef.current)
        * getAdaptiveFactor(saDelta, 35.0, 0.08);
    }

    const rotZ = (propsRef.current.modelRot ? (propsRef.current.modelRot[2] ?? 0) : 0) + smoothedShoulderAngleRef.current;
    const adminQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ));

    groupRef.current.quaternion.slerp(adminQuat, lerpF);
    groupRef.current.scale.lerp(
      new THREE.Vector3(finalScale * aspect, finalScale, finalScale),
      lerpF
    );
  });

  return (
    <group>
      <group ref={groupRef}>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>
    </group>
  );
};

export default NecklaceMesh;
