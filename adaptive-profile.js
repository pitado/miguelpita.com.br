(() => {
  "use strict";

  const VERSION = "mp-art-v9";
  const TOKEN_KEY = "mp-art-device-token";
  const LEGACY_TOKEN_KEYS = ["mp-art-v8-device-token"];
  const LEGACY_PROFILE_KEYS = ["mp-art-v8-profile", "mp-art-v9-profile"];
  const UINT32_MAX = 0xffffffff;
  const FAMILY_NAMES = ["strata", "archipelago", "spine", "basin"];

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

  function hashString(text) {
    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    return mix32(hash);
  }

  function mulberry32(seed) {
    let state = seed >>> 0;

    return () => {
      state = (state + 0x6d2b79f5) | 0;

      let value = Math.imul(
        state ^ (state >>> 15),
        1 | state
      );

      value = (
        value +
        Math.imul(value ^ (value >>> 7), 61 | value)
      ) ^ value;

      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function stream(rootHash, salt) {
    return mulberry32(mix32(rootHash ^ salt));
  }

  function between(rng, min, max) {
    return lerp(min, max, rng());
  }

  function seedChannels(hash) {
    return {
      seed: hash / UINT32_MAX,
      seedA: (mix32(hash ^ 0x68bc21eb) & 0xffff) / 0xffff,
      seedB: (mix32(hash ^ 0x02e5be93) & 0xffff) / 0xffff
    };
  }

  function readSeedOverride() {
    try {
      const raw = new URLSearchParams(window.location.search)
        .get("artSeed")
        ?.trim();

      if (!raw || !/^(?:0x)?[0-9a-f]{1,8}$/i.test(raw)) {
        return null;
      }

      return Number.parseInt(raw.replace(/^0x/i, ""), 16) >>> 0;
    }
    catch {
      return null;
    }
  }

  function randomToken() {
    const bytes = new Uint32Array(4);

    if (window.crypto?.getRandomValues) {
      try {
        window.crypto.getRandomValues(bytes);

        return Array.from(bytes)
          .map(value => value.toString(16).padStart(8, "0"))
          .join("");
      }
      catch {}
    }

    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * UINT32_MAX);
    }

    return Array.from(bytes)
      .map(value => value.toString(16).padStart(8, "0"))
      .join("");
  }

  function getOrCreateLocalToken() {
    try {
      const current = localStorage.getItem(TOKEN_KEY);

      if (current) {
        return current;
      }

      for (const legacyKey of LEGACY_TOKEN_KEYS) {
        const legacy = localStorage.getItem(legacyKey);

        if (legacy) {
          localStorage.setItem(TOKEN_KEY, legacy);
          return legacy;
        }
      }

      const token = randomToken();
      localStorage.setItem(TOKEN_KEY, token);

      return token;
    }
    catch {
      return `volatile-${Date.now()}-${randomToken()}`;
    }
  }

  function getRendererInfo() {
    let gl = null;

    try {
      const canvas = document.createElement("canvas");

      gl = canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      if (!gl) {
        return {
          vendor: "no-webgl",
          renderer: "no-webgl"
        };
      }

      const extension = gl.getExtension("WEBGL_debug_renderer_info");
      const info = extension
        ? {
            vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) ||
              "unknown-vendor",
            renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) ||
              "unknown-renderer"
          }
        : {
            vendor: "masked-vendor",
            renderer: "masked-renderer"
          };

      gl.getExtension("WEBGL_lose_context")?.loseContext();

      return info;
    }
    catch {
      try {
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      }
      catch {}

      return {
        vendor: "renderer-error",
        renderer: "renderer-error"
      };
    }
  }

  function buildIdentity() {
    const renderer = getRendererInfo();
    const overrideHash = readSeedOverride();

    if (overrideHash !== null) {
      return {
        hash: overrideHash,
        ...seedChannels(overrideHash),
        token: "seed-override",
        traitsHash: 0,
        tokenHash: 0,
        detailHash: overrideHash,
        renderer,
        source: "override"
      };
    }

    const token = getOrCreateLocalToken();
    const screenWidth = screen.width || 0;
    const screenHeight = screen.height || 0;
    const shortEdge = Math.min(screenWidth, screenHeight);
    const longEdge = Math.max(screenWidth, screenHeight);

    const traits = [
      renderer.vendor,
      renderer.renderer,
      navigator.hardwareConcurrency || 0,
      navigator.deviceMemory || 0,
      navigator.maxTouchPoints || 0,
      shortEdge,
      longEdge,
      screen.colorDepth || 0,
      window.devicePixelRatio || 1
    ].join("|");

    const traitsHash = hashString(traits);
    const tokenHash = hashString(token);
    const hash = mix32(tokenHash ^ 0x9e3779b1);
    const detailHash = mix32(
      hash ^ Math.imul(traitsHash, 0x85ebca6b)
    );

    return {
      hash,
      ...seedChannels(detailHash),
      token,
      traitsHash,
      tokenHash,
      detailHash,
      renderer,
      source: "device"
    };
  }

  function estimatePower(identity) {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    const dpr = window.devicePixelRatio || 1;
    const renderer = `${identity.renderer.vendor} ${identity.renderer.renderer}`
      .toLowerCase();

    let score = 42;

    score += clamp((cores - 4) * 4, -10, 26);
    score += clamp((memory - 4) * 3, -8, 24);
    score -= clamp((dpr - 1) * 7, 0, 12);

    if (/nvidia|radeon|geforce/.test(renderer)) {
      score += 10;
    }
    else if (/apple|adreno|mali/.test(renderer)) {
      score += 5;
    }
    else if (/intel|uhd|iris/.test(renderer)) {
      score += 2;
    }

    return clamp(Math.round(score), 15, 95);
  }

  function qualityFromPower(powerScore) {
    const amount = clamp((powerScore - 15) / 80, 0, 1);

    return {
      powerScore,
      renderScale: lerp(0.72, 1.04, amount),
      pixelBudget: Math.round(lerp(750000, 3000000, amount)),
      fineLineDensity: Math.round(lerp(30, 56, amount)),
      secondaryLineDensity: lerp(20, 38, amount),
      structuralDensity: lerp(7, 14, amount),
      noiseWeight: lerp(0.55, 1, amount),
      microDetail: lerp(0.018, 0.055, amount),
      arcOpacity: lerp(0.03, 0.07, amount)
    };
  }

  function buildGeometryDNA(identity) {
    const rootHash = identity.hash >>> 0;
    const familyIndex = mix32(rootHash ^ 0x243f6a88) % FAMILY_NAMES.length;
    const family = FAMILY_NAMES[familyIndex];
    const layoutRng = stream(rootHash, 0x85a308d3);
    const massRng = stream(rootHash, 0x13198a2e);
    const cavityRng = stream(rootHash, 0x03707344);
    const flowRng = stream(rootHash, 0xa4093822);
    const detailRng = stream(rootHash, 0x299f31d0);
    const motionRng = stream(rootHash, 0x082efa98);
    const mirrorX = layoutRng() < 0.5 ? -1 : 1;
    const mirrorY = layoutRng() < 0.5 ? -1 : 1;
    const masses = [];
    const massMeta = [];
    const cavities = [];
    const cavityMeta = [];

    let globalAngle = 0;
    let fadeStart = 0.45;
    let fadeWidth = 0.55;
    let fadeStrength = 0.5;
    let verticalFade = 0.64;

    function addMass(x, y, radiusX, radiusY, angle, shear, weight, phase) {
      masses.push(x * mirrorX, y * mirrorY, radiusX, radiusY);
      massMeta.push(
        angle * mirrorX * mirrorY,
        shear * mirrorX,
        weight,
        phase
      );
    }

    function addCavity(
      x,
      y,
      radiusX,
      radiusY,
      angle,
      fieldStrength,
      phase,
      cutoutStrength
    ) {
      cavities.push(x * mirrorX, y * mirrorY, radiusX, radiusY);
      cavityMeta.push(
        angle * mirrorX * mirrorY,
        fieldStrength,
        phase,
        cutoutStrength
      );
    }

    if (family === "strata") {
      const anchorX = between(layoutRng, -0.16, 0.16);
      const anchorY = between(layoutRng, -0.08, 0.08);
      const driftX = between(layoutRng, 0.10, 0.19);
      const driftY = between(layoutRng, 0.04, 0.13);

      globalAngle = between(layoutRng, -0.72, 0.72);
      fadeStart = between(detailRng, 0.26, 0.48);
      fadeWidth = between(detailRng, 0.50, 0.78);
      fadeStrength = between(detailRng, 0.45, 0.72);
      verticalFade = between(detailRng, 0.52, 0.72);

      for (let i = 0; i < 6; i++) {
        const progression = (i - 2.5) / 2.5;

        addMass(
          anchorX + progression * driftX + between(massRng, -0.035, 0.035),
          anchorY + progression * driftY + between(massRng, -0.025, 0.025),
          between(massRng, 0.38, 0.68),
          between(massRng, 0.055, 0.13),
          between(massRng, -0.18, 0.18),
          between(massRng, -0.34, 0.34),
          i === 2 ? between(massRng, 1.02, 1.18) : between(massRng, 0.68, 1.02),
          massRng() * Math.PI * 2
        );
      }

      for (let i = 0; i < 2; i++) {
        addCavity(
          anchorX + between(cavityRng, -0.26, 0.26),
          anchorY + between(cavityRng, -0.10, 0.10),
          between(cavityRng, 0.09, 0.20),
          between(cavityRng, 0.035, 0.075),
          between(cavityRng, -0.35, 0.35),
          between(cavityRng, 0.08, 0.24),
          cavityRng() * Math.PI * 2,
          between(cavityRng, 0.10, 0.30)
        );
      }
    }
    else if (family === "archipelago") {
      const sites = [
        [-0.38, -0.18],
        [-0.16, 0.24],
        [0.16, -0.23],
        [0.40, 0.16],
        [0.02, 0.06]
      ];
      const massCount = 4 + Math.floor(layoutRng() * 2);

      globalAngle = between(layoutRng, -0.42, 0.42);
      fadeStart = between(detailRng, 0.54, 0.74);
      fadeWidth = between(detailRng, 0.28, 0.48);
      fadeStrength = between(detailRng, 0.12, 0.34);
      verticalFade = between(detailRng, 0.58, 0.78);

      for (let i = 0; i < massCount; i++) {
        const [siteX, siteY] = sites[i];

        addMass(
          siteX + between(massRng, -0.065, 0.065),
          siteY + between(massRng, -0.055, 0.055),
          between(massRng, 0.14, 0.27),
          between(massRng, 0.10, 0.22),
          between(massRng, -1.1, 1.1),
          between(massRng, -0.48, 0.48),
          between(massRng, 0.66, 1.02),
          massRng() * Math.PI * 2
        );
      }

      const cavityCount = 1 + Math.floor(cavityRng() * 2);

      for (let i = 0; i < cavityCount; i++) {
        const target = sites[i + 1];

        addCavity(
          target[0] + between(cavityRng, -0.04, 0.04),
          target[1] + between(cavityRng, -0.04, 0.04),
          between(cavityRng, 0.055, 0.12),
          between(cavityRng, 0.045, 0.10),
          between(cavityRng, -1.2, 1.2),
          between(cavityRng, 0.10, 0.30),
          cavityRng() * Math.PI * 2,
          between(cavityRng, 0.25, 0.58)
        );
      }
    }
    else if (family === "spine") {
      const anchorX = between(layoutRng, -0.11, 0.11);
      const anchorY = between(layoutRng, -0.05, 0.05);
      const bend = between(layoutRng, 0.05, 0.16);

      globalAngle = between(layoutRng, -1.05, 1.05);
      fadeStart = between(detailRng, 0.40, 0.60);
      fadeWidth = between(detailRng, 0.40, 0.66);
      fadeStrength = between(detailRng, 0.34, 0.60);
      verticalFade = between(detailRng, 0.62, 0.82);

      for (let i = 0; i < 6; i++) {
        const progression = (i - 2.5) / 5;

        addMass(
          anchorX + Math.sin(progression * Math.PI * 1.4) * bend +
            between(massRng, -0.025, 0.025),
          anchorY + progression * between(layoutRng, 0.88, 1.12),
          between(massRng, 0.085, 0.17),
          between(massRng, 0.22, 0.39),
          between(massRng, -0.22, 0.22),
          between(massRng, -0.32, 0.32),
          i === 2 || i === 3
            ? between(massRng, 0.94, 1.14)
            : between(massRng, 0.58, 0.92),
          massRng() * Math.PI * 2
        );
      }

      for (let i = 0; i < 3; i++) {
        const progression = (i - 1) / 3;

        addCavity(
          anchorX + between(cavityRng, -0.08, 0.08),
          anchorY + progression * 0.68,
          between(cavityRng, 0.035, 0.075),
          between(cavityRng, 0.10, 0.19),
          between(cavityRng, -0.25, 0.25),
          between(cavityRng, 0.12, 0.34),
          cavityRng() * Math.PI * 2,
          between(cavityRng, 0.22, 0.52)
        );
      }
    }
    else {
      const anchorX = between(layoutRng, -0.16, 0.16);
      const anchorY = between(layoutRng, -0.08, 0.10);

      globalAngle = between(layoutRng, -0.88, 0.88);
      fadeStart = between(detailRng, 0.48, 0.68);
      fadeWidth = between(detailRng, 0.34, 0.56);
      fadeStrength = between(detailRng, 0.18, 0.42);
      verticalFade = between(detailRng, 0.60, 0.80);

      addMass(
        anchorX,
        anchorY,
        between(massRng, 0.56, 0.76),
        between(massRng, 0.29, 0.46),
        between(massRng, -0.35, 0.35),
        between(massRng, -0.30, 0.30),
        between(massRng, 1.08, 1.24),
        massRng() * Math.PI * 2
      );

      const satelliteCount = 2 + Math.floor(layoutRng() * 2);

      for (let i = 0; i < satelliteCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;

        addMass(
          anchorX + side * between(massRng, 0.32, 0.54),
          anchorY + between(massRng, -0.28, 0.28),
          between(massRng, 0.16, 0.31),
          between(massRng, 0.11, 0.24),
          between(massRng, -1.0, 1.0),
          between(massRng, -0.42, 0.42),
          between(massRng, 0.54, 0.88),
          massRng() * Math.PI * 2
        );
      }

      for (let i = 0; i < 3; i++) {
        addCavity(
          anchorX + between(cavityRng, -0.25, 0.25),
          anchorY + between(cavityRng, -0.16, 0.16),
          between(cavityRng, 0.09, 0.22),
          between(cavityRng, 0.065, 0.16),
          between(cavityRng, -1.2, 1.2),
          between(cavityRng, 0.18, 0.46),
          cavityRng() * Math.PI * 2,
          between(cavityRng, 0.48, 0.88)
        );
      }
    }

    const activeMasses = masses.length / 4;
    const activeCavities = cavities.length / 4;

    while (masses.length < 24) {
      const index = masses.length / 4;
      masses.push(4 + index, 4 + index, 0.02, 0.02);
      massMeta.push(0, 0, 0.25, 0);
    }

    while (cavities.length < 12) {
      const index = cavities.length / 4;
      cavities.push(4 + index, 4 + index, 0.02, 0.02);
      cavityMeta.push(0, 0, 0, 0);
    }

    return {
      family,
      familyIndex,
      activeMasses,
      activeCavities,
      anchorX: masses[0],
      anchorY: masses[1],
      globalAngle: globalAngle * mirrorX * mirrorY,
      shear: between(flowRng, -0.32, 0.32),
      flowX: between(flowRng, 1.0, 5.8),
      flowY: between(flowRng, 0.8, 6.2),
      flowStrength: between(flowRng, 0.025, 0.17),
      flowDirection: flowRng() > 0.5 ? 1 : -1,
      warpA: between(flowRng, 0.018, 0.12),
      warpB: between(flowRng, 0.012, 0.10),
      warpScaleA: between(flowRng, 0.9, 3.1),
      warpScaleB: between(flowRng, 2.0, 6.3),
      faultAngle: between(detailRng, -1.55, 1.55),
      faultOffset: between(detailRng, -0.22, 0.22),
      faultStrength: between(detailRng, 0, 0.17),
      foldFrequencyA: between(detailRng, 1.3, 6.0),
      foldFrequencyB: between(detailRng, 2.0, 8.8),
      foldStrengthA: between(detailRng, 0.012, 0.082),
      foldStrengthB: between(detailRng, 0.005, 0.052),
      asymmetry: between(detailRng, 0.10, 0.62),
      rightFadeStart: fadeStart,
      fadeWidth,
      fadeStrength,
      fadeDirection: mirrorX,
      verticalFade,
      animationSpeed: between(motionRng, 0.58, 1.16),
      breathing: between(motionRng, 0.006, 0.040),
      linePhase: detailRng() * Math.PI * 2,
      technicalPhase: detailRng() * Math.PI * 2,
      masses,
      massMeta,
      cavities,
      cavityMeta
    };
  }

  function scoreFromRuntime(basePowerScore, fps) {
    let score = basePowerScore;

    if (fps >= 58) {
      score += 7;
    }
    else if (fps >= 50) {
      score += 3;
    }
    else if (fps < 30) {
      score -= 18;
    }
    else if (fps < 42) {
      score -= 9;
    }

    return clamp(Math.round(score), 15, 95);
  }

  function createProfile() {
    const identity = buildIdentity();
    const basePowerScore = estimatePower(identity);

    return {
      version: VERSION,
      identity,
      geometry: buildGeometryDNA(identity),
      quality: qualityFromPower(basePowerScore),
      basePowerScore,
      powerScore: basePowerScore,
      measuredFps: null
    };
  }

  function tuneQualityFromRuntime(profile, fps) {
    if (!profile || !Number.isFinite(fps)) {
      return profile;
    }

    const basePowerScore = Number.isFinite(profile.basePowerScore)
      ? profile.basePowerScore
      : estimatePower(profile.identity);
    const powerScore = scoreFromRuntime(basePowerScore, fps);

    const updated = {
      ...profile,
      basePowerScore,
      powerScore,
      measuredFps: fps,
      quality: qualityFromPower(powerScore)
    };

    return updated;
  }

  function resetIdentity() {
    try {
      localStorage.removeItem(TOKEN_KEY);

      for (const legacyKey of LEGACY_TOKEN_KEYS) {
        localStorage.removeItem(legacyKey);
      }

      for (const legacyKey of LEGACY_PROFILE_KEYS) {
        localStorage.removeItem(legacyKey);
      }
    }
    catch {}
  }

  window.MPAdaptiveArt = {
    version: VERSION,
    createProfile,
    tuneQualityFromRuntime,
    resetIdentity
  };
})();
