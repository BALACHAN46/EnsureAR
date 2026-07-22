import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Center } from '@react-three/drei';
import * as THREE from 'three';
import { applyAndExtractMaterials } from '../../utils/materialHelper';
import { JewelrySparkles } from './NecklaceMesh';

/**
 * RingMesh — Anatomically Accurate Ring AR Tracking
 * ─────────────────────────────────────────────────────────────────────
 * Features:
 * - Robust Viewport Mapping handles mirror feeds, distinct aspect ratios, and custom zooms natively.
 * - Dynamic Scale matches the physical pixel distance between MCP (base) and PIP (middle) knuckle.
 * - Stable Orthogonal Basis: X (Left/Right), Y (Along Finger), Z (Out of back of hand).
 * - Chirality Aware: MediaPipe mirrored outputs are converted gracefully so the gem always sits on the back of the hand.
 * - Precision Occlusion: An invisible cylinder precisely centered hides the back-band when viewing the palm, and hides the gem when viewing the back of the hand, without side-clipping.
 * ─────────────────────────────────────────────────────────────────────
 */
const RingMesh = ({ landmarksRef, modelPos, modelRot, modelScale, modelSparkles, activeModel, showMesh, customMaterials, ringTuning }) => {
  const { scene } = useGLTF(activeModel?.glbPath || '');
  const groupRef = useRef();
  const innerGroupRef = useRef();
  const occluderRef = useRef();

  // Apply real-time custom material tuning from the UI
  const { clonedScene } = React.useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  // Fix Z-fighting for complex meshes when rendered near the occlusion cylinder
  React.useEffect(() => {
    if (clonedScene) {
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          child.renderOrder = 1;
        }
      });
    }
  }, [clonedScene]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length < 21 || !activeModel) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    if (groupRef.current) groupRef.current.visible = true;

    // 1. Robust Viewport Mapping (Handles scaling correctly regardless of camera resolution vs window resolution)
    const { viewport } = state;
    const videoNode = document.querySelector('.webcam-video');
    const videoAspect = (videoNode && videoNode.videoHeight) ? (videoNode.videoWidth / videoNode.videoHeight) : (16 / 9);
    const containerAspect = viewport.width / viewport.height;
    let scaleX = 1; let scaleY = 1;
    if (containerAspect > videoAspect) {
      scaleY = containerAspect / videoAspect;
    } else {
      scaleX = videoAspect / containerAspect;
    }

    const getMapped = (index) => {
      const lm = landmarks[index];
      // MediaPipe uses top-left origin. Three uses center origin with Y-up.
      return new THREE.Vector3(
        -(lm.x - 0.5) * (viewport.width * scaleX),
        -(lm.y - 0.5) * (viewport.height * scaleY),
        -lm.z * (viewport.width * scaleX)
      );
    };

    const p0 = getMapped(0);   // Wrist
    const p5 = getMapped(5);   // Index base
    const p13 = getMapped(13); // Ring MCP (Base)
    const p14 = getMapped(14); // Ring PIP (Middle Knuckle)
    const p17 = getMapped(17); // Pinky base

    // Target position: Sit slightly above the base knuckle for a natural look
    const targetPos = new THREE.Vector3().lerpVectors(p13, p14, 0.25);

    // 2. Stable Orientation Logic
    // Vector pointing along the finger
    const vForward = new THREE.Vector3().subVectors(p14, p13).normalize();

    // Cross product of Pinky and Index to get Palm Normal
    const vPinky = new THREE.Vector3().subVectors(p17, p0).normalize();
    const vIndex = new THREE.Vector3().subVectors(p5, p0).normalize();
    const palmNormal = new THREE.Vector3().crossVectors(vPinky, vIndex).normalize();

    // Handling Mirrored Chirality:
    // When the webcam feed is unmirrored but displayed mirrored (typical selfie AR setup),
    // a physical Right hand appears on the left, which MediaPipe identifies as 'Left'.
    // The cross product math above points OUT of the back of the hand for a physical Right hand.
    // For a physical Left hand (identified as 'Right'), it points OUT of the palm, so we must negate it.
    if (landmarks.handedness?.label === 'Right') {
      palmNormal.negate();
    }

    // Orthogonal Basis aligned with finger
    // AVOID GIMBAL LOCK: 
    // When you make a fist, the finger bone (vForward) points at the camera, becoming parallel to palmNormal!
    // Instead, we use the knuckle line (Index to Pinky) which is ALWAYS perpendicular to the finger bone!
    const isPhysicalRightHand = landmarks.handedness?.label === 'Right';
    const vRightBase = new THREE.Vector3();
    if (isPhysicalRightHand) {
      vRightBase.subVectors(p5, p17).normalize(); // Points Screen Right
    } else {
      vRightBase.subVectors(p17, p5).normalize(); // Points Screen Right
    }

    // Now construct the perfectly orthogonal matrix safely
    const vBack = new THREE.Vector3().crossVectors(vRightBase, vForward).normalize();
    const vRight = new THREE.Vector3().crossVectors(vForward, vBack).normalize();

    // Construct the rotation matrix: X -> vRight, Y -> vForward, Z -> vBack
    const rotationMatrix = new THREE.Matrix4().makeBasis(vRight, vForward, vBack);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);

    // Anatomical tracking correction:
    // We use palmNormal.z because the palm triangle (wrist, index, pinky) NEVER collapses in a fist!
    const isBackOfHandVisible = palmNormal.z < 0;
    const fingerLength = p13.distanceTo(p14);

    // Dynamic UI Tuning or fallbacks
    const rightHandFrontOffset = ringTuning?.rightHandFrontOffset ?? -0.05;
    const rightHandBackOffset = ringTuning?.rightHandBackOffset ?? 0.00;
    const leftHandFrontOffset = ringTuning?.leftHandFrontOffset ?? -0.06;
    const leftHandBackOffset = ringTuning?.leftHandBackOffset ?? -0.06;

    let currentOffset = 0;
    if (isPhysicalRightHand) {
      currentOffset = isBackOfHandVisible ? rightHandBackOffset : rightHandFrontOffset;
    } else {
      currentOffset = isBackOfHandVisible ? leftHandBackOffset : leftHandFrontOffset;
    }

    targetPos.addScaledVector(vRight, fingerLength * currentOffset);

    // Most GLB rings place the gemstone at +Z.
    // Flipping 180 on Y ensures the gemstone properly sits on the back of the hand (instead of the palm).
    const flipQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    targetQuat.multiply(flipQuat);

    // 3. Dynamic Biological Scale
    const frontScale = ringTuning?.frontScale ?? 0.23;
    const backScale = ringTuning?.backScale ?? 0.20;

    const baseScale = isBackOfHandVisible ? backScale : frontScale;
    const finalScale = fingerLength * baseScale;

    // Apply Transformations with Smooth Interpolation to remove hand micro-jitters
    if (groupRef.current.scale.x === 1) {
      groupRef.current.position.copy(targetPos);
      groupRef.current.quaternion.copy(targetQuat);
      groupRef.current.scale.set(finalScale, finalScale, finalScale);
    } else {
      // DYNAMIC INTERPOLATION: The secret to NO jitter AND FAST movement.
      // We calculate how much the hand moved relative to the finger size.
      const dist = groupRef.current.position.distanceTo(targetPos);
      const normalizedDist = dist / fingerLength;

      // If movement is tiny (jitter), use low lerp (0.1) for smoothness. 
      // If movement is large (fast hand movement), scale it up to 0.75 for instant speed.
      const adaptiveLerp = Math.min(Math.max(0.1 + (normalizedDist * 1.5), 0.1), 0.75);

      groupRef.current.position.lerp(targetPos, adaptiveLerp);
      groupRef.current.quaternion.slerp(targetQuat, adaptiveLerp * 0.8);
      groupRef.current.scale.lerp(new THREE.Vector3(finalScale, finalScale, finalScale), 0.3);
    }

    // Dynamic inner group offset & handedness rotation (computed every frame inside useFrame)
    if (innerGroupRef.current) {
      const posX = -(modelPos?.[0] ?? 0);
      const posY = modelPos?.[1] ?? 0;
      const posZ = -(modelPos?.[2] ?? 0);
      innerGroupRef.current.position.set(posX, posY, posZ);

      const rotX = modelRot?.[0] ?? 0;
      let rotY = modelRot?.[1] ?? 0;
      let rotZ = modelRot?.[2] ?? 0;

      if (isPhysicalRightHand) {
        rotY = -rotY;
        rotZ = -rotZ;
      }
      innerGroupRef.current.rotation.set(rotX, rotY, rotZ);
    }

    // 4. Professional Occlusion Masking
    if (occluderRef.current) {
      const currentScale = groupRef.current.scale.x || finalScale;
      const localHeight = fingerLength / currentScale;

      // To flawlessly hide the back band without swallowing the front, 
      // we shape the occluder into an anatomical ellipse (wide X, flat Z).
      const localRadiusX = localHeight * 0.35;
      const localRadiusZ = localHeight * 0.15;

      // Perfect Center Alignment (Y=0, Z=0)
      occluderRef.current.scale.set(localRadiusX, localHeight, localRadiusZ);
      occluderRef.current.position.set(0, 0, 0);
    }
  });

  if (!clonedScene) return null;

  return (
    <group ref={groupRef}>
      {/* Occlusion Masking: The invisible finger cylinder that flawlessly tracks the physical finger anatomy */}
      <mesh ref={occluderRef} renderOrder={-1}>
        {/* Made the cylinder much taller (height 5) to block protruding gemstones when the finger is tilted! */}
        <cylinderGeometry args={[0.95, 0.95, 5, 32]} />
        <meshBasicMaterial colorWrite={false} depthWrite={true} />
      </mesh>

      {/* Apply user tuning position and rotation dynamically inside useFrame */}
      <group ref={innerGroupRef}>
        {/* Development Debug Mesh */}
        {showMesh && (
          <mesh>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#fbbf24" transparent={true} opacity={0.8} depthTest={false} />
          </mesh>
        )}

        {/* The 3D Ring */}
        <group scale={[modelScale || 1, modelScale || 1, modelScale || 1]}>
          <Center>
            <primitive object={clonedScene} />
            {modelSparkles && <JewelrySparkles count={50} isPlane={false} modelScene={clonedScene} />}
          </Center>
        </group>

      </group>
    </group>
  );
};

export default RingMesh;
