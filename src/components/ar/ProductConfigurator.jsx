import React, { Suspense, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment, Center, Bounds, useGLTF, useTexture, Html, useProgress } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import * as THREE from 'three';
import ModelErrorBoundary from './ModelErrorBoundary';

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

function GlbModel({ path }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => (scene ? scene.clone() : null), [scene]);
  if (!cloned) return null;
  return <primitive object={cloned} />;
}

function ObjModelWithMtl({ path, mtlPath }) {
  const materials = useLoader(MTLLoader, mtlPath);
  const obj = useLoader(OBJLoader, path, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  const cloned = useMemo(() => (obj ? obj.clone() : null), [obj]);
  if (!cloned) return null;
  return <primitive object={cloned} />;
}

function ObjModelPlain({ path }) {
  const obj = useLoader(OBJLoader, path);
  const cloned = useMemo(() => (obj ? obj.clone() : null), [obj]);
  if (!cloned) return null;
  return <primitive object={cloned} />;
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

function ModelSwitch({ activeModel }) {
  const path = activeModel?.glbPath || '';
  const ext = path.split('.').pop()?.toLowerCase();

  if (ext === 'obj') {
    return activeModel.mtlPath
      ? <ObjModelWithMtl path={path} mtlPath={activeModel.mtlPath} />
      : <ObjModelPlain path={path} />;
  }
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    return <ImageModel path={path} />;
  }
  return <GlbModel path={path} />;
}

/**
 * Standalone product viewer: no webcam, no body/hand/face tracking.
 * Auto-fits the camera to whatever the model's raw scale happens to be
 * via drei's <Bounds>, since catalog models aren't normalized to a
 * common real-world size the way the AR try-on placement math expects.
 */
export default function ProductConfigurator({ activeModel, autoRotate }) {
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
                <ModelSwitch activeModel={activeModel} />
              </Center>
            </Bounds>
          </Suspense>
        </ModelErrorBoundary>

        <OrbitControls
          makeDefault
          enablePan={false}
          autoRotate={autoRotate}
          autoRotateSpeed={2.2}
          minDistance={0.8}
          maxDistance={12}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
}
