import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { applyAndExtractMaterials } from '../../utils/materialHelper';
import { useDragOffset } from '../../utils/useDragOffset';

const getAdaptiveFactor = (vel, scale, base = 0.08) => {
  const dampBase = base * 0.2;
  const dampScale = scale * 0.5;
  return Math.min(1.0, dampBase + Math.pow(vel * dampScale, 2));
};
const ZERO_VECTOR = new THREE.Vector3();

let cachedSparkleTexture = null;
const getSparkleTexture = () => {
  if (cachedSparkleTexture) return cachedSparkleTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  const cx = 64;
  const cy = 64;

  ctx.clearRect(0, 0, 128, 128);

  let gradV = ctx.createLinearGradient(64, 0, 64, 128);
  gradV.addColorStop(0, 'rgba(255,255,255,0)');
  gradV.addColorStop(0.5, 'rgba(255,255,255,1)');
  gradV.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradV;
  ctx.beginPath();
  ctx.moveTo(62, 0); ctx.lineTo(66, 0); ctx.lineTo(68, 64);
  ctx.lineTo(66, 128); ctx.lineTo(62, 128); ctx.lineTo(60, 64);
  ctx.fill();

  let gradH = ctx.createLinearGradient(0, 64, 128, 64);
  gradH.addColorStop(0, 'rgba(255,255,255,0)');
  gradH.addColorStop(0.5, 'rgba(255,255,255,1)');
  gradH.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradH;
  ctx.beginPath();
  ctx.moveTo(0, 62); ctx.lineTo(0, 66); ctx.lineTo(64, 68);
  ctx.lineTo(128, 66); ctx.lineTo(128, 62); ctx.lineTo(64, 60);
  ctx.fill();

  let radGrad = ctx.createRadialGradient(64, 64, 0, 64, 64, 16);
  radGrad.addColorStop(0, 'rgba(255,255,255,1)');
  radGrad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  radGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(64, 64, 16, 0, Math.PI * 2);
  ctx.fill();

  cachedSparkleTexture = new THREE.CanvasTexture(canvas);
  return cachedSparkleTexture;
};

export const JewelrySparkles = ({ count = 25, isPlane = false, imagePath = null, modelScene = null }) => {
  const texture = React.useMemo(() => getSparkleTexture(), []);
  const material = React.useMemo(() => new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }), [texture]);

  const sparklesRef = useRef([]);
  const [validPoints, setValidPoints] = React.useState(null);

  React.useEffect(() => {
    let active = true;
    if (isPlane && imagePath) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imagePath;
      img.onload = () => {
        if (!active) return;
        const canvas = document.createElement('canvas');
        const W = 128;
        const H = 128;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;
        const points = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const alpha = data[(y * W + x) * 4 + 3];
            if (alpha > 128) {
              points.push({
                x: (x / W) - 0.5,
                y: 0.5 - (y / H),
                z: 0.03
              });
            }
          }
        }
        if (points.length > 0) setValidPoints(points);
      };
    } else if (!isPlane && modelScene) {
      modelScene.updateMatrixWorld(true);
      const rootInverse = new THREE.Matrix4().copy(modelScene.matrixWorld).invert();
      const points = [];
      modelScene.traverse((child) => {
        if (child.isMesh && child.geometry && child.geometry.attributes.position) {
          const pos = child.geometry.attributes.position;
          for (let i = 0; i < pos.count; i += 7) {
            const vec = new THREE.Vector3().fromBufferAttribute(pos, i);
            vec.applyMatrix4(child.matrixWorld);
            vec.applyMatrix4(rootInverse);
            points.push({ x: vec.x, y: vec.y, z: vec.z + 0.01 });
          }
        }
      });
      if (points.length > 0) setValidPoints(points);
    }
    return () => { active = false; };
  }, [isPlane, imagePath, modelScene]);

  const sparklesData = React.useMemo(() => {
    if (!validPoints) return [];
    return Array.from({ length: count }).map(() => {
      const pt = validPoints[Math.floor(Math.random() * validPoints.length)];

      // We still use width for scale reference if 3D, but for now we just use a small base scale
      const is3D = !isPlane && modelScene;
      // In 3D, models can be huge (e.g. 100 units wide). We need the scale to adapt to the bounding box if possible, or just stay small relative to the points.
      // Actually, since groupRef scales the 3D model down, a large baseScale in 3D will be scaled down correctly!
      // In 2D, the scale is 1.
      // Let's use a dynamic scale based on the bounds of the points.
      let width = 1;
      if (is3D) {
        let minX = Infinity, maxX = -Infinity;
        validPoints.forEach(p => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
        });
        width = Math.max(0.1, maxX - minX);
      }

      const scatterX = (Math.random() - 0.5) * 0.02 * width;
      const scatterY = (Math.random() - 0.5) * 0.02 * width;

      return {
        position: new THREE.Vector3(pt.x + scatterX, pt.y + scatterY, pt.z),
        baseScale: (Math.random() * 0.03 + 0.02) * width * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.003 + 0.002
      };
    });
  }, [count, validPoints, isPlane, modelScene]);

  useFrame(() => {
    const now = performance.now();
    sparklesRef.current.forEach((sprite, i) => {
      if (sprite) {
        const data = sparklesData[i];
        const sine = Math.sin(now * data.speed + data.phase);

        sprite.material.opacity = sine * 0.5 + 0.5;
        const currentScale = data.baseScale * (sine * 0.3 + 0.7);
        sprite.scale.set(currentScale, currentScale, currentScale);
        sprite.material.rotation = (now * data.speed * 0.2) % (Math.PI * 2);
      }
    });
  });

  if (!validPoints) return null;

  return (
    <group>
      {sparklesData.map((data, i) => (
        <sprite
          key={i}
          ref={(el) => (sparklesRef.current[i] = el)}
          material={material}
          position={data.position}
        />
      ))}
    </group>
  );
};

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
function getDynamicScaleXY(viewport) {
  const videoNode = document.querySelector('.webcam-video');
  const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
  const containerAspect = viewport.width / viewport.height;
  let scaleX = 1; let scaleY = 1;
  if (containerAspect > videoAspect) {
    scaleY = containerAspect / videoAspect;
  } else {
    scaleX = videoAspect / containerAspect;
  }
  return { scaleX, scaleY };
}

