import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import {
  applyAnswer,
  buildMcqQuestions,
  comboMultiplier,
  initialComboState,
  shuffleArray,
} from "@flashlearn/core";
import { GameCanvas, Explosion } from "../three/kit";

const LIVES = 3;
const WAVE = 4;
const TOP = 6.5;
const GROUND = 0.6;
const SPACING_MS = 300;
const EGG_COLORS = ["#ff9aa2", "#a0e7e5", "#ffd6a5", "#b5b9ff", "#caffbf"];

function fallSeconds(round) {
  return Math.max(3.4, 6.4 - round * 0.28);
}

let eggSeq = 0;
let boomSeq = 0;

function FallingEgg({ egg, onShoot }) {
  const group = useRef();
  const start = egg.bornAt + egg.delay;

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = (performance.now() - start) / (egg.duration * 1000);
    if (t < 0) {
      g.scale.setScalar(0);
      return;
    }
    g.scale.setScalar(1);
    g.position.y = TOP - Math.min(1, t) * (TOP - GROUND);
    g.position.x = egg.x + Math.sin(state.clock.elapsedTime * 2 + egg.id) * 0.25;
    g.rotation.z = Math.sin(state.clock.elapsedTime * 3 + egg.id) * 0.15;
  });

  return (
    <group ref={group} position={[egg.x, TOP, egg.z]}>
      <mesh
        scale={[0.9, 1.2, 0.9]}
        onClick={(e) => {
          e.stopPropagation();
          onShoot(egg);
        }}
        onPointerOver={() => (document.body.style.cursor = "crosshair")}
        onPointerOut={() => (document.body.style.cursor = "auto")}
      >
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshStandardMaterial
          color={egg.color}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      <Billboard position={[0, 2.1, 0]}>
        <Text
          fontSize={0.92}
          color="#fff"
          anchorX="center"
          outlineWidth={0.06}
          outlineColor="#1a1030"
        >
          {egg.word}
        </Text>
      </Billboard>
    </group>
  );
}

function BlasterScene({ eggs, booms, onShoot, onBoomDone }) {
  return (
    <>
      <fog attach="fog" args={["#140a2e", 14, 40]} />
      {/* starfield backdrop */}
      <Stars />
      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#20124a" roughness={1} />
      </mesh>
      {/* cannon */}
      <mesh position={[0, 0.4, 6]} rotation={[-Math.PI / 8, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.55, 1.6, 20]} />
        <meshStandardMaterial color="#5b6bff" metalness={0.6} roughness={0.3} />
      </mesh>
      {eggs.map((egg) => (
        <FallingEgg key={egg.id} egg={egg} onShoot={onShoot} />
      ))}
      {booms.map((b) => (
        <Explosion
          key={b.id}
          position={[b.x, b.y, b.z]}
          color={b.color}
          onDone={() => onBoomDone(b.id)}
        />
      ))}
    </>
  );
}

function Stars() {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = Math.random() * 20 + 4;
      arr[i * 3 + 2] = -10 - Math.random() * 30;
    }
    return arr;
  }, []);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.14} sizeAttenuation transparent opacity={0.8} />
    </points>
  );
}

// Meaning Blaster — word-eggs rain from space; blast the one matching the clue.
export default function Blaster({ pool, sound, onScoreChange, onGameOver }) {
  const deck = useMemo(() => buildMcqQuestions(pool.terms), [pool]);

  const [round, setRound] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [lives, setLives] = useState(LIVES);
  const [eggs, setEggs] = useState([]);
  const [booms, setBooms] = useState([]);
  const [flash, setFlash] = useState(false);

  const resolvedRef = useRef(false);
  const livesRef = useRef(LIVES);
  const comboRef = useRef(initialComboState());
  const missTimer = useRef(null);

  const question = deck[round % (deck.length || 1)];

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);
  useEffect(() => () => clearTimeout(missTimer.current), []);

  useEffect(() => {
    if (!question) return undefined;
    resolvedRef.current = false;
    const duration = fallSeconds(round);
    const words = shuffleArray(question.options.slice(0, WAVE));
    const bornAt = performance.now();
    let targetDelay = 0;
    const wave = words.map((word, i) => {
      const delay = i * SPACING_MS;
      const isTarget = word === question.answer;
      if (isTarget) targetDelay = delay;
      return {
        id: ++eggSeq,
        word,
        isTarget,
        x: -5 + i * (10 / (WAVE - 1)) + (Math.random() * 1 - 0.5),
        z: -0.5 + Math.random() * 2,
        delay,
        bornAt,
        duration: duration + (Math.random() * 0.7 - 0.35),
        color: EGG_COLORS[i % EGG_COLORS.length],
      };
    });
    setEggs(wave);
    missTimer.current = setTimeout(
      () => miss(),
      targetDelay + duration * 1000 + 250
    );
    return () => clearTimeout(missTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, question]);

  const nextRound = () => setTimeout(() => setRound((r) => r + 1), 520);

  const spawnBoom = (egg) => {
    const t = Math.min(
      1,
      Math.max(0, (performance.now() - (egg.bornAt + egg.delay)) / (egg.duration * 1000))
    );
    const y = TOP - t * (TOP - GROUND);
    const id = ++boomSeq;
    setBooms((list) => [...list, { id, x: egg.x, y, z: egg.z, color: egg.color }]);
  };

  const removeBoom = (id) => setBooms((list) => list.filter((b) => b.id !== id));

  const miss = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearTimeout(missTimer.current);
    comboRef.current = applyAnswer(comboRef.current, false);
    setCombo(comboRef.current);
    setFlash(true);
    setTimeout(() => setFlash(false), 380);
    sound.playWrong();
    livesRef.current -= 1;
    setLives(livesRef.current);
    if (livesRef.current <= 0) onGameOver(comboRef.current.score);
    else nextRound();
  };

  const shoot = (egg) => {
    sound.playShoot();
    spawnBoom(egg);
    setFlash(false);
    if (egg.isTarget) {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      clearTimeout(missTimer.current);
      comboRef.current = applyAnswer(comboRef.current, true);
      setCombo(comboRef.current);
      sound.playExplode();
      const mult = comboMultiplier(comboRef.current.streak);
      if (mult > 1) sound.playCombo(mult);
      sound.say(egg.word);
      setEggs((list) => list.filter((e) => e.id !== egg.id));
      nextRound();
    } else {
      sound.playExplode();
      setEggs((list) => list.filter((e) => e.id !== egg.id));
    }
  };

  const mult = comboMultiplier(combo.streak);

  return (
    <div className={`cmp-3d${flash ? " cmp-3d--hit" : ""}`}>
      <div className="cmp-3d__scene">
        <GameCanvas
          background="#140a2e"
          camera={{ position: [0, 3, 10], fov: 50 }}
          lookAt={[0, 3.2, 0]}
        >
          <BlasterScene
            eggs={eggs}
            booms={booms}
            onShoot={shoot}
            onBoomDone={removeBoom}
          />
        </GameCanvas>
        <span className="cmp-crosshair" />
      </div>

      <div className="cmp-blaster__hud cmp-blaster__hud--overlay">
        {combo.streak >= 3 && (
          <span className="cmp-blaster__combo">x{mult} combo</span>
        )}
        <span className="cmp-blaster__lives">
          {"❤️".repeat(lives)}
          {"🤍".repeat(Math.max(0, LIVES - lives))}
        </span>
      </div>

      <div className="cmp-blaster__target cmp-blaster__target--overlay">
        <span className="cmp-blaster__label">Blast the word that means</span>
        <strong>{question?.prompt}</strong>
      </div>
    </div>
  );
}
