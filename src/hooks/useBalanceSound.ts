import { useCallback, useRef } from "react";

export function useBalanceSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playBalanceSound = useCallback((isPositive: boolean = false) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (isPositive) {
        // Positive sound - ascending tone
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
        oscillator.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.15);
      } else {
        // Neutral/deduction sound - two-tone notification
        oscillator.frequency.setValueAtTime(587, ctx.currentTime);
        oscillator.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
      }

      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.log("Audio not supported");
    }
  }, []);

  return { playBalanceSound };
}
