import React, { useRef, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, useGLTF, Html, useProgress, Center } from '@react-three/drei';
import * as THREE from 'three';
import NecklaceMesh from './components/ar/NecklaceMesh';
import ModelErrorBoundary from './components/ar/ModelErrorBoundary';
import { applyAndExtractMaterials } from './utils/materialHelper';

// Categories that use the face-landmark eyewear AR
const FACE_AR_CATEGORIES = ['eyewear'];
// Ring AR: fixed position in frame (no body tracking)
const RING_AR_CATEGORIES = ['rings'];


const FullFaceMesh = ({ landmarksRef, showFaceMesh, sharedState }) => {
  const meshRef = useRef();

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
    if (!landmarks || landmarks.length === 0 || !geometry) {
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
    geometry.attributes.position.needsUpdate = true;
  });

  if (!geometry) return null;

  return (
    <group ref={meshRef}>
      {/* 1. Invisible Occluder: ALWAYS render this so glasses arms are hidden behind the head */}
      <mesh geometry={occluderGeometry} renderOrder={-1}>
        <meshBasicMaterial
          side={THREE.DoubleSide}
          transparent={true}
          opacity={0.0}   // Invisible
          depthWrite={true}
          colorWrite={false} // Writes only to the depth buffer
          // Push the mask backward by a tiny fraction.
          // This prevents the lenses and the rest of the model from clipping into the cheeks during rotation, 
          // but is small enough that the temples still get hidden properly!
          polygonOffset={true}
          polygonOffsetFactor={0.1}
          polygonOffsetUnits={5}
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
    if (!landmarks || landmarks.length === 0 || !showMesh) {
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

const EarringMesh = ({ landmarksRef, modelPos, modelRot, modelScale, sharedState, activeModel, customMaterials }) => {
  const leftGroupRef = useRef();
  const rightGroupRef = useRef();
  const occluderRef = useRef();

  const gltfPath = activeModel?.glbPath;
  const { scene } = useGLTF(gltfPath || '');

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  // Clone the scene so we can render two earrings (one for each ear)
  const leftScene = React.useMemo(() => clonedScene ? clonedScene.clone() : null, [clonedScene]);
  const rightScene = React.useMemo(() => clonedScene ? clonedScene.clone() : null, [clonedScene]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length === 0 || !leftGroupRef.current || !rightGroupRef.current) {
      if (leftGroupRef.current) leftGroupRef.current.visible = false;
      if (rightGroupRef.current) rightGroupRef.current.visible = false;
      return;
    }

    if (leftGroupRef.current) leftGroupRef.current.visible = true;
    if (rightGroupRef.current) rightGroupRef.current.visible = true;

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

    // Use tragus/temple landmarks as ear anchors (234 left, 454 right)
    // Note: MediaPipe FaceMesh 234 is the left ear, 454 is the right ear
    const leftAnchor = getMapped(234);
    const rightAnchor = getMapped(454);

    // Center of the head (between the temples)
    const centerPos = new THREE.Vector3().addVectors(leftAnchor, rightAnchor).multiplyScalar(0.5);

    // Calculate physical face width
    const rawDiffX = -(landmarks[454].x - landmarks[234].x) * (viewport.width * scaleX);
    const rawDiffY = -(landmarks[454].y - landmarks[234].y) * (viewport.height * scaleY);
    const rawDiffZ = -(landmarks[454].z - landmarks[234].z) * viewport.width;
    const faceWidth = Math.sqrt(rawDiffX * rawDiffX + rawDiffY * rawDiffY + rawDiffZ * rawDiffZ);

    // Head rotation estimation
    const diffX = rightAnchor.x - leftAnchor.x;
    const diffY = rightAnchor.y - leftAnchor.y;
    const diffZ = rightAnchor.z - leftAnchor.z;

    const roll = Math.atan2(diffY, diffX);
    const yaw = Math.asin(diffZ / Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ));

    const top = getMapped(10);
    const bottom = getMapped(152);

    const verticalDist = bottom.distanceTo(top);
    const pitch = -Math.asin((bottom.z - top.z) / verticalDist);

    const targetEuler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
    const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);

    // Calculate synthetic earlobe positions
    // The earlobe is located physically below the tragus.
    // In our mirrored 3D space: leftAnchor is +X (right screen), rightAnchor is -X (left screen).
    // To push OUTWARD, we ADD to leftAnchor's X, and SUBTRACT from rightAnchor's X.
    const downwardOffset = -faceWidth * 0.15;
    const outwardOffset = faceWidth * 0.05;

    const leftEarlobeOffset = new THREE.Vector3(outwardOffset, downwardOffset, 0);
    leftEarlobeOffset.applyQuaternion(targetQuat);
    const leftEarlobe = new THREE.Vector3().addVectors(leftAnchor, leftEarlobeOffset);

    const rightEarlobeOffset = new THREE.Vector3(-outwardOffset, downwardOffset, 0);
    rightEarlobeOffset.applyQuaternion(targetQuat);
    const rightEarlobe = new THREE.Vector3().addVectors(rightAnchor, rightEarlobeOffset);

    const finalScale = faceWidth * 1.05 * (modelScale || 1);

    // The occluder needs to be slightly narrower than the face width
    // so it doesn't accidentally swallow the earrings themselves!
    const occluderScale = faceWidth * 0.85;

    if (leftGroupRef.current.scale.x === 1) { // Uninitialized
      leftGroupRef.current.position.copy(leftEarlobe);
      leftGroupRef.current.quaternion.copy(targetQuat);
      leftGroupRef.current.scale.set(finalScale, finalScale, finalScale);

      rightGroupRef.current.position.copy(rightEarlobe);
      rightGroupRef.current.quaternion.copy(targetQuat);
      // Mirror the right earring anatomically by flipping X scale
      rightGroupRef.current.scale.set(-finalScale, finalScale, finalScale);

      if (occluderRef.current) {
        occluderRef.current.position.copy(centerPos);
        occluderRef.current.quaternion.copy(targetQuat);
        occluderRef.current.scale.set(occluderScale, occluderScale, occluderScale);
      }
    } else {
      const dist = leftGroupRef.current.position.distanceTo(leftEarlobe);
      const posLerp = Math.min(1.0, 0.2 + (dist * 10.0));
      const angle = leftGroupRef.current.quaternion.angleTo(targetQuat);
      const rotLerp = Math.min(1.0, 0.2 + (angle * 10.0));
      const masterLerp = Math.max(posLerp, rotLerp);

      if (sharedState) sharedState.current.adaptiveLerp = masterLerp;

      leftGroupRef.current.position.lerp(leftEarlobe, masterLerp);
      leftGroupRef.current.quaternion.slerp(targetQuat, masterLerp);
      leftGroupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), masterLerp);

      rightGroupRef.current.position.lerp(rightEarlobe, masterLerp);
      rightGroupRef.current.quaternion.slerp(targetQuat, masterLerp);
      rightGroupRef.current.scale.lerp(new THREE.Vector3(-finalScale, finalScale, finalScale), masterLerp);

      if (occluderRef.current) {
        occluderRef.current.position.lerp(centerPos, masterLerp);
        occluderRef.current.quaternion.slerp(targetQuat, masterLerp);
        occluderRef.current.scale.lerp(new THREE.Vector3(occluderScale, occluderScale, occluderScale), masterLerp);
      }
    }
  });

  if (!leftScene || !rightScene) return null;

  return (
    <group>
      {/* Invisible Head Occluder: hides earrings on the opposite side of the head when turning */}
      <mesh ref={occluderRef} renderOrder={-1}>
        {/* Sphere offset slightly backwards to match the skull shape without clipping the face */}
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={true}
          polygonOffset={true}
          polygonOffsetFactor={0.1}
          polygonOffsetUnits={5}
        />
      </mesh>

      <group ref={leftGroupRef}>
        <primitive
          object={leftScene}
          rotation={modelRot || [0, 0, 0]}
          position={modelPos || [0, 0, 0]}
        />
      </group>
      <group ref={rightGroupRef}>
        <primitive
          object={rightScene}
          rotation={modelRot || [0, 0, 0]}
          // The negative X scale on the parent group automatically mirrors the translation!
          position={modelPos || [0, 0, 0]}
        />
      </group>
    </group>
  );
};

