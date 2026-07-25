import React, { useEffect, useState } from "react";

// A quick "3 · 2 · 1 · GO!" intro that gives every game an arcade start.
export default function Countdown({ onDone, sound }) {
  const [step, setStep] = useState(3);

  useEffect(() => {
    if (step < 0) {
      onDone();
      return undefined;
    }
    sound?.unlock?.();
    sound?.playBeep?.(step === 0);
    const id = setTimeout(() => setStep((s) => s - 1), step === 0 ? 550 : 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, onDone]);

  if (step < 0) return null;

  return (
    <div className="cmp-countdown">
      <span key={step} className={`cmp-countdown__num${step === 0 ? " go" : ""}`}>
        {step === 0 ? "GO!" : step}
      </span>
    </div>
  );
}
