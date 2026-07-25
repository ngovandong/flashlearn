import React, { useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { useFrame } from "@react-three/fiber/native";
import type { Group } from "three";
import {
  applyAnswer,
  buildMcqQuestions,
  comboMultiplier,
  initialComboState,
  shuffleArray,
} from "@flashlearn/core";
import type { GameProps } from "../types";
import { GameCanvas, Explosion, createProjector } from "../three/kit";

const LIVES = 3;
const WAVE = 4;
const TOP = 8;
const GROUND = 0.7;
const SPACING_MS = 300;
const EGG_COLORS = ["#ff9aa2", "#a0e7e5", "#ffd6a5", "#b5b9ff", "#caffbf"];
const CAMERA = {
  position: [0, 3.4, 12] as [number, number, number],
  fov: 55,
  target: [0, 3, 0] as [number, number, number],
};

const fallSeconds = (round: number) => Math.max(3.4, 6.4 - round * 0.28);

interface Egg {
  id: number;
  word: string;
  isTarget: boolean;
  x: number;
  z: number;
  delay: number;
  bornAt: number;
  duration: number;
  color: string;
}
interface Boom {
  id: number;
  pos: [number, number, number];
  color: string;
}

let eggSeq = 0;
let boomSeq = 0;

function Starfield() {
  const ref = useRef<Group>(null);
  const stars = useMemo(
    () =>
      Array.from({ length: 60 }).map(() => ({
        x: (Math.random() - 0.5) * 40,
        y: Math.random() * 16 + 4,
        z: -8 - Math.random() * 24,
      })),
    []
  );
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02;
  });
  return (
    <group ref={ref}>
      {stars.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

function BlasterScene({
  eggs3d,
  booms,
  onBoomDone,
}: {
  eggs3d: Array<{ id: number; pos: [number, number, number]; color: string; visible: boolean }>;
  booms: Boom[];
  onBoomDone: (id: number) => void;
}) {
  return (
    <>
      <fog attach="fog" args={["#140a2e", 14, 40]} />
      <Starfield />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40, 24]} />
        <meshStandardMaterial color="#20124a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.4, 6]} rotation={[-Math.PI / 8, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.55, 1.6, 20]} />
        <meshStandardMaterial color="#5b6bff" metalness={0.6} roughness={0.3} />
      </mesh>
      {eggs3d
        .filter((e) => e.visible)
        .map((e) => (
          <mesh key={e.id} position={e.pos} scale={[0.85, 1.15, 0.85]}>
            <sphereGeometry args={[0.7, 20, 20]} />
            <meshStandardMaterial color={e.color} roughness={0.4} metalness={0.1} />
          </mesh>
        ))}
      {booms.map((b) => (
        <Explosion key={b.id} position={b.pos} color={b.color} onDone={() => onBoomDone(b.id)} />
      ))}
    </>
  );
}

