import React from "react";

/**
 * Dragon — the FlashLearn AI buddy.
 *
 * "Dragon" is the dragon fruit (thanh long, a Vietnamese fruit): magenta skin,
 * green flame-like bracts, and white seed-speckled flesh. Drawn anime-cute with
 * big sparkly eyes, blush, and a tiny dragon horn so the fruit pun lands.
 *
 * Pure inline SVG so it stays crisp at any size and needs no asset pipeline.
 */
function DragonAvatar({ size = 48, withBackground = true, idleAnimation = false }) {
  // Unique gradient ids so multiple avatars on one page don't collide.
  const uid = React.useId().replace(/:/g, "");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Dragon, the FlashLearn assistant"
      style={{
        display: "block",
        animation: idleAnimation ? "dragon-bob 3.2s ease-in-out infinite" : undefined,
      }}
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#fff0f7" />
          <stop offset="100%" stopColor="#ffd9ec" />
        </radialGradient>
        <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6fb0" />
          <stop offset="100%" stopColor="#e0218a" />
        </linearGradient>
        <linearGradient id={`bract-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8ef0ad" />
          <stop offset="100%" stopColor="#2fbf71" />
        </linearGradient>
        <linearGradient id={`flesh-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fdeef6" />
        </linearGradient>
      </defs>

      {withBackground && (
        <circle cx="60" cy="60" r="58" fill={`url(#bg-${uid})`} />
      )}

      {/* Green bracts / flame-leaves of the dragon fruit */}
      <g fill={`url(#bract-${uid})`} stroke="#23a463" strokeWidth="1.4">
        <path d="M60 14 C66 24 64 34 60 40 C56 34 54 24 60 14 Z" />
        <path d="M34 26 C46 30 51 40 51 47 C42 44 34 38 34 26 Z" />
        <path d="M86 26 C74 30 69 40 69 47 C78 44 86 38 86 26 Z" />
        <path d="M24 50 C36 50 44 56 47 62 C38 64 28 62 24 50 Z" />
        <path d="M96 50 C84 50 76 56 73 62 C82 64 92 62 96 50 Z" />
      </g>

      {/* Tiny dragon horns */}
      <g fill="#ffd56b" stroke="#e8a93a" strokeWidth="1.2">
        <path d="M48 30 C46 24 49 21 52 22 C50 26 51 30 53 33 Z" />
        <path d="M72 30 C74 24 71 21 68 22 C70 26 69 30 67 33 Z" />
      </g>

      {/* Dragon-fruit body */}
      <ellipse cx="60" cy="70" rx="34" ry="32" fill={`url(#body-${uid})`} />

      {/* White seed-speckled flesh belly */}
      <ellipse cx="60" cy="76" rx="22" ry="20" fill={`url(#flesh-${uid})`} />
      <g fill="#3a3340">
        <circle cx="52" cy="72" r="1.5" />
        <circle cx="60" cy="69" r="1.5" />
        <circle cx="68" cy="73" r="1.5" />
        <circle cx="55" cy="80" r="1.5" />
        <circle cx="65" cy="81" r="1.5" />
        <circle cx="60" cy="86" r="1.5" />
      </g>

      {/* Blush */}
      <ellipse cx="44" cy="68" rx="5" ry="3.4" fill="#ff8ec4" opacity="0.75" />
      <ellipse cx="76" cy="68" rx="5" ry="3.4" fill="#ff8ec4" opacity="0.75" />

      {/* Big sparkly eyes */}
      <g>
        <ellipse cx="50" cy="62" rx="5.2" ry="6.4" fill="#2a2030" />
        <ellipse cx="70" cy="62" rx="5.2" ry="6.4" fill="#2a2030" />
        <circle cx="48.4" cy="59.6" r="1.9" fill="#ffffff" />
        <circle cx="68.4" cy="59.6" r="1.9" fill="#ffffff" />
        <circle cx="51.6" cy="64.4" r="0.9" fill="#ffffff" opacity="0.8" />
        <circle cx="71.6" cy="64.4" r="0.9" fill="#ffffff" opacity="0.8" />
      </g>

      {/* Smile */}
      <path
        d="M55 73 Q60 78 65 73"
        fill="none"
        stroke="#2a2030"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default DragonAvatar;