function toVP(lm, viewport) {
  const { scaleX, scaleY } = getDynamicScaleXY(viewport);
  return {
    x: -(lm.x - 0.5) * (viewport.width * scaleX),
    y: -(lm.y - 0.5) * (viewport.height * scaleY),
    z: -lm.z * viewport.width * 1.5,
  };
}

// ── Shared composite anchor computation ──────────────────────────────
export function computeCollarbone(faceLandmarks, poseLandmarks, viewport, offsetY = 0, chestSmoothRef = null) {
  const { scaleX, scaleY } = getDynamicScaleXY(viewport);

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
  const ipdX = -(rightIris.x - leftIris.x) * (viewport.width * scaleX);
  const ipdY = -(rightIris.y - leftIris.y) * (viewport.height * scaleY);
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

  // Anchor is below jaw angles by ~0.45 * faceWidth (closer to chin, reduced gap)
  const faceAnchorX = jawAngleMidVP.x;
  const faceAnchorY = jawAngleMidVP.y - (faceWidth * 0.45);
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
      shoulderWidth = Math.sqrt(dx * dx + dy * dy + dz * dz);

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
export default function NecklaceMesh({ landmarksRef, poseLandmarksRef, activeModel, modelPos, modelRot, modelScale, modelScaleY, modelNecklaceBlur, modelSparkles, customMaterials, showFaceMesh, dragResetTick }) {
  const groupRef = useRef();
  const boxHeightRef = useRef(0);
  const boxWidthRef = useRef(1);
  const drag = useDragOffset(groupRef, dragResetTick);
  const modelPath = activeModel?.glbPath || activeModel?.modelPath;
  if (!modelPath) return null;

  const isImage = /\.(png|jpe?g|svg)(\?.*)?$/i.test(modelPath);

  if (isImage) {
    return (
      <NecklaceImageInner
        groupRef={groupRef}
        landmarksRef={landmarksRef}
        poseLandmarksRef={poseLandmarksRef}
        modelPos={modelPos}
        modelRot={modelRot}
        modelScale={modelScale}
        modelScaleY={modelScaleY}
        modelNecklaceBlur={modelNecklaceBlur}
        modelSparkles={modelSparkles}
        imagePath={modelPath}
        showFaceMesh={showFaceMesh}
        dragOffsetRef={drag.offsetRef}
        dragHandlers={drag.dragHandlers}
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
      modelScaleY={modelScaleY}
      modelNecklaceBlur={modelNecklaceBlur}
      modelSparkles={modelSparkles}
      activeModel={activeModel}
      gltfPath={modelPath}
      showFaceMesh={showFaceMesh}
      customMaterials={customMaterials}
      dragOffsetRef={drag.offsetRef}
      dragHandlers={drag.dragHandlers}
      dragResetTick={dragResetTick}
    />
  );
};

const NecklaceMeshInner = ({ groupRef, landmarksRef, poseLandmarksRef, modelPos, modelRot, modelScale, modelScaleY, modelNecklaceBlur, modelSparkles, gltfPath, showFaceMesh, customMaterials, dragOffsetRef, dragHandlers }) => {
  const { scene } = useGLTF(gltfPath);

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

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

  // refs moved to after hasInitializedRef

  // Inject custom shader logic to beautifully fade out the back of the chain!
  React.useEffect(() => {
    if (clonedScene) {
      clonedScene.traverse((child) => {
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
               // We apply a power curve (2.5) to the tip blur to make the fade "stronger" 
               // and drop to transparency much faster.
               float strongTipFade = pow(fadeAlphaTip, 2.5);
               float fadeAlpha = fadeAlphaDepth * strongTipFade;
               
               gl_FragColor = vec4(gl_FragColor.rgb, gl_FragColor.a * fadeAlpha);`
            );
          };
        }
      });
    }
  }, [clonedScene]);

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
  const smoothedYawForScaleRef = useRef(null);
  // Low-pass filter for the raw per-frame anchor (landmark tracking noise) — the
  // position/quaternion lerp below already smooths toward the target, but its adaptive
  // factor ramps to ~1.0 for anything but the tiniest motion, so noisy input was passing
  // through almost unfiltered. This EMA removes that jitter before it ever becomes a target.
  const smoothedAnchorRef = useRef(null);
  // First-frame snap guard: On the very first frame that has valid landmarks, the necklace
  // must be placed directly at the target collarbone position (not lerped from the Three.js
  // default origin at (0,0,0)). If we show it at origin first, it appears over the face for
  // 1 frame, making the model's head temporarily invisible — which is what the user reported.
  const hasInitializedRef = useRef(false);

  const boxHeightRef = useRef(0);
  const boxWidthRef = useRef(0);

  // Auto-center the 3D model's pivot point to its true geometric center
  // This fixes models that were exported with off-center origins.
  React.useEffect(() => {
    if (!clonedScene) return;
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());

    // We lock the main pivot point to the TOP of the chain geometry
    // so it always 'hangs' from the neck. This prevents the clasps from dropping when scaled down.
    clonedScene.position.x = -center.x;
    clonedScene.position.y = -box.max.y;
    clonedScene.position.z = -center.z;
    // Calculate the absolute vertical size of the necklace so we know how long to make the tip fade
    boxHeightRef.current = box.max.y - box.min.y;
    // Calculate the absolute width so we can scale it to match the human mathematically
    const width = box.max.x - box.min.x;
    boxWidthRef.current = width > 0 ? width : 1; // Prevent division by zero
  }, [clonedScene]);

  const propsRef = useRef({ modelPos, modelRot, modelScale, modelScaleY, modelNecklaceBlur });
  React.useEffect(() => {
    propsRef.current = { modelPos, modelRot, modelScale, modelScaleY, modelNecklaceBlur };
  });

  useFrame((state) => {
    if (!groupRef.current) return;

    if (boxWidthRef.current === 0) {
      groupRef.current.visible = false;
      return;
    }

    const landmarks = landmarksRef.current;
    const poseLandmarks = poseLandmarksRef?.current;
    if (!landmarks || landmarks.length === 0) {
      groupRef.current.visible = false;
      // Reset the init flag so the next time landmarks arrive we snap again
      // (covers the case where the user goes out of frame and comes back)
      hasInitializedRef.current = false;
      return;
    }
    // Keep hidden until we have snapped to the correct position on the first frame.
    // This prevents the 1-frame flash at Three.js origin (0,0,0) that sits over the face.
    if (!hasInitializedRef.current) {
      groupRef.current.visible = false;
    }

    const { viewport } = state;
    const { modelPos: mp, modelScale: ms, modelScaleY: msY } = propsRef.current;
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

    // Yaw + face width
    if (smoothedYawForScaleRef.current === null) {
      smoothedYawForScaleRef.current = cb.yaw;
    } else {
      const yawDelta = Math.abs(cb.yaw - smoothedYawForScaleRef.current);
      const yawEMA = getAdaptiveFactor(yawDelta, 35.0, 0.08);
      smoothedYawForScaleRef.current += (cb.yaw - smoothedYawForScaleRef.current) * yawEMA;
    }
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

    // Shift the chin cap upward by the user's manual offset so the slider can move
    // the model above the default chin ceiling. offsetY < 0 = user is dragging up.
    const userLiftY = offsetY < 0 ? (faceWidth * Math.abs(offsetY) * 0.1) : 0;
    const chinCapY = cb.chinY != null ? cb.chinY - faceWidth * 0.08 + userLiftY : Infinity;
    const anchoredY = Math.min(anchor.y, chinCapY);

    const targetPos = new THREE.Vector3(
      anchor.x + offsetX,
      anchoredY,
      anchor.z
    ).add(dragOffsetRef?.current || ZERO_VECTOR);

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

    // On the very first valid frame: snap directly to the computed target so we never
    // render at Three.js default (0,0,0) — which sits in the face area and hides the head.
    if (!hasInitializedRef.current) {
      groupRef.current.position.copy(targetPos);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale * (msY || 1), finalScale);
      groupRef.current.visible = true;
      hasInitializedRef.current = true;
    } else {
      // Adaptive lerp on top: quadratic curve for ultimate stillness at rest
      const dist = groupRef.current.position.distanceTo(targetPos);
      const posLerp = getAdaptiveFactor(dist, 15.0, 0.20);
      groupRef.current.position.lerp(targetPos, posLerp);

      const angle = groupRef.current.quaternion.angleTo(targetQuat);
      const rotLerp = getAdaptiveFactor(angle, 15.0, 0.20);
      groupRef.current.quaternion.slerp(targetQuat, rotLerp);

      groupRef.current.scale.lerp(
        new THREE.Vector3(finalScale, finalScale * (msY || 1), finalScale),
        posLerp
      );
    }

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
    const blurPct = (propsRef.current.modelNecklaceBlur ?? 18) / 100.0;
    uniformsRef.current.uFadeDistTip.value = (boxHeightRef.current || 0) * finalScale * blurPct;
  });

  if (!clonedScene) return null;

  return (
    <group>
      {/* The visible necklace model */}
      <group ref={groupRef} {...dragHandlers}>
        <primitive object={clonedScene} />
        {modelSparkles && <JewelrySparkles count={75} isPlane={false} modelScene={clonedScene} />}
      </group>
    </group>
  );
};

const NecklaceImageInner = ({ groupRef, landmarksRef, poseLandmarksRef, modelPos, modelRot, modelScale, modelScaleY, modelNecklaceBlur, modelSparkles, imagePath, showFaceMesh, dragOffsetRef, dragHandlers }) => {
  const texture = useTexture(imagePath);

  React.useEffect(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  }, [texture]);

  // aspect ratio for scaling
  const aspect = texture.image ? (texture.image.width / texture.image.height) : 0;

  // Soft top-edge fade so the flat 2D chain doesn't end in a hard cutoff line —
  // mirrors the tip-blur the 3D GLTF necklace gets from its shader (see NecklaceMeshInner).
  const material = React.useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    // The scene's renderer applies filmic tone-mapping (for the lit/PBR jewelry and video
    // background), but that curve compresses bright saturated hues — gold especially —
    // toward pale/washed-out. This is a flat, unlit 2D overlay, not a physically-lit
    // surface, so it should render the source PNG's colors as-authored instead of being
    // run through the same tone curve as the rest of the scene.
    mat.toneMapped = false;
    mat.onBeforeCompile = (shader) => {
      // Use dynamic uniform for blur amount
      shader.uniforms.uBlurAmount = { value: 18.0 };


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
         uniform float uBlurAmount;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         float blurPct = clamp(uBlurAmount / 100.0, 0.0, 1.0);
         // start fading at (1.0 - blurPct) from the top, fully disappeared at the very top (1.0)
         float startF = 1.0 - blurPct;
         float endF = 1.0;
         float topFade = 1.0 - smoothstep(startF, endF, vFadeUv.y);
         
         // Fix: If blurPct is 0, completely disable the fade so it doesn't accidentally blur the top pixel
         if (blurPct == 0.0) {
             topFade = 1.0;
         } else {
             // Apply a power curve to make the fade drop off much stronger/faster
             topFade = pow(topFade, 2.5);
         }
         
         gl_FragColor.a *= topFade;`
      );
      mat.userData.shader = shader;
    };
    return mat;
  }, [texture]);

  const propsRef = useRef({ modelPos, modelRot, modelScale, modelScaleY, modelNecklaceBlur });
  React.useEffect(() => {
    propsRef.current = { modelPos, modelRot, modelScale, modelScaleY, modelNecklaceBlur };
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
  const smoothedYawForScaleRef = useRef(null);
  // First-frame snap guard: same rationale as NecklaceMeshInner — prevents the 2D plane
  // from appearing at Three.js origin (0,0,0) for one frame, which sits over the face.
  const hasInitializedRef = useRef(false);

  useFrame((state) => {
    if (!groupRef.current) return;

    if (aspect === 0) {
      groupRef.current.visible = false;
      return;
    }

    const landmarks = landmarksRef.current;
    const poseLandmarks = poseLandmarksRef?.current;
    if (!landmarks || landmarks.length === 0) {
      groupRef.current.visible = false;
      // Reset so next landmark arrival triggers a fresh snap
      hasInitializedRef.current = false;
      return;
    }
    // Keep hidden until the first correct-position snap has been applied
    if (!hasInitializedRef.current) {
      groupRef.current.visible = false;
    }

    const { viewport } = state;
    const { modelPos: mp, modelScale: ms, modelScaleY: msY } = propsRef.current;
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
    if (smoothedYawForScaleRef.current === null) {
      smoothedYawForScaleRef.current = cb.yaw;
    } else {
      const yawDelta = Math.abs(cb.yaw - smoothedYawForScaleRef.current);
      const yawEMA = getAdaptiveFactor(yawDelta, 35.0, 0.08);
      smoothedYawForScaleRef.current += (cb.yaw - smoothedYawForScaleRef.current) * yawEMA;
    }
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
    // Shift the chin cap upward by the user's manual offset so the slider can move
    // the model above the default chin ceiling. offsetY < 0 = user is dragging up.
    const userLiftY2D = offsetY < 0 ? (stableFaceWidthRef.current * Math.abs(offsetY) * 0.1) : 0;
    const chinCapY = cb.chinY != null ? cb.chinY - stableFaceWidthRef.current * 0.08 - finalScale / 2 + userLiftY2D : Infinity;
    const anchoredY = Math.min(anchor.y, chinCapY);

    const targetPos = new THREE.Vector3(
      anchor.x + offsetX,
      anchoredY,
      anchor.z
    ).add(dragOffsetRef?.current || ZERO_VECTOR);

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

    // On the very first valid frame: snap directly to target (no lerp from origin)
    if (!hasInitializedRef.current) {
      groupRef.current.position.copy(targetPos);
      groupRef.current.quaternion.copy(adminQuat);
      groupRef.current.scale.set(finalScale * aspect, finalScale * (msY || 1), finalScale);
      groupRef.current.visible = true;
      hasInitializedRef.current = true;
    } else {
      // ADAPTIVE LERP — quadratic curve for ultimate stillness at rest
      const dist = groupRef.current.position.distanceTo(targetPos);
      const lerpF = getAdaptiveFactor(dist, 15.0, 0.20);
      groupRef.current.position.lerp(targetPos, lerpF);

      groupRef.current.quaternion.slerp(adminQuat, lerpF);
      groupRef.current.scale.lerp(
        new THREE.Vector3(finalScale * aspect, finalScale * (msY || 1), finalScale),
        lerpF
      );
    }
    
    if (material.userData.shader) {
      material.userData.shader.uniforms.uBlurAmount.value = propsRef.current.modelNecklaceBlur ?? 18;
    }
  });

  return (
    <group>
      <group ref={groupRef} {...dragHandlers}>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <primitive object={material} attach="material" />
        </mesh>
        {modelSparkles && <JewelrySparkles count={75} isPlane={true} imagePath={imagePath} />}
      </group>
    </group>
  );
};


