(() => {
  "use strict";

  const stage = document.getElementById("stage");
  const canvas = document.getElementById("webgl");

  if (!stage || !canvas) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));
  const lerp = (a, b, amount) =>
    a + (b - a) * amount;

  function mix32(value) {
    let hash = value >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b);
    hash ^= hash >>> 16;
    return hash >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), 1 | state);
      value = (
        value + Math.imul(value ^ (value >>> 7), 61 | value)
      ) ^ value;
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function easeInOutSine(value) {
    return -(Math.cos(Math.PI * value) - 1) / 2;
  }

  function colorToCss(color, fallback) {
    if (!Array.isArray(color) || color.length < 3) return fallback;
    const rgb = color.slice(0, 3).map(channel =>
      Math.round(clamp(Number(channel) || 0, 0, 1) * 255)
    );
    return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
  }

  let profile = null;
  try {
    profile = window.MPAdaptiveArt?.createProfile?.() || null;
  }
  catch (error) {
    console.warn("Motion V12.2 sem perfil procedural:", error);
  }

  const identityHash = (
    profile?.identity?.detailHash ||
    profile?.identity?.hash ||
    0x5f3759df
  ) >>> 0;
  const rng = mulberry32(mix32(identityHash ^ 0x12f10a22));
  const geometry = profile?.geometry || {};
  const grammar = geometry.grammar || geometry.species || "organic";

  const grammarMotion = {
    organic: 1.16,
    geological: 0.72,
    technical: 0.46,
    fragmented: 0.66,
    radial: 0.82,
    interference: 1.02
  };

  const grammarFactor = grammarMotion[grammar] || 0.84;

  stage.style.setProperty(
    "--motion-bg",
    colorToCss(geometry.backgroundColor, "#f6f3ee")
  );
  stage.style.setProperty(
    "--motion-line",
    colorToCss(geometry.lineColor, "rgb(90 110 98)")
  );

  if (reducedMotion) {
    stage.style.setProperty("--reveal-edge", "120%");
    stage.style.setProperty("--reveal-glow-x", "120%");
    stage.style.setProperty("--art-offset-x", "0px");
    stage.style.setProperty("--art-offset-y", "0px");
    stage.style.setProperty("--light-offset-x", "0px");
    stage.style.setProperty("--light-offset-y", "0px");
    stage.style.setProperty("--art-scale", "1");
    stage.style.setProperty("--art-tilt-x", "0deg");
    stage.style.setProperty("--art-tilt-y", "0deg");
    stage.classList.add("motion-revealed");
    return;
  }

  const state = {
    start: performance.now(),
    revealDuration: 1750 + rng() * 900,
    revealDelay: 80 + rng() * 180,
    pointerX: 0,
    pointerY: 0,
    targetX: 0,
    targetY: 0,
    phaseA: rng() * Math.PI * 2,
    phaseB: rng() * Math.PI * 2,
    phaseC: rng() * Math.PI * 2,
    driftSpeedA: 0.00011 + rng() * 0.00006,
    driftSpeedB: 0.000075 + rng() * 0.00005,
    breatheSpeed: 0.00016 + rng() * 0.00007,
    revealed: false
  };

  function updatePointer(event) {
    if (!finePointer) return;

    const x = event.clientX / Math.max(1, window.innerWidth);
    const y = event.clientY / Math.max(1, window.innerHeight);
    state.targetX = clamp((x - 0.5) * 2, -1, 1);
    state.targetY = clamp((y - 0.5) * 2, -1, 1);
  }

  function resetPointer() {
    state.targetX = 0;
    state.targetY = 0;
  }

  if (finePointer) {
    window.addEventListener("pointermove", updatePointer, { passive: true });
    document.documentElement.addEventListener("mouseleave", resetPointer, {
      passive: true
    });
  }

  function render(now) {
    const elapsed = now - state.start;
    const revealRaw = clamp(
      (elapsed - state.revealDelay) / state.revealDuration,
      0,
      1
    );
    const reveal = easeOutCubic(revealRaw);

    if (!state.revealed) {
      const edge = lerp(-4, 116, reveal);
      stage.style.setProperty("--reveal-edge", `${edge.toFixed(2)}%`);
      stage.style.setProperty(
        "--reveal-glow-x",
        `${clamp(edge, -4, 108).toFixed(2)}%`
      );

      if (revealRaw >= 1) {
        state.revealed = true;
        stage.classList.add("motion-revealed");
      }
    }

    state.pointerX = lerp(state.pointerX, state.targetX, 0.038);
    state.pointerY = lerp(state.pointerY, state.targetY, 0.038);

    const mobileFactor = finePointer ? 1 : 0.43;
    const idleAmplitudeX = 3.8 * grammarFactor * mobileFactor;
    const idleAmplitudeY = 3.0 * grammarFactor * mobileFactor;

    const idleX =
      Math.sin(now * state.driftSpeedA + state.phaseA) * idleAmplitudeX +
      Math.cos(now * state.driftSpeedB + state.phaseB) * idleAmplitudeX * 0.42;
    const idleY =
      Math.cos(now * state.driftSpeedA * 0.91 + state.phaseB) * idleAmplitudeY +
      Math.sin(now * state.driftSpeedB * 1.17 + state.phaseC) * idleAmplitudeY * 0.38;

    const pointerX = finePointer ? state.pointerX * 4.2 * grammarFactor : 0;
    const pointerY = finePointer ? state.pointerY * 3.2 * grammarFactor : 0;

    const offsetX = idleX + pointerX;
    const offsetY = idleY + pointerY;

    const breatheWave = easeInOutSine(
      (Math.sin(now * state.breatheSpeed + state.phaseC) + 1) * 0.5
    );
    const breatheAmount = (finePointer ? 0.0055 : 0.0032) * grammarFactor;
    const scale = 1.009 + breatheWave * breatheAmount;

    const tiltX = finePointer
      ? clamp(-state.pointerY * 0.20 * grammarFactor, -0.22, 0.22)
      : 0;
    const tiltY = finePointer
      ? clamp(state.pointerX * 0.24 * grammarFactor, -0.26, 0.26)
      : 0;

    stage.style.setProperty("--art-offset-x", `${offsetX.toFixed(2)}px`);
    stage.style.setProperty("--art-offset-y", `${offsetY.toFixed(2)}px`);
    stage.style.setProperty("--light-offset-x", `${(offsetX * 0.42).toFixed(2)}px`);
    stage.style.setProperty("--light-offset-y", `${(offsetY * 0.42).toFixed(2)}px`);
    stage.style.setProperty("--art-scale", scale.toFixed(5));
    stage.style.setProperty("--art-tilt-x", `${tiltX.toFixed(3)}deg`);
    stage.style.setProperty("--art-tilt-y", `${tiltY.toFixed(3)}deg`);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
