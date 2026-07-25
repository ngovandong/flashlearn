import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  applyAnswer,
  buildMcqQuestions,
  initialComboState,
  simulateBotAnswer,
} from "@flashlearn/core";
import { GameCanvas, damp } from "../three/kit";

const TOTAL = 12;
const BOTS = [
  { name: "Turbo", difficulty: "hard", color: "#ff5d5d" },
  { name: "Zoom", difficulty: "medium", color: "#5db0ff" },
  { name: "Putt", difficulty: "easy", color: "#f2b53c" },
];
const LANES_X = [0, -6, 6, -3.2];
const Z_START = -40;
const Z_FINISH = 4;
const FEEDBACK_MS = 720;

function progressToZ(p) {
  return Z_START + Math.min(1, p) * (Z_FINISH - Z_START);
}

// A chunky low-poly kart built from primitives.
function Car({ x, color, targetZ, isPlayer, boost, name }) {
  const group = useRef();
  const z = useRef(Z_START);
  const wheels = useRef([]);
  const nitro = useRef();

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    z.current = damp(z.current, targetZ, 4, dt);
    g.position.x = x;
    g.position.z = z.current;
    g.position.y = Math.sin(state.clock.elapsedTime * 6 + x) * 0.04 + 0.35;
    g.rotation.z = Math.sin(state.clock.elapsedTime * 5 + x) * 0.02;
    const spin = (boost && isPlayer ? 22 : 9) * dt;
    wheels.current.forEach((w) => w && (w.rotation.x += spin));
    if (nitro.current) {
      const on = boost && isPlayer;
      nitro.current.material.opacity = damp(
        nitro.current.material.opacity,
        on ? 0.85 : 0,
        10,
        dt
      );
      nitro.current.scale.z = 1 + Math.sin(state.clock.elapsedTime * 30) * 0.3;
    }
  });

  return (
    <group ref={group}>
      {/* body */}
      <mesh castShadow position={[0, 0.25, 0]}>
        <boxGeometry args={[1.7, 0.5, 3]} />
        <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
      </mesh>
      {/* cabin */}
      <mesh position={[0, 0.68, -0.15]}>
        <boxGeometry args={[1.15, 0.5, 1.4]} />
        <meshStandardMaterial
          color={isPlayer ? "#ffffff" : "#1c2140"}
          metalness={0.2}
          roughness={0.25}
        />
      </mesh>
      {/* spoiler */}
      <mesh position={[0, 0.62, 1.45]}>
        <boxGeometry args={[1.7, 0.12, 0.4]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      {[[-0.95, -1.05], [0.95, -1.05], [-0.95, 1.05], [0.95, 1.05]].map(
        (p, i) => (
          <mesh
            key={i}
            ref={(el) => (wheels.current[i] = el)}
            position={[p[0], 0.05, p[1]]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.34, 0.34, 0.3, 16]} />
            <meshStandardMaterial color="#0b0b12" />
          </mesh>
        )
      )}
      {/* nitro flame */}
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
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.55}
        color={isPlayer ? "#ffffff" : color}
        anchorX="center"
        outlineWidth={0.03}
        outlineColor="#000"
      >
        {name}
      </Text>
    </group>
  );
}

// Scrolling dashes on the tarmac to sell forward speed.
function Road({ speed }) {
  const dashes = useRef([]);
  useFrame((_, dt) => {
    dashes.current.forEach((d) => {
      if (!d) return;
      d.position.z += speed.current * dt;
      if (d.position.z > Z_FINISH + 6) d.position.z -= 60;
    });
  });
  const rows = 30;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -14]} receiveShadow>
        <planeGeometry args={[20, 80]} />
        <meshStandardMaterial color="#2a2f4a" roughness={1} />
      </mesh>
      {[-3, 3].map((lx) => (
        <mesh
          key={lx}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[lx, 0.01, -14]}
        >
          <planeGeometry args={[0.12, 80]} />
          <meshStandardMaterial color="#3d4468" />
        </mesh>
      ))}
      {Array.from({ length: rows }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => (dashes.current[i] = el)}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, Z_START + i * 2]}
        >
          <planeGeometry args={[0.24, 1.1]} />
          <meshStandardMaterial
            color="#ffd166"
            emissive="#ffd166"
            emissiveIntensity={0.3}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* finish line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, Z_FINISH]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* side barriers */}
      {[-9.5, 9.5].map((bx) => (
        <mesh key={bx} position={[bx, 0.4, -14]}>
          <boxGeometry args={[0.5, 0.8, 80]} />
          <meshStandardMaterial color="#e8484f" emissive="#3a0d10" />
        </mesh>
      ))}
    </group>
  );
}

