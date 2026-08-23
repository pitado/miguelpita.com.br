(() => {
  "use strict";

  const VERSION = "mp-art-v10";
  const TOKEN_KEY = "mp-art-device-token";
  const LEGACY_TOKEN_KEYS = ["mp-art-v8-device-token"];
  const LEGACY_PROFILE_KEYS = ["mp-art-v8-profile", "mp-art-v9-profile"];
  const UINT32_MAX = 0xffffffff;
  const FAMILY_NAMES = ["strata", "archipelago", "spine", "basin"];
  const GPU_SPECIES = [
    "topographic",
    "crystal",
    "orbital",
    "filament",
    "cellular",
    "void"
  ];
  // Paletas fixas antigas. Não são mais usadas diretamente (a cor agora é
  // gerada continuamente em HSL, ver buildContinuousPalette), mas ficam
  // aqui guardadas: se a versão livre não convencer, dá pra voltar a
  // escolher 1 destas 6 por índice em vez de gerar continuamente.
  const LEGACY_GPU_PALETTES = [
    [[0.965, 0.954, 0.936], [0.50, 0.50, 0.51], [0.28, 0.28, 0.29]],
    [[0.947, 0.956, 0.962], [0.38, 0.45, 0.52], [0.19, 0.28, 0.36]],
    [[0.969, 0.946, 0.920], [0.55, 0.39, 0.28], [0.34, 0.20, 0.14]],
    [[0.937, 0.953, 0.943], [0.29, 0.47, 0.39], [0.14, 0.31, 0.25]],
    [[0.967, 0.955, 0.906], [0.52, 0.43, 0.21], [0.31, 0.25, 0.10]],
    [[0.953, 0.940, 0.960], [0.44, 0.34, 0.49], [0.25, 0.17, 0.31]]
  ];

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

  function hslToRgb(hue, saturation, lightness) {
    const h = (((hue % 360) + 360) % 360) / 60;
    const s = clamp(saturation, 0, 1);
    const l = clamp(lightness, 0, 1);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = l - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 1) { r = c; g = x; b = 0; }
    else if (h < 2) { r = x; g = c; b = 0; }
    else if (h < 3) { r = 0; g = c; b = x; }
    else if (h < 4) { r = 0; g = x; b = c; }
    else if (h < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    return [r + m, g + m, b + m];
  }

  // Gera a paleta livremente em HSL a partir do rng do visitante, em vez
  // de escolher 1 de N combinações fixas. O matiz (hue) é totalmente
  // livre (0-360), então não existe um número máximo de "looks"
  // possíveis. Mantém o caráter minimalista (fundo claro, linha média,
  // acento escuro e saturado) que o site já tinha.
  function buildContinuousPalette(rng) {
    const hue = rng() * 360;
    const spread = between(rng, 10, 26);
    const saturation = between(rng, 0.22, 0.58);

    const backgroundColor = hslToRgb(
      hue,
      saturation * 0.5,
      between(rng, 0.90, 0.965)
    );
    const lineColor = hslToRgb(
      hue + spread,
      clamp(saturation + 0.08, 0, 0.68),
      between(rng, 0.34, 0.54)
    );
    const accentColor = hslToRgb(
      hue - spread,
      clamp(saturation + 0.20, 0, 0.82),
      between(rng, 0.12, 0.26)
    );

    return [backgroundColor, lineColor, accentColor];
  }

  function seedChannels(hash) {
    return {
      seed: hash / UINT32_MAX,
      seedA: (mix32(hash ^ 0x68bc21eb) & 0xffff) / 0xffff,
      seedB: (mix32(hash ^ 0x02e5be93) & 0xffff) / 0xffff
    };
  }

  function readSeedOverride(name = "artSeed") {
    try {
      const raw = new URLSearchParams(window.location.search)
        .get(name)
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
      const identity = extension
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

      const parameter = (name, fallback = 0) => {
        try {
          return gl.getParameter(gl[name]) || fallback;
        }
        catch {
          return fallback;
        }
      };
      const precision = (() => {
        try {
          return gl.getShaderPrecisionFormat(
            gl.FRAGMENT_SHADER,
            gl.HIGH_FLOAT
          )?.precision || 0;
        }
        catch {
          return 0;
        }
      })();
      const capabilities = [
        parameter("MAX_TEXTURE_SIZE"),
        parameter("MAX_RENDERBUFFER_SIZE"),
        parameter("MAX_FRAGMENT_UNIFORM_VECTORS"),
        parameter("MAX_VARYING_VECTORS"),
        parameter("MAX_VERTEX_ATTRIBS"),
        parameter("MAX_VERTEX_TEXTURE_IMAGE_UNITS"),
        precision,
        ...(gl.getSupportedExtensions?.() || []).sort()
      ].join("|");
      const info = {
        ...identity,
        capabilities,
        fingerprint: `${identity.vendor}|${identity.renderer}|${capabilities}`
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
    const gpuOverrideHash = readSeedOverride("gpuSeed");

    if (overrideHash !== null) {
      return {
        hash: overrideHash,
        ...seedChannels(overrideHash),
        token: "seed-override",
        traitsHash: 0,
        tokenHash: 0,
        gpuHash: gpuOverrideHash ?? overrideHash,
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

    const gpuHash = gpuOverrideHash ?? hashString(
      renderer.fingerprint || `${renderer.vendor}|${renderer.renderer}`
    );
    const traits = [
      gpuHash,
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
    const hash = mix32(
      gpuHash ^
      Math.imul(tokenHash, 0x9e3779b1)
    );
    const detailHash = mix32(
      hash ^ Math.imul(traitsHash, 0x85ebca6b)
    );

    return {
      hash,
      ...seedChannels(detailHash),
      token,
      traitsHash,
      tokenHash,
      gpuHash,
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

  function qualityFromPower(powerScore, identity) {
    const amount = clamp((powerScore - 15) / 80, 0, 1);

    // renderScale/pixelBudget continuam só do desempenho do aparelho —
    // mexer nisso por aleatoriedade poderia travar um dispositivo fraco.
    // Mas densidade/ruído/detalhe são escolhas de estilo, não limite
    // técnico: cada visitante ganha um tempero próprio nelas (a partir
    // do rootHash, então gente com hardware parecido deixa de receber
    // a mesma textura), sempre dentro de uma faixa seura pro aparelho.
    const styleRng = identity ? stream(identity.hash >>> 0, 0x9e3d1c2b) : null;
    const jitter = () => (styleRng ? between(styleRng, 0.82, 1.18) : 1);

    return {
      powerScore,
      renderScale: lerp(0.72, 1.04, amount),
      pixelBudget: Math.round(lerp(750000, 3000000, amount)),
      fineLineDensity: Math.round(
        clamp(lerp(30, 56, amount) * jitter(), 24, 62)
      ),
      secondaryLineDensity: clamp(lerp(20, 38, amount) * jitter(), 16, 44),
      structuralDensity: clamp(lerp(7, 14, amount) * jitter(), 5, 17),
      noiseWeight: clamp(lerp(0.55, 1, amount) * jitter(), 0.45, 1.15),
      microDetail: clamp(lerp(0.018, 0.055, amount) * jitter(), 0.014, 0.065),
      arcOpacity: clamp(lerp(0.03, 0.07, amount) * jitter(), 0.022, 0.085)
    };
  }

  function buildGeometryDNA(identity) {
    const rootHash = identity.hash >>> 0;
    const gpuHash = identity.gpuHash >>> 0;

    // Uma GPU mascarada ou muito comum (Firefox com resistFingerprinting,
    // Safari, várias configs de privacidade zeram o
    // WEBGL_debug_renderer_info; e mesmo sem isso, um punhado de GPUs
    // domina o mercado) faz um monte de visitante cair no mesmo gpuHash.
    // Antes, família e espécie vinham só dele — por isso a arte
    // "engessava" em poucas combinações. Aqui misturamos com o rootHash
    // (que já carrega o token aleatório por navegador), então a GPU ainda
    // participa da composição, mas nunca sozinha: cada visitante segue
    // tendo a sua.
    const compositionHash = mix32(
      gpuHash ^ Math.imul(rootHash, 0x2545f491)
    );
    const familyIndex = mix32(compositionHash ^ 0x243f6a88) % FAMILY_NAMES.length;
    const family = FAMILY_NAMES[familyIndex];
    const renderMode = mix32(compositionHash ^ 0xb7e15162) % GPU_SPECIES.length;
    const species = GPU_SPECIES[renderMode];
    const palette = buildContinuousPalette(stream(compositionHash, 0xc2b2ae35));
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
      species,
      renderMode,
      backgroundColor: palette[0],
      lineColor: palette[1],
      accentColor: palette[2],
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
      quality: qualityFromPower(basePowerScore, identity),
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
      quality: qualityFromPower(powerScore, profile.identity)
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