const NosePinMesh = ({ landmarksRef, modelPos, modelRot, modelScale, sharedState, activeModel, customMaterials }) => {
  const groupRef = useRef();
  const occluderRef = useRef();

  const gltfPath = activeModel?.glbPath;
  const { scene } = useGLTF(gltfPath || '');

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length === 0 || !groupRef.current) {
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

    // Calculate physical face width
    const rawDiffX = -(landmarks[454].x - landmarks[234].x) * (viewport.width * scaleX);
    const rawDiffY = -(landmarks[454].y - landmarks[234].y) * (viewport.height * scaleY);
    const rawDiffZ = -(landmarks[454].z - landmarks[234].z) * viewport.width;
    const faceWidth = Math.sqrt(rawDiffX * rawDiffX + rawDiffY * rawDiffY + rawDiffZ * rawDiffZ);

    // Head rotation estimation
    const leftAnchor = getMapped(234);
    const rightAnchor = getMapped(454);
    const diffX = rightAnchor.x - leftAnchor.x;
    const diffY = rightAnchor.y - leftAnchor.y;
    const diffZ = rightAnchor.z - leftAnchor.z;

    const roll = Math.atan2(diffY, diffX);
    const yaw = Math.asin(diffZ / Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ));

    const top = getMapped(10);
    const bottom = getMapped(152);

    const verticalDist = bottom.distanceTo(top);
    const pitch = -Math.asin((bottom.z - top.z) / verticalDist);

    const targetEuler = new THREE.Euler(pitch, yaw, roll, 'YXZ');
    const targetQuat = new THREE.Quaternion().setFromEuler(targetEuler);

    const finalScale = faceWidth * 1.05 * (modelScale || 1);

    // The occluder needs to be roughly the size of the nose
    const occluderScale = faceWidth * 0.25;

    if (groupRef.current.scale.x === 1) { // Uninitialized
      groupRef.current.position.copy(anchor);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale, finalScale);

      if (occluderRef.current) {
        occluderRef.current.position.copy(noseCenter);
        occluderRef.current.quaternion.copy(targetQuat);
        occluderRef.current.scale.set(occluderScale, occluderScale, occluderScale);
      }
    } else {
      const dist = groupRef.current.position.distanceTo(anchor);
      const posLerp = Math.min(1.0, 0.2 + (dist * 10.0));
      const angle = groupRef.current.quaternion.angleTo(targetQuat);
      const rotLerp = Math.min(1.0, 0.2 + (angle * 10.0));
      const masterLerp = Math.max(posLerp, rotLerp);

      if (sharedState) sharedState.current.adaptiveLerp = masterLerp;

      groupRef.current.position.lerp(anchor, masterLerp);
      groupRef.current.quaternion.slerp(targetQuat, masterLerp);
      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), masterLerp);

      if (occluderRef.current) {
        occluderRef.current.position.lerp(noseCenter, masterLerp);
        occluderRef.current.quaternion.slerp(targetQuat, masterLerp);
        occluderRef.current.scale.lerp(new THREE.Vector3(occluderScale, occluderScale, occluderScale), masterLerp);
      }
    }
  });

  if (!scene) return null;

  return (
    <group>
      {/* Invisible Nose Occluder: hides the stem of the nose pin that goes inside the nose */}
      <mesh ref={occluderRef} renderOrder={-1}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={true}
          polygonOffset={true}
          polygonOffsetFactor={0.1}
          polygonOffsetUnits={5}
        />
      </mesh>

      <group ref={groupRef}>
        <primitive
          object={clonedScene}
          rotation={modelRot || [0, 0, 0]}
          position={modelPos || [0, 0, 0]}
        />
      </group>
    </group>
  );
};

