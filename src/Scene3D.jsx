import React, { useRef, Suspense, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, useGLTF, Html, useProgress } from '@react-three/drei';
import * as THREE from 'three';

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

      const targetX = -(lm.x - 0.5) * viewport.width;
      const targetY = -(lm.y - 0.5) * viewport.height;
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

const EyewearMesh = ({ landmarksRef, modelPos, modelRot, modelScale, sharedState, activeModel }) => {
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

  // Inject custom shader logic to beautifully fade out the temples!
  React.useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
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
  }, [scene]);

  useFrame((state) => {
    const landmarks = landmarksRef.current;
    if (!landmarks || landmarks.length === 0 || !groupRef.current) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    if (groupRef.current) groupRef.current.visible = true;

    const { viewport } = state;

    // Use the nose bridge as the exact pivot point (landmark 168 is exactly between the eyes)
    const bridge = landmarks[168];
    const anchorX = -(bridge.x - 0.5) * viewport.width;
    const anchorY = -(bridge.y - 0.5) * viewport.height;

    // Scale Z to match viewport depth dynamically
    const anchorZ = -bridge.z * viewport.width * 1.5;

    const getMapped = (index) => {
      const lm = landmarks[index];
      return {
        x: -(lm.x - 0.5) * viewport.width,
        y: -(lm.y - 0.5) * viewport.height,
        z: -lm.z * viewport.width * 1.5
      };
    };

    const leftTemple = getMapped(234);
    const rightTemple = getMapped(454);

    // --- DYNAMIC SCALE (ROTATION INDEPENDENT) ---
    // Calculate face width using a true 1:1 Z-ratio so the scale doesn't artificially inflate when the head turns!
    const rawDiffX = -(landmarks[454].x - landmarks[234].x) * viewport.width;
    const rawDiffY = -(landmarks[454].y - landmarks[234].y) * viewport.height;
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
      const posLerp = Math.min(1.0, 0.2 + (dist * 10.0));

      // Calculate rotational speed (angle is in radians)
      const angle = groupRef.current.quaternion.angleTo(targetQuat);
      const rotLerp = Math.min(1.0, 0.2 + (angle * 10.0));

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

  return (
    <group ref={groupRef}>
      <primitive
        object={scene}
        rotation={modelRot || [-Math.PI / 2, 0, Math.PI]}
        position={modelPos || [0, 0.5, 1.0]}
      />
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

  useFrame(() => {
    if (videoFrameRef.current && textureRef.current) {
      textureRef.current.image = videoFrameRef.current;
      textureRef.current.needsUpdate = true;
    }
  });

  return null;
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

const FaceStatus = ({ landmarksRef }) => {
  const [detected, setDetected] = useState(true);

  useFrame(() => {
    // Check if face data exists in the current frame
    const isDetected = landmarksRef.current && landmarksRef.current.length > 0;
    // Only trigger a React state update if the status actually changes!
    if (detected !== isDetected) {
      setDetected(isDetected);
    }
  });

  if (detected) return null;
  return (
    <Html center>
      <div style={{
        color: 'white', background: 'rgba(220,38,38,0.9)', padding: '15px 30px',
        borderRadius: '30px', fontWeight: 'bold', fontSize: '18px',
        border: '2px solid #f87171', boxShadow: '0 0 20px rgba(220, 38, 38, 0.6)',
        whiteSpace: 'nowrap'
      }}>
        ⚠️ Face Not Detected
      </div>
    </Html>
  );
};

const Scene3D = ({ landmarksRef, videoFrameRef, showFaceMesh, modelPos, modelRot, modelScale, activeModel }) => {
  // Shared state ensures the face mask and the glasses always use the EXACT same tracking speed!
  const sharedState = useRef({ adaptiveLerp: 0.5 });

  return (
    <div className="canvas-container" style={{ position: 'relative' }}>

      <Canvas orthographic camera={{ zoom: 150, position: [0, 0, 100] }}>
        <VideoBackground videoFrameRef={videoFrameRef} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <Environment preset="city" />

        <FaceStatus landmarksRef={landmarksRef} />

        <FullFaceMesh landmarksRef={landmarksRef} showFaceMesh={showFaceMesh} sharedState={sharedState} />

        <Suspense fallback={<Loader />}>
          <EyewearMesh
            landmarksRef={landmarksRef}
            modelPos={modelPos}
            modelRot={modelRot}
            modelScale={modelScale}
            sharedState={sharedState}
            activeModel={activeModel}
          />
        </Suspense>

      </Canvas>
    </div>
  );
};

export default Scene3D;
