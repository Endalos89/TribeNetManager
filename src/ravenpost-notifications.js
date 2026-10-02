(() => {
  if (!window.ravenpost?.onNewMail) return;

  let audioContext = null;

  function createNoiseBuffer(ctx, duration) {
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function scheduleCroak(ctx, startAt, duration, startHz, endHz, volume) {
    const master = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, startAt);
    filter.Q.setValueAtTime(1.35, startAt);
    master.gain.setValueAtTime(0.0001, startAt);
    master.gain.exponentialRampToValueAtTime(volume, startAt + 0.045);
    master.gain.setValueAtTime(volume * 0.82, startAt + duration * 0.55);
    master.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    filter.connect(master);
    master.connect(ctx.destination);

    const fundamental = ctx.createOscillator();
    fundamental.type = 'sawtooth';
    fundamental.frequency.setValueAtTime(startHz, startAt);
    fundamental.frequency.exponentialRampToValueAtTime(endHz, startAt + duration);
    const fundamentalGain = ctx.createGain();
    fundamentalGain.gain.value = 0.55;
    fundamental.connect(fundamentalGain);
    fundamentalGain.connect(filter);

    const harmonic = ctx.createOscillator();
    harmonic.type = 'square';
    harmonic.frequency.setValueAtTime(startHz * 2.04, startAt);
    harmonic.frequency.exponentialRampToValueAtTime(endHz * 1.92, startAt + duration);
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.value = 0.16;
    harmonic.connect(harmonicGain);
    harmonicGain.connect(filter);

    const wobble = ctx.createOscillator();
    wobble.frequency.value = 17;
    const wobbleGain = ctx.createGain();
    wobbleGain.gain.value = 18;
    wobble.connect(wobbleGain);
    wobbleGain.connect(fundamental.detune);
    wobbleGain.connect(harmonic.detune);

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, duration);
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.13;
    noise.connect(noiseGain);
    noiseGain.connect(filter);

    for (const source of [fundamental, harmonic, wobble, noise]) {
      source.start(startAt);
      source.stop(startAt + duration);
    }
  }

  async function playRavenCall() {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') await audioContext.resume();
      const now = audioContext.currentTime + 0.015;
      scheduleCroak(audioContext, now, 0.52, 285, 145, 0.17);
      scheduleCroak(audioContext, now + 0.68, 0.58, 255, 125, 0.2);
      return true;
    } catch (_) {
      return false;
    }
  }

  window.RavenpostSound = { play: playRavenCall };

  window.ravenpost.onNewMail(payload => {
    if (payload?.playSound) playRavenCall();
  });
})();