const EyewearMesh = ({ landmarksRef, modelPos, modelRot, modelScale, sharedState, activeModel, customMaterials }) => {
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
    if (!landmarks || landmarks.length === 0 || !groupRef.current) {
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

    const getMapped = (index) => {
      const lm = landmarks[index];
      return {
        x: -(lm.x - 0.5) * (viewport.width * scaleX),
        y: -(lm.y - 0.5) * (viewport.height * scaleY),
        z: -lm.z * viewport.width * 1.5
      };
    };

    const leftTemple = getMapped(234);
    const rightTemple = getMapped(454);

    // --- DYNAMIC SCALE (ROTATION INDEPENDENT) ---
    // Calculate face width using a true 1:1 Z-ratio so the scale doesn't artificially inflate when the head turns!
    const rawDiffX = -(landmarks[454].x - landmarks[234].x) * (viewport.width * scaleX);
    const rawDiffY = -(landmarks[454].y - landmarks[234].y) * (viewport.height * scaleY);
    const rawDiffZ = -(landmarks[454].z - landmarks[234].z) * viewport.width; // 1.0 ratio, no 1.5 multiplier!

    // Physical width of the user's face in the 3D scene (constant during rotation)
    const faceWidth = Math.sqrt(rawDiffX * rawDiffX + rawDiffY * rawDiffY + rawDiffZ * rawDiffZ);

    // --- 3D ROTATION (POSE ESTIMATION) ---
    const diffX = rightTemple.x - leftTemple.x;
    const diffY = rightTemple.y - leftTemple.y;
    const diffZ = rightTemple.z - leftTemple.z;

    // Removed negative sign to fix inverted roll!
    const roll = Math.atan2(diffY, diffX);
    // Use the scaled faceWidth for accurate yaw calculation
    const yaw = Math.asin(diffZ / Math.sqrt(diffX * diffX + diffY * diffY + diffZ * diffZ));

    const top = getMapped(10);
    const bottom = getMapped(152);

    const verticalDist = Math.sqrt(
      Math.pow(bottom.x - top.x, 2) +
      Math.pow(bottom.y - top.y, 2) +
      Math.pow(bottom.z - top.z, 2)
    );
    const pitch = -Math.asin((bottom.z - top.z) / verticalDist);

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

  React.useEffect(() => {
    const tex = new THREE.Texture();
    tex.colorSpace = THREE.SRGBColorSpace;
    // Mirror the texture to match AR view
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;

    textureRef.current = tex;
    scene.background = tex;

    return () => {
      scene.background = null;
      tex.dispose();
    };
  }, [scene]);

  useFrame(({ viewport }) => {
    if (videoFrameRef.current && textureRef.current) {
      const tex = textureRef.current;
      tex.image = videoFrameRef.current;
      tex.needsUpdate = true;

      // Apply object-fit: cover scaling to the background texture!
      const videoNode = document.querySelector('.webcam-video');
      const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (640 / 480);
      const containerAspect = viewport.width / viewport.height;

      let scaleX = 1; let scaleY = 1;
      if (containerAspect > videoAspect) {
        scaleY = containerAspect / videoAspect;
      } else {
        scaleX = videoAspect / containerAspect;
      }

      tex.repeat.set(-1 / scaleX, 1 / scaleY);
      tex.offset.set((1 - (-1 / scaleX)) / 2, (1 - (1 / scaleY)) / 2);
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

const TrackingStatus = ({ landmarksRef, isHandTracking, category }) => {
  const [detected, setDetected] = useState(true);
  // Rings don't need face detection — suppress warning
  const needsFace = category !== 'rings';

  useFrame(() => {
    if (!needsFace) return;
    const isDetected = !!(landmarksRef.current && landmarksRef.current.length > 0);
    if (detected !== isDetected) {
      setDetected(isDetected);
    }
  });

  if (!needsFace || detected) return null;
  return (
    <Html center>
      <div style={{
        color: 'white', background: 'rgba(220,38,38,0.9)', padding: '15px 30px',
        borderRadius: '30px', fontWeight: 'bold', fontSize: '18px',
        border: '2px solid #f87171', boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)',
        whiteSpace: 'nowrap'
      }}>
        ⚠️ {isHandTracking ? 'Hand' : 'Face'} Not Detected
      </div>
    </Html>
  );
};

const WristMesh = ({ landmarksRef, modelPos, modelRot, modelScale, activeModel, showMesh, customMaterials }) => {
  const groupRef = useRef();

  const gltfPath = activeModel?.glbPath;
  const { scene } = useGLTF(gltfPath || '/models/watch/f2917202433f.glb');

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length === 0 || !groupRef.current) {
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
        // Use the exact same scale multiplier for Z to maintain isometric 3D proportions
        -lm.z * (viewport.width * scaleX)
      );
    };

    const p0 = getMapped(0);
    const p5 = getMapped(5);
    const p9 = getMapped(9);
    const p17 = getMapped(17);

    // Define the absolute normal of the palm using the knuckles
    // Using vAcross (p17 - p5) and vForwardRaw (p9 - p0) creates a 90-degree cross product, 
    // which is MUCH more stable than vPinky x vIndex when the hand is angled or making a fist!
    const vAcross = new THREE.Vector3().subVectors(p17, p5).normalize();
    const vForwardRaw = new THREE.Vector3().subVectors(p9, p0).normalize();
    const vUp = new THREE.Vector3().crossVectors(vAcross, vForwardRaw).normalize();

    // MediaPipe unmirrored mode: label 'Right' means physical Right hand.
    const isPhysicalRight = landmarks.handedness?.label === 'Right';
    if (isPhysicalRight) {
      vUp.negate(); // Now vUp ALWAYS points out of the back of the hand (+Z)
    }

    // PALM PLANE PROJECTION: 
    // Project the forward vector onto the palm plane so it stays perfectly flat 
    // against the back of the hand even when fingers bend!
    // Formula: V_proj = V - (V dot N) * N
    const vForward = vForwardRaw.clone().sub(vUp.clone().multiplyScalar(vForwardRaw.dot(vUp))).normalize();

    // Orthogonal right vector (points across the wrist)
    const vRight = new THREE.Vector3().crossVectors(vUp, vForward).normalize();

    const rotationMatrix = new THREE.Matrix4().makeBasis(vRight, vUp, vForward);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

    // Scale based on 3D distance from wrist to middle knuckle.
    // We use 3D distance (distanceTo) so the bracelet doesn't shrink (foreshorten) 
    // when the user tilts their hand backwards or forwards!
    const palmLength3D = p9.distanceTo(p0);

    // Dynamic scale based on wrist rotation (user preference):
    // Inverted logic based on real-world testing:
    const viewFactor = THREE.MathUtils.clamp(vUp.z, -0.5, 0.5); // Clamped between -0.5 and 0.5
    const normalizedView = viewFactor + 0.5; // Mapped to 0.0 - 1.0 range
    // When normalizedView is 1.0, scale is 0.50. When 0.0, scale is 0.60.
    const dynamicMultiplier = 0.60 - (0.10 * normalizedView);
    let finalScale = palmLength3D * dynamicMultiplier;

    // Adjust scale slightly smaller for the right hand as requested by user
    const isActuallyRightHand = landmarks.handedness?.label === 'Left'; // Mirrored webcam
    if (isActuallyRightHand) {
      finalScale *= 0.95; // Reduce scale by 15% for right hand
    }

    // Position offset: Center exactly at the wrist (p0). 
    // We do not push it down the forearm because MediaPipe only gives palm-based tracking. 
    // Pushing it down the arm causes it to float in the air when the wrist bends!
    const targetPos = p0.clone();

    if (groupRef.current.scale.x === 1) {
      groupRef.current.position.copy(targetPos);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale, finalScale);
    } else {
      // ADAPTIVE LERP: Solves both "lag" and "jitter"!
      // Calculate how far the hand just moved
      const dist = groupRef.current.position.distanceTo(targetPos);

      // If moving fast (high distance), lerp is high (0.9) to catch up instantly without lag.
      // If moving slow/still (low distance), lerp is low (0.2) to absorb camera jitter.
      // Multiplier increased to 3.0 so even medium movements reach max speed instantly!
      const posLerp = THREE.MathUtils.clamp(dist * 3.0, 0.2, 0.9);
      const rotLerp = THREE.MathUtils.clamp(dist * 3.0, 0.2, 0.85);

      // ADAPTIVE SCALE LERP:
      const currentScale = groupRef.current.scale.x;
      const scaleDiff = Math.abs(currentScale - finalScale);
      const scaleLerp = THREE.MathUtils.clamp(scaleDiff * 5.0, 0.2, 0.9);

      groupRef.current.position.lerp(targetPos, posLerp);
      groupRef.current.quaternion.slerp(targetQuat, rotLerp);
      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), scaleLerp);
    }
  });

  // Mirror tuning parameters anatomically for the physical right hand
  const isPhysicalRight = landmarksRef.current?.handedness?.label === 'Right';
  const adjustedPos = modelPos ? [...modelPos] : [0, 0, 0];
  const adjustedRot = modelRot ? [...modelRot] : [0, 0, 0];
  if (isPhysicalRight) {
    adjustedPos[0] = -adjustedPos[0]; // Flip X position
    adjustedRot[1] = -adjustedRot[1]; // Flip Y rotation (Yaw)
    adjustedRot[2] = -adjustedRot[2]; // Flip Z rotation (Roll)
  }

  if (!clonedScene) return null;

  return (
    <group ref={groupRef}>
      {/* Invisible Arm Occluder: hides the back of the watch strap so it doesn't render over the arm */}
      {/* Squashed into an ellipse (scale Z = 0.6) to match the natural shape of a wrist */}
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

      {/* Visible Wrist Point (Helper) to point out exactly where the wrist landmark is */}
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

      <group position={adjustedPos} rotation={adjustedRot} scale={[modelScale || 1, modelScale || 1, modelScale || 1]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
};

const RingMesh = ({ landmarksRef, modelPos, modelRot, modelScale, activeModel, showMesh, customMaterials }) => {
  const { scene } = useGLTF(activeModel?.glbPath || '');
  const groupRef = useRef();

  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 21 || !activeModel) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    if (groupRef.current) groupRef.current.visible = true;

    const { viewport } = state;
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
        -lm.z * (viewport.width * scaleX)
      );
    };

    const p0 = getMapped(0);
    const p5 = getMapped(5);
    const p13 = getMapped(13); // Ring finger base
    const p14 = getMapped(14); // Ring finger first joint
    const p17 = getMapped(17);

    // Forward vector is exactly along the ring finger bone (from base to first joint)
    const vForward = new THREE.Vector3().subVectors(p14, p13).normalize();

    // Stable palm normal to anchor the rotation
    const vPinky = new THREE.Vector3().subVectors(p17, p0).normalize();
    const vIndex = new THREE.Vector3().subVectors(p5, p0).normalize();
    const palmNormal = new THREE.Vector3().crossVectors(vPinky, vIndex).normalize();

    // MediaPipe unmirrored mode: label 'Right' means physical Right hand.
    const isPhysicalRight = landmarks.handedness?.label === 'Right';
    if (isPhysicalRight) {
      palmNormal.negate(); // Now palmNormal ALWAYS points out of the back of the hand (+Z)
    }

    // Right vector is perpendicular to palm normal and finger bone
    const vRight = new THREE.Vector3().crossVectors(palmNormal, vForward).normalize();

    // Up vector is perpendicular to forward and right
    const vUp = new THREE.Vector3().crossVectors(vForward, vRight).normalize();

    // Basis: 
    // X -> vRight (across knuckles)
    // Y -> vUp (out of palm) - Gem points here
    // Z -> vForward (along the finger) - Hole points here
    const rotationMatrix = new THREE.Matrix4().makeBasis(vRight, vUp, vForward);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

    // Target position is near the base of the ring finger (knuckle) instead of halfway
    const targetPos = new THREE.Vector3().lerpVectors(p13, p14, 0.15);

    // Scale based on the width of the finger
    // We use a small multiplier because ring models are typically quite large.
    const segmentLength = p13.distanceTo(p14);
    const finalScale = segmentLength * 0.2; // Physical scale for finger tracking (occluder)

    if (groupRef.current.scale.x === 1) {
      groupRef.current.position.copy(targetPos);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale, finalScale);
    } else {
      // Forcefully snap to the finger to prevent free-floating detaching
      const posLerp = 0.7;
      const rotLerp = 0.6;

      const currentScale = groupRef.current.scale.x;
      const scaleLerp = 0.5;

      groupRef.current.position.lerp(targetPos, posLerp);
      groupRef.current.quaternion.slerp(targetQuat, rotLerp);
      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), scaleLerp);
    }
  });

  // Mirror tuning parameters anatomically for the physical right hand
  const isPhysicalRight = landmarksRef.current?.handedness?.label === 'Right';
  const adjustedPos = modelPos ? [...modelPos] : [0, 0, 0];
  const adjustedRot = modelRot ? [...modelRot] : [0, 0, 0];
  if (isPhysicalRight) {
    // Note: We do NOT flip X position because the 3D model geometry isn't mirrored. 
    // Any X offset used to center the ring's hole must remain the same for both hands.
    adjustedRot[1] = -adjustedRot[1]; // Flip Y rotation (Yaw)
    adjustedRot[2] = -adjustedRot[2]; // Flip Z rotation (Roll)
  }

  if (!clonedScene) return null;

  return (
    <group ref={groupRef}>
      {/* Invisible Finger Occluder: hides the back of the ring so it doesn't render over the finger */}
      <mesh renderOrder={-1} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1]}>
        {/* Precise cylinder to match finger volume (0.68 radius). Prevents sweeping cuts when the hand rotates. */}
        <cylinderGeometry args={[0.99, 0.99, 6, 32]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={true}
          polygonOffset={true}
          polygonOffsetFactor={0.1}
          polygonOffsetUnits={5}
        />
      </mesh>

      {showMesh && (
        <mesh>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color="#fbbf24" transparent={true} opacity={0.8} depthTest={false} />
        </mesh>
      )}

      <group position={adjustedPos} rotation={adjustedRot} scale={[modelScale || 1, modelScale || 1, modelScale || 1]}>
        <Center>
          <primitive object={clonedScene} />
        </Center>
      </group>
    </group>
  );
};

