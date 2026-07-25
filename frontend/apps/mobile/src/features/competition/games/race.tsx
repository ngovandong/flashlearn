import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useFrame } from "@react-three/fiber/native";
import type { Group, Mesh, Material } from "three";
import {
  applyAnswer,
  buildMcqQuestions,
  initialComboState,
  simulateBotAnswer,
} from "@flashlearn/core";
import type { GameProps } from "../types";
import { OptionButtons } from "./OptionButtons";
import { GameCanvas, damp } from "../three/kit";

const TOTAL = 12;
const BOTS = [
  { name: "Turbo", difficulty: "hard" as const, color: "#ff5d5d" },
  { name: "Zoom", difficulty: "medium" as const, color: "#5db0ff" },
  { name: "Putt", difficulty: "easy" as const, color: "#f2b53c" },
];
const LANES_X = [0, -6, 6, -3.2];
const Z_START = -40;
const Z_FINISH = 4;
const FEEDBACK_MS = 700;

const progressToZ = (p: number) => Z_START + Math.min(1, p) * (Z_FINISH - Z_START);

function Car({
  x,
  color,
  targetZ,
  isPlayer,
  boost,
}: {
  x: number;
  color: string;
  targetZ: number;
  isPlayer?: boolean;
  boost?: boolean;
}) {
  const group = useRef<Group>(null);
  const z = useRef(Z_START);
  const nitro = useRef<Mesh>(null);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    z.current = damp(z.current, targetZ, 4, dt);
    g.position.set(x, Math.sin(state.clock.elapsedTime * 6 + x) * 0.04 + 0.35, z.current);
    if (nitro.current) {
      const mat = nitro.current.material as Material & { opacity: number };
      mat.opacity = damp(mat.opacity, boost && isPlayer ? 0.85 : 0, 10, dt);
    }
  });

  return (
    <group ref={group}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[1.7, 0.5, 3]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.68, -0.15]}>
        <boxGeometry args={[1.15, 0.5, 1.4]} />
        <meshStandardMaterial color={isPlayer ? "#ffffff" : "#1c2140"} />
      </mesh>
      <mesh position={[0, 0.62, 1.45]}>
        <boxGeometry args={[1.7, 0.12, 0.4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {([[-0.95, -1.05], [0.95, -1.05], [-0.95, 1.05], [0.95, 1.05]] as const).map(
        (p, i) => (
          <mesh key={i} position={[p[0], 0.05, p[1]]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.34, 0.34, 0.3, 16]} />
            <meshStandardMaterial color="#0b0b12" />
          </mesh>
        )
      )}
      <mesh ref={nitro} position={[0, 0.3, 2.1]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.4, 2.2, 12]} />
        <meshStandardMaterial
          color="#7cf6ff"
          emissive="#39e0ff"
          emissiveIntensity={2}
          transparent
          opacity={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Road({ speed }: { speed: React.MutableRefObject<number> }) {
  const dashes = useRef<Array<Mesh | null>>([]);
  useFrame((_, dt) => {
    dashes.current.forEach((d) => {
      if (!d) return;
      d.position.z += speed.current * dt;
      if (d.position.z > Z_FINISH + 6) d.position.z -= 60;
    });
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -14]}>
        <planeGeometry args={[20, 80]} />
        <meshStandardMaterial color="#2a2f4a" roughness={1} />
      </mesh>
      {Array.from({ length: 30 }).map((_, i) => (
        <mesh
          key={i}
          ref={(el: Mesh | null) => {
            dashes.current[i] = el;
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, Z_START + i * 2]}
        >
          <planeGeometry args={[0.24, 1.1]} />
          <meshStandardMaterial color="#ffd166" emissive="#ffd166" emissiveIntensity={0.3} toneMapped={false} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, Z_FINISH]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {[-9.5, 9.5].map((bx) => (
        <mesh key={bx} position={[bx, 0.4, -14]}>
          <boxGeometry args={[0.5, 0.8, 80]} />
          <meshStandardMaterial color="#e8484f" emissive="#3a0d10" />
        </mesh>
      ))}
    </group>
  );
}

function RaceScene({
  playerPos,
  botPos,
  boost,
}: {
  playerPos: number;
  botPos: number[];
  boost: boolean;
}) {
  const speed = useRef(8);
  useFrame((_, dt) => {
    speed.current = damp(speed.current, boost ? 34 : 9, 3, dt);
  });
  return (
    <>
      <fog attach="fog" args={["#0d1030", 20, 70]} />
      <Road speed={speed} />
      <Car x={LANES_X[0]} color="#39c0ff" targetZ={progressToZ(playerPos)} isPlayer boost={boost} />
      {BOTS.map((b, i) => (
        <Car key={b.name} x={LANES_X[i + 1]} color={b.color} targetZ={progressToZ(botPos[i])} />
      ))}
    </>
  );
}

export default function RaceGame({ pool, sound, onScore, onGameOver }: GameProps) {
  const theme = useTheme();
  const questions = useMemo(() => buildMcqQuestions(pool.terms, TOTAL), [pool]);
  const total = questions.length || TOTAL;
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [picked, setPicked] = useState<string | null>(null);
  const [player, setPlayer] = useState(0);
  const [bots, setBots] = useState<number[]>(() => BOTS.map(() => 0));
  const [boost, setBoost] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const question = questions[index];

  useEffect(() => onScore(combo.score), [combo.score, onScore]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const answer = (option: string) => {
    if (picked || !question) return;
    const correct = option === question.answer;
    setPicked(option);
    if (correct) {
      sound.playBoost();
      sound.say(question.answer);
      setCombo((c) => applyAnswer(c, true));
      setPlayer((p) => p + 1);
      setBoost(true);
      setTimeout(() => setBoost(false), 600);
    } else {
      sound.playWrong();
      setCombo((c) => applyAnswer(c, false));
    }
    setBots((prev) =>
      prev.map((pos, i) =>
        simulateBotAnswer(BOTS[i].difficulty).correct ? pos + 1 / total : pos
      )
    );

    timer.current = setTimeout(() => {
      const next = index + 1;
      if (next >= total) {
        setBots((finalBots) => {
          const me = (player + (correct ? 1 : 0)) / total;
          const ahead = finalBots.filter((b) => b > me).length;
          const bonus = Math.max(0, (BOTS.length + 1 - (ahead + 1)) * 25);
          setCombo((c) => {
            onGameOver(c.score + bonus);
            return c;
          });
          return finalBots;
        });
      } else {
        setIndex(next);
        setPicked(null);
      }
    }, FEEDBACK_MS);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.scene}>
        <GameCanvas background="#0d1030" camera={{ position: [0, 7.5, 16], fov: 55, target: [0, 0, -6] }}>
          <RaceScene playerPos={player / total} botPos={bots} boost={boost} />
        </GameCanvas>
        <View style={styles.legend}>
          {[{ name: "You", color: "#39c0ff" }, ...BOTS].map((l) => (
            <View key={l.name} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {question ? (
        <View style={styles.quiz}>
          <Text variant="titleLarge" style={{ color: theme.colors.onSurface, textAlign: "center" }}>
            {question.prompt}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}>
            {index + 1} / {total}
          </Text>
          <OptionButtons options={question.options} answer={question.answer} picked={picked} onPick={answer} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12, gap: 12 },
  scene: { flex: 1, minHeight: 240, borderRadius: 16, overflow: "hidden", position: "relative" },
  legend: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  quiz: { gap: 12 },
});
