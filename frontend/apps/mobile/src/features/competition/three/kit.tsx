import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber/native";
import * as THREE from "three";

export interface CameraCfg {
  position: [number, number, number];
  fov?: number;
  near?: number;
  far?: number;
  target?: [number, number, number];
}

// Aligns the R3F camera with a fixed look-at target so it matches the JS-side
// projector used to place tappable labels over 3D objects.
function CameraRig({ target }: { target: [number, number, number] }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(new THREE.Vector3(...target));
    camera.updateProjectionMatrix();
  });
  return null;
}

export function GameCanvas({
  children,
  camera,
  background = "#0d1030",
}: {
  children: React.ReactNode;
  camera: CameraCfg;
  background?: string;
}) {
  return (
    <Canvas
      style={{ flex: 1 }}
      camera={{
        position: camera.position,
        fov: camera.fov ?? 55,
        near: camera.near ?? 0.1,
        far: camera.far ?? 1000,
      }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color(background);
      }}
    >
      <CameraRig target={camera.target ?? [0, 0, 0]} />
      <hemisphereLight args={["#bcd0ff", "#20223a", 0.9]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 12, 6]} intensity={1.4} />
      <directionalLight position={[-8, 6, -4]} intensity={0.5} color="#8ab4ff" />
      {children}
    </Canvas>
  );
}

// Builds a pure-JS projector matching the scene camera; maps world coords to
// on-screen pixels so we can lay RN <Pressable> labels exactly over 3D meshes.
export function createProjector(
  camera: CameraCfg,
  size: { width: number; height: number }
) {
  const cam = new THREE.PerspectiveCamera(
    camera.fov ?? 55,
    size.height > 0 ? size.width / size.height : 1,
    camera.near ?? 0.1,
    camera.far ?? 1000
  );
  cam.position.set(...camera.position);
  cam.lookAt(new THREE.Vector3(...(camera.target ?? [0, 0, 0])));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(cam);
    return {
      x: (v.x * 0.5 + 0.5) * size.width,
      y: (-v.y * 0.5 + 0.5) * size.height,
      visible: v.z < 1,
    };
  };
}

interface Bit {
  vel: THREE.Vector3;
}

// Short-lived shard burst for explosions / pops.
export function Explosion({
  position = [0, 0, 0],
  color = "#ffd166",
  count = 12,
  onDone,
}: {
  position?: [number, number, number];
  color?: string;
  count?: number;
  onDone?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const life = useRef(0);
  const bits = useMemo<Bit[]>(
    () =>
      Array.from({ length: count }).map(() => ({
        vel: new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        )
          .normalize()
          .multiplyScalar(2.4 + Math.random() * 2.2),
      })),
    [count]
  );

  useFrame((_, dt) => {
    life.current += dt;
    const g = group.current;
    if (!g) return;
    const t = life.current;
    g.children.forEach((child, i) => {
      const b = bits[i];
      child.position.x += b.vel.x * dt;
      child.position.y += (b.vel.y - t * 5) * dt;
      child.position.z += b.vel.z * dt;
      child.rotation.x += dt * 6;
      child.scale.setScalar(Math.max(0, 1 - t / 0.7) * 0.26);
    });
    if (t > 0.72 && onDone) onDone();
  });

  return (
    <group ref={group} position={position}>
      {bits.map((_, i) => (
        <mesh key={i}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}
