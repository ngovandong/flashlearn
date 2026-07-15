import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Shared <Canvas> wrapper: sensible lighting rig, fog, tone mapping and a
// clamped device-pixel-ratio so it stays smooth on laptops and phones alike.
export function GameCanvas({
  children,
  camera = { position: [0, 4, 9], fov: 55 },
  background = "#0d1030",
  fog,
  lookAt,
  className = "cmp-canvas",
}) {
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={camera}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ scene, gl, camera: cam }) => {
        scene.background = new THREE.Color(background);
        if (fog) scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
        if (lookAt) {
          cam.lookAt(new THREE.Vector3(...lookAt));
          cam.updateProjectionMatrix();
        }
        gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <hemisphereLight args={["#bcd0ff", "#20223a", 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 12, 6]} intensity={1.5} castShadow />
      <directionalLight position={[-8, 6, -4]} intensity={0.5} color="#8ab4ff" />
      {children}
    </Canvas>
  );
}

// A short-lived shard burst used for explosions / pops. Animates outward with a
// little gravity, scales/fades out, then calls onDone so the host can drop it.
export function Explosion({ position = [0, 0, 0], color = "#ffd166", count = 14, onDone }) {
  const group = useRef();
  const life = useRef(0);
  const bits = useMemo(
    () =>
      Array.from({ length: count }).map(() => {
        const dir = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        )
          .normalize()
          .multiplyScalar(2.4 + Math.random() * 2.4);
        return { vel: dir, rot: Math.random() * Math.PI };
      }),
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
      child.rotation.y += dt * 6;
      const s = Math.max(0, 1 - t / 0.7);
      child.scale.setScalar(s * 0.28);
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

// Smoothly ease a numeric ref toward a target inside useFrame.
export function damp(current, target, lambda, dt) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}
