import React, { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

/**
 * Dragon — the FlashLearn AI buddy, ported 1:1 from the web SVG
 * (`frontend/apps/web/src/components/dragonAvatar.js`).
 *
 * "Dragon" is the dragon fruit (thanh long): magenta skin, green flame-like
 * bracts, white seed-speckled flesh, drawn anime-cute with sparkly eyes, blush
 * and tiny horns.
 *
 * `idleAnimation` adds a playful bob + gentle wobble so the buddy feels alive.
 */
export function DragonAvatar({
  size = 48,
  withBackground = true,
  idleAnimation = false,
}: {
  size?: number;
  withBackground?: boolean;
  idleAnimation?: boolean;
}) {
  const uid = React.useId().replace(/:/g, "");
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!idleAnimation) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [idleAnimation, t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.09] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["-4deg", "4deg"] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Animated.View
      style={idleAnimation ? { transform: [{ translateY }, { rotate }, { scale }] } : undefined}
    >
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <RadialGradient id={`bg-${uid}`} cx="50%" cy="38%" r="72%">
            <Stop offset="0%" stopColor="#fff0f7" />
            <Stop offset="100%" stopColor="#ffd9ec" />
          </RadialGradient>
          <LinearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ff6fb0" />
            <Stop offset="100%" stopColor="#e0218a" />
          </LinearGradient>
          <LinearGradient id={`bract-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#8ef0ad" />
            <Stop offset="100%" stopColor="#2fbf71" />
          </LinearGradient>
          <LinearGradient id={`flesh-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ffffff" />
            <Stop offset="100%" stopColor="#fdeef6" />
          </LinearGradient>
        </Defs>

        {withBackground && <Circle cx="60" cy="60" r="58" fill={`url(#bg-${uid})`} />}

        {/* Green bracts / flame-leaves of the dragon fruit */}
        <G fill={`url(#bract-${uid})`} stroke="#23a463" strokeWidth="1.4">
          <Path d="M60 14 C66 24 64 34 60 40 C56 34 54 24 60 14 Z" />
          <Path d="M34 26 C46 30 51 40 51 47 C42 44 34 38 34 26 Z" />
          <Path d="M86 26 C74 30 69 40 69 47 C78 44 86 38 86 26 Z" />
          <Path d="M24 50 C36 50 44 56 47 62 C38 64 28 62 24 50 Z" />
          <Path d="M96 50 C84 50 76 56 73 62 C82 64 92 62 96 50 Z" />
        </G>

        {/* Tiny dragon horns */}
        <G fill="#ffd56b" stroke="#e8a93a" strokeWidth="1.2">
          <Path d="M48 30 C46 24 49 21 52 22 C50 26 51 30 53 33 Z" />
          <Path d="M72 30 C74 24 71 21 68 22 C70 26 69 30 67 33 Z" />
        </G>

        {/* Dragon-fruit body */}
        <Ellipse cx="60" cy="70" rx="34" ry="32" fill={`url(#body-${uid})`} />

        {/* White seed-speckled flesh belly */}
        <Ellipse cx="60" cy="76" rx="22" ry="20" fill={`url(#flesh-${uid})`} />
        <G fill="#3a3340">
          <Circle cx="52" cy="72" r="1.5" />
          <Circle cx="60" cy="69" r="1.5" />
          <Circle cx="68" cy="73" r="1.5" />
          <Circle cx="55" cy="80" r="1.5" />
          <Circle cx="65" cy="81" r="1.5" />
          <Circle cx="60" cy="86" r="1.5" />
        </G>

        {/* Blush */}
        <Ellipse cx="44" cy="68" rx="5" ry="3.4" fill="#ff8ec4" opacity="0.75" />
        <Ellipse cx="76" cy="68" rx="5" ry="3.4" fill="#ff8ec4" opacity="0.75" />

        {/* Big sparkly eyes */}
        <G>
          <Ellipse cx="50" cy="62" rx="5.2" ry="6.4" fill="#2a2030" />
          <Ellipse cx="70" cy="62" rx="5.2" ry="6.4" fill="#2a2030" />
          <Circle cx="48.4" cy="59.6" r="1.9" fill="#ffffff" />
          <Circle cx="68.4" cy="59.6" r="1.9" fill="#ffffff" />
          <Circle cx="51.6" cy="64.4" r="0.9" fill="#ffffff" opacity="0.8" />
          <Circle cx="71.6" cy="64.4" r="0.9" fill="#ffffff" opacity="0.8" />
        </G>

        {/* Smile */}
        <Path d="M55 73 Q60 78 65 73" fill="none" stroke="#2a2030" strokeWidth="2" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}