function RaceScene({ playerPos, botPos, boost }) {
  const speed = useRef(8);
  const { camera } = useThree();
  // Chase cam: ride just behind the player's kart so the karts are always in
  // frame. A fixed camera left them parked in the fog at the far start line.
  const camZ = useRef(progressToZ(0) + 13);
  useFrame((_, dt) => {
    const target = boost ? 34 : 9;
    speed.current = damp(speed.current, target, 3, dt);
    const focus = progressToZ(playerPos);
    camZ.current = damp(camZ.current, focus + 13, 3, dt);
    camera.position.set(0, 6.5, camZ.current);
    camera.lookAt(0, 0.6, focus - 8);
  });
  return (
    <>
      <fog attach="fog" args={["#0d1030", 20, 70]} />
      <Road speed={speed} />
      <Car
        x={LANES_X[0]}
        color="#39c0ff"
        targetZ={progressToZ(playerPos)}
        isPlayer
        boost={boost}
        name="You"
      />
      {BOTS.map((b, i) => (
        <Car
          key={b.name}
          x={LANES_X[i + 1]}
          color={b.color}
          targetZ={progressToZ(botPos[i])}
          name={b.name}
        />
      ))}
    </>
  );
}

// Vocab Grand Prix — answer meaning -> word to nitro-boost your kart past the AI.
export default function Race({ pool, sound, onScoreChange, onGameOver }) {
  const questions = useMemo(() => buildMcqQuestions(pool.terms, TOTAL), [pool]);
  const [index, setIndex] = useState(0);
  const [combo, setCombo] = useState(initialComboState);
  const [player, setPlayer] = useState(0);
  const [bots, setBots] = useState(() => BOTS.map(() => 0));
  const [picked, setPicked] = useState(null);
  const [boost, setBoost] = useState(false);
  const timerRef = useRef(null);

  const question = questions[index];
  const total = questions.length || TOTAL;

  useEffect(() => onScoreChange(combo.score), [combo.score, onScoreChange]);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const answer = (option) => {
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

    timerRef.current = setTimeout(() => {
      const next = index + 1;
      if (next >= total) finish();
      else {
        setIndex(next);
        setPicked(null);
      }
    }, FEEDBACK_MS);
  };

  const finish = () => {
    setBots((finalBots) => {
      const me = player / total;
      const ahead = finalBots.filter((b) => b > me).length;
      const placement = ahead + 1;
      const bonus = Math.max(0, (BOTS.length + 1 - placement) * 25);
      setCombo((c) => {
        onGameOver(c.score + bonus);
        return c;
      });
      return finalBots;
    });
  };

  return (
    <div className="cmp-3d">
      <div className="cmp-3d__scene">
        <GameCanvas
          background="#0d1030"
          camera={{ position: [0, 7.5, 16], fov: 55 }}
        >
          <RaceScene
            playerPos={player / total}
            botPos={bots}
            boost={boost}
          />
        </GameCanvas>
      </div>

      {question && (
        <div className="cmp-quiz cmp-quiz--overlay">
          <div className="cmp-quiz__prompt">
            <span className="cmp-quiz__count">
              {index + 1} / {total}
            </span>
            {question.prompt}
          </div>
          <div className="cmp-quiz__options">
            {question.options.map((option) => {
              let cls = "";
              if (picked) {
                if (option === question.answer) cls = " correct";
                else if (option === picked) cls = " wrong";
              }
              return (
                <button
                  key={option}
                  type="button"
                  className={`cmp-option${cls}`}
                  onClick={() => answer(option)}
                  disabled={Boolean(picked)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
