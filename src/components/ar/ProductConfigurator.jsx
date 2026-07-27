import React, { Suspense, useMemo, useEffect, useState } from 'react';
import { Canvas, useLoader, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Center, Bounds, useGLTF, useTexture, Html, useProgress } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';
import ModelErrorBoundary from './ModelErrorBoundary';
import { applyAndExtractMaterials } from '../../utils/materialHelper';

const Loader = () => {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="configurator-loader">
        <div className="configurator-loader-spinner" />
        Loading model… {progress.toFixed(0)}%
      </div>
    </Html>
  );
};

function GlbModel({ path, customMaterials, onMeshesLoaded }) {
  const { scene } = useGLTF(path);
  
  const { clonedScene, availableMeshes } = useMemo(() => {
    return applyAndExtractMaterials(scene, customMaterials);
  }, [scene, customMaterials]);

  useEffect(() => {
    if (onMeshesLoaded && availableMeshes) {
      onMeshesLoaded(availableMeshes);
    }
  }, [availableMeshes, onMeshesLoaded]);

  if (!clonedScene) return null;
  return <primitive object={clonedScene} />;
}

function ObjModelWithMtl({ path, mtlPath, customMaterials, onMeshesLoaded }) {
  const materials = useLoader(MTLLoader, mtlPath);
  const obj = useLoader(OBJLoader, path, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  
  const { clonedScene, availableMeshes } = useMemo(() => {
    return applyAndExtractMaterials(obj, customMaterials);
  }, [obj, customMaterials]);

  useEffect(() => {
    if (onMeshesLoaded && availableMeshes) {
      onMeshesLoaded(availableMeshes);
    }
  }, [availableMeshes, onMeshesLoaded]);

  if (!clonedScene) return null;
  return <primitive object={clonedScene} />;
}

function ObjModelPlain({ path, customMaterials, onMeshesLoaded }) {
  const obj = useLoader(OBJLoader, path);
  
  const { clonedScene, availableMeshes } = useMemo(() => {
    return applyAndExtractMaterials(obj, customMaterials);
  }, [obj, customMaterials]);

  useEffect(() => {
    if (onMeshesLoaded && availableMeshes) {
      onMeshesLoaded(availableMeshes);
    }
  }, [availableMeshes, onMeshesLoaded]);

  if (!clonedScene) return null;
  return <primitive object={clonedScene} />;
}

function ImageModel({ path }) {
  const texture = useTexture(path);
  const aspect = texture.image ? texture.image.width / texture.image.height : 1;
  return (
    <mesh>
      <planeGeometry args={[aspect * 2.4, 2.4]} />
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

function ModelSwitch({ activeModel, customMaterials, onMeshesLoaded }) {
  const path = activeModel?.glbPath || '';
  const ext = path.split('.').pop()?.toLowerCase();

  if (ext === 'obj') {
    return activeModel.mtlPath
      ? <ObjModelWithMtl path={path} mtlPath={activeModel.mtlPath} customMaterials={customMaterials} onMeshesLoaded={onMeshesLoaded} />
      : <ObjModelPlain path={path} customMaterials={customMaterials} onMeshesLoaded={onMeshesLoaded} />;
  }
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return <ImageModel path={path} />;
  }
  return <GlbModel path={path} customMaterials={customMaterials} onMeshesLoaded={onMeshesLoaded} />;
}

function CameraRig({ cameraView }) {
  const { camera, controls } = useThree();
  const [targetPos, setTargetPos] = useState(null);

  useEffect(() => {
    if (!cameraView || !controls) {
      setTargetPos(null);
      return;
    }
    
    // Determine distance based on the CURRENT camera position (fitted by Bounds)
    const d = camera.position.distanceTo(controls.target);
    const newPos = new THREE.Vector3();
    
    switch (cameraView) {
      case 'front': newPos.set(0, 0, d); break;
      case 'back': newPos.set(0, 0, -d); break;
      case 'left': newPos.set(-d, 0, 0); break;
      case 'right': newPos.set(d, 0, 0); break;
      case 'top': newPos.set(0, d, 0.1); break; // 0.1 to avoid gimbal lock
      case 'reset': newPos.set(d * 0.7, d * 0.5, d * 0.7); break;
      default: newPos.set(0, 0, d); break;
    }
    
    // Add the target offset in case OrbitControls is looking away from origin
    newPos.add(controls.target);
    setTargetPos(newPos);
  }, [cameraView, camera, controls]);

  useFrame(() => {
    if (targetPos && controls) {
      if (camera.position.distanceTo(targetPos) > 0.05) {
        camera.position.lerp(targetPos, 0.08);
        controls.update();
      }
    }
  });

  return null;
}

/**
 * Standalone product viewer: no webcam, no body/hand/face tracking.
 * Auto-fits the camera to whatever the model's raw scale happens to be
 * via drei's <Bounds>, since catalog models aren't normalized to a
 * common real-world size the way the AR try-on placement math expects.
 */
export default function ProductConfigurator({ activeModel, autoRotate, customMaterials, onMeshesLoaded, cameraView }) {
  if (!activeModel) return null;

  return (
    <div className="configurator-canvas-wrap">
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]}>
        <color attach="background" args={['#070b16']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 6, 5]} intensity={1.2} />
        <directionalLight position={[-4, -2, -5]} intensity={0.4} />
        <Environment preset="studio" />

        <ModelErrorBoundary resetKey={activeModel.id}>
          <Suspense fallback={<Loader />}>
            <Bounds key={activeModel.id} fit clip observe margin={1.4}>
              <Center>
                <ModelSwitch 
                  activeModel={activeModel} 
                  customMaterials={customMaterials}
                  onMeshesLoaded={onMeshesLoaded} 
                />
              </Center>
            </Bounds>
          </Suspense>
        </ModelErrorBoundary>

        <OrbitControls
          makeDefault
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={2.2}
          minDistance={0.05}
          maxDistance={12}
          enableDamping
          dampingFactor={0.08}
        />
        <CameraRig cameraView={cameraView} />
      </Canvas>
    </div>
  );
}
