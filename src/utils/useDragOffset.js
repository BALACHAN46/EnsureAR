import { useRef, useCallback, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Lets an end user click/touch-drag a tracked AR model (earring, nosepin,
 * eyewear, ring, watch, necklace...) left/right & up/down on screen to
 * nudge it away from its auto-tracked position, on top of the admin's
 * base modelPos tuning rather than replacing it.
 *
 * The drag happens on a plane facing the camera through the model's current
 * world position, so the resulting offset is pure screen-plane X/Y (three.js
 * world units) - callers just add `offsetRef.current` onto whatever target
 * position they already compute each frame, before lerping/copying it onto
 * the group. Bump `resetSignal` (e.g. a counter) to snap the offset back to
 * zero - used by the UI's "Reset Position" button.
 */
export function useDragOffset(groupRef, resetSignal) {
  const { camera, gl } = useThree();
  const offsetRef = useRef(new THREE.Vector3());
  const dragStateRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  useEffect(() => {
    offsetRef.current.set(0, 0, 0);
  }, [resetSignal]);

  const pointerToWorld = useCallback((clientX, clientY, plane) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const point = new THREE.Vector3();
    raycasterRef.current.ray.intersectPlane(plane, point);
    return point;
  }, [camera, gl]);

  const onPointerOver = useCallback((e) => {
    e.stopPropagation();
    if (!dragStateRef.current) gl.domElement.style.cursor = 'move';
  }, [gl]);

  const onPointerOut = useCallback(() => {
    if (!dragStateRef.current) gl.domElement.style.cursor = 'auto';
  }, [gl]);

  const onPointerDown = useCallback((e) => {
    if (!groupRef.current) return;
    e.stopPropagation();
    const native = e.nativeEvent || e;

    const worldPos = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPos);

    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPos);

    const startWorld = pointerToWorld(native.clientX, native.clientY, plane);
    const startOffset = offsetRef.current.clone();
    dragStateRef.current = { plane, startWorld, startOffset };
    gl.domElement.style.cursor = 'move';

    const handleMove = (ev) => {
      if (!dragStateRef.current) return;
      const currentWorld = pointerToWorld(ev.clientX, ev.clientY, dragStateRef.current.plane);
      const delta = currentWorld.clone().sub(dragStateRef.current.startWorld);
      offsetRef.current.copy(dragStateRef.current.startOffset).add(delta);
    };
    const handleUp = () => {
      dragStateRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [camera, gl, groupRef, pointerToWorld]);

  const dragHandlers = { onPointerOver, onPointerOut, onPointerDown };

  return { offsetRef, dragHandlers };
}
