// The chair umpire's voice through the browser's speech synthesis; silent where it is missing.

export interface Voice {
  say(text: string, volume: number): void;
  cancel(): void;
}

export function createVoice(): Voice {
  const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  return {
    say(text, volume) {
      if (!synth || volume <= 0) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = 1.05;
      u.volume = Math.min(1, volume);
      synth.speak(u);
    },
    cancel() {
      synth?.cancel();
    },
  };
}
