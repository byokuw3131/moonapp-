// MoonApp Web Audio Sound Effects (Zero-dependency synthesized audio)
const MoonAudio = (() => {
  let ctx = null;
  let ringInterval = null;

  function getAudioContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  // Outgoing message 'pop' sound
  function playSentSound() {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      const now = audioCtx.currentTime;

      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Incoming message notification 'ding'
  function playReceivedSound() {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;

      // Note 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // Note 2
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.09); // A5
      gain2.gain.setValueAtTime(0.2, now + 0.09);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.09);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Outgoing Calling Beep (Tuuuut... Tuuuut...)
  function startOutgoingRing() {
    stopRinging();
    const playTone = () => {
      try {
        const audioCtx = getAudioContext();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(425, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.2);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + 1.35);
      } catch (e) {}
    };

    playTone();
    ringInterval = setInterval(playTone, 3200);
  }

  // Incoming Melodic Ringtone
  function startIncomingRing() {
    stopRinging();
    const playMelody = () => {
      try {
        const audioCtx = getAudioContext();
        if (!audioCtx) return;
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const now = audioCtx.currentTime + (idx * 0.18);
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.connect(gain);
          gain.connect(audioCtx.destination);

          osc.start(now);
          osc.stop(now + 0.38);
        });
      } catch (e) {}
    };

    playMelody();
    ringInterval = setInterval(playMelody, 2400);
  }

  // Stop Ringing
  function stopRinging() {
    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
  }

  // End Call Tone
  function playEndCallSound() {
    stopRinging();
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      [0, 0.12, 0.24].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now + offset);
        gain.gain.setValueAtTime(0.15, now + offset);
        gain.gain.linearRampToValueAtTime(0.001, now + offset + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.09);
      });
    } catch (e) {}
  }

  return {
    playSentSound,
    playReceivedSound,
    startOutgoingRing,
    startIncomingRing,
    stopRinging,
    playEndCallSound,
    init: getAudioContext
  };
})();
