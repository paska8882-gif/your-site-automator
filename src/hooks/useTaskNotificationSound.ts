import { useCallback, useRef } from "react";

export function useTaskNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNewTaskSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Amber/warning sound - two ascending tones
      oscillator.frequency.setValueAtTime(523, ctx.currentTime); // C5
      oscillator.frequency.setValueAtTime(659, ctx.currentTime + 0.15); // E5

      oscillator.type = "sine";
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log("Audio not supported");
    }
  }, []);

  const playProblematicTaskSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      
      // Play two quick descending tones for urgency
      for (let i = 0; i < 2; i++) {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        const startTime = ctx.currentTime + i * 0.25;
        
        // Red/alert sound - descending urgent tone
        oscillator.frequency.setValueAtTime(880, startTime); // A5
        oscillator.frequency.linearRampToValueAtTime(440, startTime + 0.15); // A4

        oscillator.type = "square";
        gainNode.gain.setValueAtTime(0.08, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.2);
      }
    } catch (e) {
      console.log("Audio not supported");
    }
  }, []);

  return { playNewTaskSound, playProblematicTaskSound };
}