const Scene3D = ({ landmarksRef, poseLandmarksRef, videoFrameRef, showFaceMesh, modelPos, modelRot, modelScale, activeModel, isHandTracking, category, customMaterials }) => {
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

  return (
    <div className="canvas-container" style={{ position: 'relative' }}>
      <Canvas gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} orthographic camera={{ zoom: 150, position: [0, 0, 100] }}>
        <VideoBackground videoFrameRef={videoFrameRef} />
        <DynamicLighting videoFrameRef={videoFrameRef} />
        <Environment preset="city" />

        <TrackingStatus landmarksRef={landmarksRef} isHandTracking={isHandTracking} category={category} />

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
                    modelScale={modelScale}
                    activeModel={activeModel}
                    showMesh={showFaceMesh}
                    customMaterials={customMaterials}
                  />
                ) : (
                  <WristMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    modelScale={modelScale}
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
            {/* Face mesh depth occluder — needed for eyewear and necklace */}
            {(isEyewear || isNecklace) && (
              <FullFaceMesh landmarksRef={landmarksRef} showFaceMesh={isEyewear && showFaceMesh} sharedState={sharedState} />
            )}

            <ModelErrorBoundary resetKey={`${category}-${activeModel?.id}`}>
              <Suspense fallback={<Loader />}>
                {modelReady && (category === 'earrings' ? (
                  <EarringMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    modelScale={modelScale}
                    sharedState={sharedState}
                    activeModel={activeModel}
                    customMaterials={customMaterials}
                  />
                ) : category === 'nosepin' ? (
                  <NosePinMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    modelScale={modelScale}
                    sharedState={sharedState}
                    activeModel={activeModel}
                    customMaterials={customMaterials}
                  />
                ) : category === 'eyewear' ? (
                  <EyewearMesh
                    key={activeModel?.id}
                    landmarksRef={landmarksRef}
                    modelPos={modelPos}
                    modelRot={modelRot}
                    modelScale={modelScale}
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
                    activeModel={activeModel}
                    showFaceMesh={showFaceMesh}
                    customMaterials={customMaterials}
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