export default function BlasterGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const deck = useMemo(() => buildMcqQuestions(pool.terms), [pool]);

  const [round, setRound] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [lives, setLives] = useState(LIVES);
  const [eggs, setEggs] = useState<Egg[]>([]);
  const [booms, setBooms] = useState<Boom[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [size, setSize] = useState({ width: 0, height: 0 });

  const resolvedRef = useRef(false);
  const livesRef = useRef(LIVES);
  const comboRef = useRef(initialComboState());
  const missTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);

  const question = deck[round % (deck.length || 1)];
  const project = useMemo(() => createProjector(CAMERA, size), [size]);

  useEffect(() => onScore(combo.score), [combo.score, onScore]);

  useEffect(() => {
    const loop = () => {
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(missTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!question) return undefined;
    resolvedRef.current = false;
    const duration = fallSeconds(round);
    const words = shuffleArray(question.options.slice(0, WAVE));
    const bornAt = Date.now();
    let targetDelay = 0;
    const wave: Egg[] = words.map((word, i) => {
      const delay = i * SPACING_MS;
      const isTarget = word === question.answer;
      if (isTarget) targetDelay = delay;
      return {
        id: ++eggSeq,
        word,
        isTarget,
        x: -6.5 + i * (13 / (WAVE - 1)) + (Math.random() * 1.4 - 0.7),
        z: -1 + Math.random() * 3,
        delay,
        bornAt,
        duration: duration + (Math.random() * 0.7 - 0.35),
        color: EGG_COLORS[i % EGG_COLORS.length],
      };
    });
    setEggs(wave);
    missTimer.current = setTimeout(() => miss(), targetDelay + duration * 1000 + 250);
    return () => clearTimeout(missTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, question]);

  const worldOf = (egg: Egg) => {
    const t = (now - (egg.bornAt + egg.delay)) / (egg.duration * 1000);
    const y = TOP - Math.min(1, Math.max(0, t)) * (TOP - GROUND);
    const x = egg.x + Math.sin(now / 500 + egg.id) * 0.25;
    return { x, y, z: egg.z, t };
  };

  const nextRound = () => setTimeout(() => setRound((r) => r + 1), 520);

  const spawnBoom = (egg: Egg) => {
    const w = worldOf(egg);
    const id = ++boomSeq;
    setBooms((list) => [...list, { id, pos: [w.x, w.y, w.z], color: egg.color }]);
  };
  const removeBoom = (id: number) => setBooms((list) => list.filter((b) => b.id !== id));

  const miss = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    clearTimeout(missTimer.current);
    comboRef.current = applyAnswer(comboRef.current, false);
    setCombo(comboRef.current);
    sound.playWrong();
    livesRef.current -= 1;
    setLives(livesRef.current);
    if (livesRef.current <= 0) onGameOver(comboRef.current.score);
    else nextRound();
  };

  const shoot = (egg: Egg) => {
    sound.playShoot();
    spawnBoom(egg);
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

  const eggs3d = eggs.map((egg) => {
    const w = worldOf(egg);
    return {
      id: egg.id,
      pos: [w.x, w.y, w.z] as [number, number, number],
      color: egg.color,
      visible: w.t >= 0 && w.t <= 1.1,
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  const mult = comboMultiplier(combo.streak);

  return (
    <View style={styles.wrap}>
      <View style={styles.scene} onLayout={onLayout}>
        <GameCanvas background="#140a2e" camera={CAMERA}>
          <BlasterScene eggs3d={eggs3d} booms={booms} onBoomDone={removeBoom} />
        </GameCanvas>

        {/* tappable word labels projected over the 3D eggs */}
        {size.width > 0 &&
          eggs.map((egg) => {
            const w = worldOf(egg);
            if (w.t < 0 || w.t > 1.1) return null;
            const p = project(w.x, w.y + 1.1, w.z);
            if (!p.visible) return null;
            return (
              <Pressable
                key={egg.id}
                onPress={() => shoot(egg)}
                style={[styles.label, { left: p.x - 44, top: p.y - 16 }]}
              >
                <Text style={styles.labelText}>{egg.word}</Text>
              </Pressable>
            );
          })}

        <View style={styles.crosshair} />

        <View style={styles.hud}>
          {combo.streak >= 3 ? <Text style={styles.combo}>x{mult} combo</Text> : null}
          <Text style={styles.lives}>
            {"❤️".repeat(lives)}
            {"🤍".repeat(Math.max(0, LIVES - lives))}
          </Text>
        </View>
      </View>

      <View style={styles.target}>
        <Text style={styles.targetLabel}>Blast the word that means</Text>
        <Text style={styles.targetWord}>{question?.prompt}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12, gap: 10 },
  scene: { flex: 1, minHeight: 320, borderRadius: 16, overflow: "hidden", position: "relative" },
  label: {
    position: "absolute",
    width: 88,
    alignItems: "center",
    backgroundColor: "rgba(20,10,46,0.6)",
    borderRadius: 14,
    paddingVertical: 3,
  },
  labelText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  crosshair: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 30,
    height: 30,
    marginLeft: -15,
    marginTop: -15,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 15,
  },
  hud: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  combo: {
    color: "#fff",
    fontWeight: "800",
    backgroundColor: "rgba(124,246,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
  },
  lives: { fontSize: 16 },
  target: { alignItems: "center", gap: 2 },
  targetLabel: { color: "rgba(128,128,128,1)", fontSize: 12, textTransform: "uppercase" },
  targetWord: { fontSize: 18, fontWeight: "700" },
});
