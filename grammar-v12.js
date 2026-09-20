(() => {
  "use strict";

  if (!window.MPAdaptiveArt) {
    console.error("V11.1 precisa carregar antes de grammar-v12.js.");
    return;
  }

  const VERSION = "mp-art-v12";
  const GRAMMARS = [
    "organic",
    "geological",
    "technical",
    "fragmented",
    "radial",
    "interference"
  ];

  const baseApi = window.MPAdaptiveArt;
  const baseCreateProfile = baseApi.createProfile.bind(baseApi);
  const baseTuneQuality = baseApi.tuneQualityFromRuntime.bind(baseApi);
  const baseResetIdentity = baseApi.resetIdentity.bind(baseApi);

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

  // Fallback local do gerador V13. Em produção a camada consome
  // profile.random (o mesmo xoshiro128** que atravessa a pilha);
  // isto só existe para quando a camada roda isolada, sem base.
  function localRandom(words) {
    let s0 = words[0] >>> 0;
    let s1 = words[1] >>> 0;
    let s2 = words[2] >>> 0;
    let s3 = words[3] >>> 0;

    if (!(s0 | s1 | s2 | s3)) {
      s0 = 0x9e3779b9;
      s1 = 0x243f6a88;
      s2 = 0xb7e15162;
      s3 = 0x85a308d3;
    }

    const step = () => {
      const mixed = Math.imul(s1, 5);
      const rotated = ((mixed << 7) | (mixed >>> 25)) >>> 0;
      const result = Math.imul(rotated, 9) >>> 0;
      const shifted = (s1 << 9) >>> 0;

      s2 = (s2 ^ s0) >>> 0;
      s3 = (s3 ^ s1) >>> 0;
      s1 = (s1 ^ s2) >>> 0;
      s0 = (s0 ^ s3) >>> 0;
      s2 = (s2 ^ shifted) >>> 0;
      s3 = ((s3 << 11) | (s3 >>> 21)) >>> 0;

      return result;
    };

    // mesmo aquecimento do gerador base.
    for (let i = 0; i < 12; i++) step();

    const uint32 = step;

    const unit = () => uint32() / 4294967296;

    const api = {
      uint32,
      unit,
      between: (min, max) => lerp(min, max, unit()),
      int(bound) {
        const size = Math.floor(bound);
        if (!(size > 1)) return 0;
        const limit = 4294967296 - (4294967296 % size);
        let value = uint32();
        while (value >= limit) value = uint32();
        return value % size;
      },
      pick: list => list[api.int(list.length)],
      weighted(entries) {
        let total = 0;
        for (let i = 0; i < entries.length; i++) total += entries[i][1];
        let ticket = unit() * total;
        for (let i = 0; i < entries.length; i++) {
          ticket -= entries[i][1];
          if (ticket <= 0) return entries[i][0];
        }
        return entries[entries.length - 1][0];
      },
      chance: probability => unit() < probability,
      sign: () => (unit() < 0.5 ? -1 : 1)
    };

    return api;
  }

  function randomFor(profile) {
    if (profile?.random?.between) {
      return profile.random;
    }

    const root = (
      profile?.identity?.hash ??
      profile?.identity?.detailHash ??
      0x9e3779b9
    ) >>> 0;

    return localRandom(
      profile?.identity?.state || [
        mix32(root ^ 0x243f6a88),
        mix32(root ^ 0x85a308d3),
        mix32(root ^ 0x13198a2e),
        mix32(root ^ 0x03707344)
      ]
    );
  }

  function readGrammarOverride() {
    try {
      const raw = new URLSearchParams(window.location.search)
        .get("artGrammar")
        ?.trim()
        .toLowerCase();

      if (!raw) return null;

      if (/^\d+$/.test(raw)) {
        const index = Number.parseInt(raw, 10);
        return Number.isInteger(index) && index >= 0 && index < GRAMMARS.length
          ? index
          : null;
      }

      const index = GRAMMARS.indexOf(raw);
      return index >= 0 ? index : null;
    }
    catch {
      return null;
    }
  }

  function chooseGrammar(random) {
    const override = readGrammarOverride();
    if (override !== null) return override;

    return random.int(GRAMMARS.length);
  }

  // Gerador reproduzível, derivado do estado: tuneQualityFromRuntime
  // roda a cada medição de FPS e não pode consumir o gerador vivo,
  // senão a qualidade derivaria a cada quadro medido.
  function derivedRandom(profile, salt) {
    const state = profile?.identity?.state;
    const root = (
      profile?.identity?.hash ??
      profile?.identity?.detailHash ??
      1
    ) >>> 0;

    const words = state
      ? [
          mix32(state[0] ^ salt),
          mix32(state[1] ^ Math.imul(salt, 0x9e3779b1)),
          mix32(state[2] ^ Math.imul(salt, 0x85ebca6b)),
          mix32(state[3] ^ Math.imul(salt, 0xc2b2ae35))
        ]
      : [
          mix32(root ^ salt),
          mix32(root ^ Math.imul(salt, 0x9e3779b1)),
          mix32(root ^ Math.imul(salt, 0x85ebca6b)),
          mix32(root ^ Math.imul(salt, 0xc2b2ae35))
        ];

    return localRandom(words);
  }

  function cloneGeometry(geometry) {
    return {
      ...geometry,
      masses: [...geometry.masses],
      massMeta: [...geometry.massMeta],
      cavities: [...geometry.cavities],
      cavityMeta: [...geometry.cavityMeta],
      backgroundColor: [...geometry.backgroundColor],
      lineColor: [...geometry.lineColor],
      accentColor: [...geometry.accentColor]
    };
  }

  function channelLuminance(channel) {
    const value = clamp(channel, 0, 1);
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(color) {
    return (
      0.2126 * channelLuminance(color[0]) +
      0.7152 * channelLuminance(color[1]) +
      0.0722 * channelLuminance(color[2])
    );
  }

  // Antes: transformColor empurrava os canais para longe de 0.5 e
  // aplicava um viés sempre negativo, ou seja, escurecia. Numa paleta
  // de fundo escuro (V13) isso joga a linha PARA DENTRO do fundo.
  // Agora a gramática afasta a cor do fundo no sentido que o tema
  // pede: escurece em tema claro, clareia em tema escuro.
  function deepen(color, background, amount) {
    const overDark = relativeLuminance(background) < 0.22;

    return color.map(channel =>
      clamp(
        overDark
          ? channel + amount * (1 - channel)
          : channel - amount * channel,
        0,
        1
      )
    );
  }

  function desaturate(color, amount) {
    const gray = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
    return color.map(channel => lerp(channel, gray, amount));
  }

  const LIMITS = baseApi.LIMITS || { maxMasses: 14, maxCavities: 6 };

  function forEachMass(geometry, callback) {
    const count = clamp(geometry.activeMasses || 6, 0, LIMITS.maxMasses);
    for (let index = 0; index < count; index++) {
      callback(index, index * 4);
    }
  }

  function forEachCavity(geometry, callback) {
    const count = clamp(geometry.activeCavities || 3, 0, LIMITS.maxCavities);
    for (let index = 0; index < count; index++) {
      callback(index, index * 4);
    }
  }

  /* =========================================================
     GRAMÁTICA DENTRO DO ARQUÉTIPO (V13)

     Cada gramática fixava faixas absolutas: organic punha
     flowStrength entre 0,13 e 0,23, technical entre 0,018 e 0,050,
     e assim por diante. Isso sobrescrevia por completo o arquétipo
     de energia decidido acima e devolvia toda peça daquela
     gramática para a mesma região.

     Agora a gramática guarda só o seu caráter RELATIVO: uma posição
     dentro da faixa do arquétipo. `organic` continua sendo das mais
     fluidas e `technical` das mais contidas, mas uma organic calma
     e uma organic violenta deixam de ser a mesma peça.
  ========================================================= */

  const ENERGY_FALLBACK = {
    flow: [0.02, 0.24], warp: [0.012, 0.16], fault: [0, 0.22],
    fold: [0.006, 0.12], speed: [0.4, 1.7], breathing: [0.004, 0.05]
  };

  function within(geometry, key, rng, lo, hi) {
    const range =
      geometry.archetypeRanges?.energy?.[key] || ENERGY_FALLBACK[key];

    return range[0] + (range[1] - range[0]) * rng.between(lo, hi);
  }

  function applyOrganic(geometry, rng) {
    geometry.renderMode = 0;
    geometry.flowStrength = within(geometry, "flow", rng, 0.62, 1.0);
    geometry.flowX = rng.between(0.7, 2.8);
    geometry.flowY = rng.between(0.7, 3.2);
    geometry.warpA = within(geometry, "warp", rng, 0.66, 1.0);
    geometry.warpB = within(geometry, "warp", rng, 0.50, 0.88);
    geometry.warpScaleA = rng.between(0.65, 1.8);
    geometry.warpScaleB = rng.between(1.2, 3.0);
    geometry.faultStrength = within(geometry, "fault", rng, 0.0, 0.22);
    geometry.foldFrequencyA = rng.between(0.8, 2.5);
    geometry.foldFrequencyB = rng.between(1.2, 3.4);
    geometry.foldStrengthA = within(geometry, "fold", rng, 0.64, 1.0);
    geometry.foldStrengthB = within(geometry, "fold", rng, 0.38, 0.76);
    geometry.asymmetry = rng.between(0.58, 0.92);

    forEachMass(geometry, (_index, offset) => {
      geometry.masses[offset] += rng.between(-0.08, 0.08);
      geometry.masses[offset + 1] += rng.between(-0.07, 0.07);
      geometry.masses[offset + 2] *= rng.between(1.05, 1.34);
      geometry.masses[offset + 3] *= rng.between(0.95, 1.28);
      geometry.massMeta[offset] += rng.between(-0.34, 0.34);
      geometry.massMeta[offset + 1] += rng.between(-0.28, 0.28);
    });

    geometry.lineColor = deepen(geometry.lineColor, geometry.backgroundColor, 0.04);
    geometry.accentColor = deepen(geometry.accentColor, geometry.backgroundColor, 0.06);
  }

  function applyGeological(geometry, rng) {
    geometry.renderMode = 5;
    geometry.faultStrength = within(geometry, "fault", rng, 0.70, 1.0);
    geometry.faultAngle = rng.between(-1.5, 1.5);
    geometry.faultOffset = rng.between(-0.30, 0.30);
    geometry.foldFrequencyA = rng.between(3.5, 7.0);
    geometry.foldFrequencyB = rng.between(4.5, 9.5);
    geometry.foldStrengthA = within(geometry, "fold", rng, 0.70, 1.0);
    geometry.foldStrengthB = within(geometry, "fold", rng, 0.44, 0.78);
    geometry.flowStrength = within(geometry, "flow", rng, 0.18, 0.48);
    geometry.warpA = within(geometry, "warp", rng, 0.20, 0.52);
    geometry.warpB = within(geometry, "warp", rng, 0.14, 0.42);
    geometry.asymmetry = rng.between(0.35, 0.74);

    forEachCavity(geometry, (_index, offset) => {
      geometry.cavities[offset + 2] *= rng.between(1.15, 1.65);
      geometry.cavities[offset + 3] *= rng.between(1.10, 1.55);
      geometry.cavityMeta[offset + 1] = clamp(
        geometry.cavityMeta[offset + 1] * rng.between(1.25, 1.70),
        0,
        0.62
      );
      geometry.cavityMeta[offset + 3] = clamp(
        geometry.cavityMeta[offset + 3] * rng.between(1.10, 1.45),
        0,
        0.94
      );
    });

    geometry.lineColor = deepen(geometry.lineColor, geometry.backgroundColor, 0.10);
    geometry.accentColor = deepen(geometry.accentColor, geometry.backgroundColor, 0.13);
  }

  function applyTechnical(geometry, rng) {
    geometry.renderMode = 1;
    geometry.flowStrength = within(geometry, "flow", rng, 0.0, 0.20);
    geometry.warpA = within(geometry, "warp", rng, 0.0, 0.18);
    geometry.warpB = within(geometry, "warp", rng, 0.0, 0.14);
    geometry.faultStrength = within(geometry, "fault", rng, 0.0, 0.16);
    geometry.foldStrengthA = within(geometry, "fold", rng, 0.0, 0.18);
    geometry.foldStrengthB = within(geometry, "fold", rng, 0.0, 0.12);
    geometry.asymmetry = rng.between(0.08, 0.30);

    forEachMass(geometry, (index, offset) => {
      const snap = geometry.archetypeRanges?.order?.snap || Math.PI / 4;
      geometry.massMeta[offset] =
        Math.round(geometry.massMeta[offset] / snap) * snap;
      geometry.massMeta[offset + 1] *= rng.between(0.25, 0.55);
      geometry.masses[offset + 2] *= index % 2 === 0 ? 1.15 : 0.88;
      geometry.masses[offset + 3] *= index % 2 === 0 ? 0.88 : 1.15;
    });

    geometry.lineColor = desaturate(
      deepen(geometry.lineColor, geometry.backgroundColor, 0.12),
      0.20
    );
    geometry.accentColor = desaturate(
      deepen(geometry.accentColor, geometry.backgroundColor, 0.14),
      0.12
    );
  }

  function applyFragmented(geometry, rng) {
    geometry.renderMode = 3;
    geometry.flowStrength = within(geometry, "flow", rng, 0.46, 0.82);
    geometry.warpA = within(geometry, "warp", rng, 0.34, 0.72);
    geometry.warpB = within(geometry, "warp", rng, 0.24, 0.62);
    geometry.faultStrength = within(geometry, "fault", rng, 0.56, 0.94);
    geometry.foldFrequencyA = rng.between(5.0, 9.0);
    geometry.foldFrequencyB = rng.between(6.0, 11.0);
    geometry.foldStrengthA = within(geometry, "fold", rng, 0.40, 0.76);
    geometry.foldStrengthB = within(geometry, "fold", rng, 0.22, 0.58);
    geometry.asymmetry = rng.between(0.64, 0.96);

    forEachMass(geometry, (index, offset) => {
      const x = geometry.masses[offset];
      const y = geometry.masses[offset + 1];
      const push = rng.between(1.12, 1.42);
      geometry.masses[offset] = x * push + rng.between(-0.12, 0.12);
      geometry.masses[offset + 1] = y * push + rng.between(-0.10, 0.10);
      geometry.masses[offset + 2] *= rng.between(0.70, 1.02);
      geometry.masses[offset + 3] *= rng.between(0.66, 0.98);
      geometry.massMeta[offset] += (index % 2 ? 1 : -1) * rng.between(0.24, 0.70);
      geometry.massMeta[offset + 1] += rng.between(-0.52, 0.52);
    });

    geometry.lineColor = deepen(geometry.lineColor, geometry.backgroundColor, 0.11);
    geometry.accentColor = deepen(geometry.accentColor, geometry.backgroundColor, 0.15);
  }

  function applyRadial(geometry, rng) {
    geometry.renderMode = 2;
    const centerX = rng.between(-0.14, 0.14);
    const centerY = rng.between(-0.10, 0.10);
    const radiusX = rng.between(0.42, 0.70);
    const radiusY = rng.between(0.30, 0.54);
    const phaseOffset = rng.between(-Math.PI, Math.PI);

    forEachMass(geometry, (index, offset) => {
      const angle = phaseOffset + (index / Math.max(1, geometry.activeMasses)) * Math.PI * 2;
      geometry.masses[offset] = centerX + Math.cos(angle) * radiusX * rng.between(0.72, 1.0);
      geometry.masses[offset + 1] = centerY + Math.sin(angle) * radiusY * rng.between(0.72, 1.0);
      geometry.masses[offset + 2] *= rng.between(0.78, 1.16);
      geometry.masses[offset + 3] *= rng.between(0.78, 1.16);
      geometry.massMeta[offset] = angle + Math.PI / 2;
      geometry.massMeta[offset + 1] *= 0.35;
    });

    if ((geometry.activeCavities || 0) > 0) {
      geometry.cavities[0] = centerX;
      geometry.cavities[1] = centerY;
      geometry.cavities[2] = rng.between(0.11, 0.24);
      geometry.cavities[3] = rng.between(0.09, 0.20);
      geometry.cavityMeta[1] = rng.between(0.34, 0.58);
      geometry.cavityMeta[3] = rng.between(0.54, 0.88);
    }

    geometry.flowStrength = within(geometry, "flow", rng, 0.26, 0.58);
    geometry.warpA = within(geometry, "warp", rng, 0.12, 0.44);
    geometry.warpB = within(geometry, "warp", rng, 0.12, 0.44);
    geometry.faultStrength = within(geometry, "fault", rng, 0.0, 0.14);
    geometry.asymmetry = rng.between(0.16, 0.42);
  }

  function applyInterference(geometry, rng) {
    geometry.renderMode = 4;
    geometry.flowStrength = within(geometry, "flow", rng, 0.72, 1.0);
    geometry.flowX = rng.between(4.5, 8.0);
    geometry.flowY = rng.between(4.5, 8.5);
    geometry.warpA = within(geometry, "warp", rng, 0.52, 0.90);
    geometry.warpB = within(geometry, "warp", rng, 0.42, 0.84);
    geometry.warpScaleA = rng.between(2.8, 5.5);
    geometry.warpScaleB = rng.between(4.0, 8.0);
    geometry.faultStrength = within(geometry, "fault", rng, 0.22, 0.60);
    geometry.foldFrequencyA = rng.between(7.0, 13.0);
    geometry.foldFrequencyB = rng.between(8.0, 15.0);
    geometry.foldStrengthA = within(geometry, "fold", rng, 0.16, 0.50);
    geometry.foldStrengthB = within(geometry, "fold", rng, 0.14, 0.46);
    geometry.asymmetry = rng.between(0.44, 0.86);

    forEachMass(geometry, (index, offset) => {
      const band = (index - 2.5) * rng.between(0.10, 0.18);
      geometry.masses[offset] += band;
      geometry.masses[offset + 1] += Math.sin(index * 1.7) * rng.between(0.08, 0.18);
      geometry.massMeta[offset] += rng.between(-0.18, 0.18);
      geometry.massMeta[offset + 1] += rng.between(-0.38, 0.38);
    });

    geometry.lineColor = deepen(geometry.lineColor, geometry.backgroundColor, 0.12);
    geometry.accentColor = deepen(geometry.accentColor, geometry.backgroundColor, 0.16);
  }

  const geometryTransforms = [
    applyOrganic,
    applyGeological,
    applyTechnical,
    applyFragmented,
    applyRadial,
    applyInterference
  ];

  function applyQualityGrammar(quality, grammarIndex, rng) {
    const next = { ...quality };

    if (grammarIndex === 0) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * rng.between(0.72, 0.92), 20, 62));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * rng.between(0.72, 0.92), 14, 44);
      next.structuralDensity = clamp(next.structuralDensity * rng.between(0.78, 1.0), 4, 17);
      next.noiseWeight = clamp(next.noiseWeight * rng.between(1.08, 1.28), 0.45, 1.28);
      next.arcOpacity = clamp(next.arcOpacity * 0.50, 0.012, 0.050);
    }
    else if (grammarIndex === 1) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * rng.between(0.92, 1.12), 24, 68));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * rng.between(0.88, 1.10), 18, 48);
      next.structuralDensity = clamp(next.structuralDensity * rng.between(1.10, 1.34), 7, 20);
      next.microDetail = clamp(next.microDetail * rng.between(1.10, 1.36), 0.018, 0.080);
      next.arcOpacity = clamp(next.arcOpacity * 0.45, 0.010, 0.045);
    }
    else if (grammarIndex === 2) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * rng.between(0.62, 0.82), 18, 52));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * rng.between(0.58, 0.78), 12, 34);
      next.structuralDensity = clamp(next.structuralDensity * rng.between(0.70, 0.92), 4, 14);
      next.noiseWeight = clamp(next.noiseWeight * 0.62, 0.32, 0.85);
      next.arcOpacity = clamp(next.arcOpacity * rng.between(1.75, 2.35), 0.075, 0.18);
    }
    else if (grammarIndex === 3) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * rng.between(0.72, 0.94), 20, 58));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * rng.between(0.70, 0.95), 14, 40);
      next.structuralDensity = clamp(next.structuralDensity * rng.between(1.20, 1.50), 8, 22);
      next.noiseWeight = clamp(next.noiseWeight * rng.between(1.18, 1.45), 0.62, 1.38);
      next.arcOpacity = clamp(next.arcOpacity * 0.34, 0.008, 0.036);
    }
    else if (grammarIndex === 4) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * rng.between(0.55, 0.75), 16, 46));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * rng.between(0.55, 0.76), 12, 32);
      next.structuralDensity = clamp(next.structuralDensity * rng.between(0.62, 0.84), 4, 13);
      next.arcOpacity = clamp(next.arcOpacity * rng.between(2.0, 2.8), 0.09, 0.20);
      next.noiseWeight = clamp(next.noiseWeight * 0.72, 0.34, 0.92);
    }
    else {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * rng.between(1.15, 1.45), 30, 78));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * rng.between(1.18, 1.50), 24, 58);
      next.structuralDensity = clamp(next.structuralDensity * rng.between(0.60, 0.82), 4, 13);
      next.noiseWeight = clamp(next.noiseWeight * rng.between(1.28, 1.58), 0.70, 1.48);
      next.microDetail = clamp(next.microDetail * rng.between(1.25, 1.55), 0.022, 0.085);
      next.arcOpacity = clamp(next.arcOpacity * 0.28, 0.006, 0.032);
    }

    return next;
  }

  function applyGrammar(profile) {
    if (!profile?.identity || !profile?.geometry || !profile?.quality) {
      return profile;
    }

    const geometryRng = randomFor(profile);
    const grammarIndex = chooseGrammar(geometryRng);
    const grammar = GRAMMARS[grammarIndex];
    const qualityRng = derivedRandom(
      profile,
      0xbb67ae85 ^ Math.imul(grammarIndex + 1, 0x85ebca6b)
    );
    const geometry = cloneGeometry(profile.geometry);
    const baseSpecies = geometry.species;

    geometryTransforms[grammarIndex](geometry, geometryRng);

    geometry.baseSpecies = baseSpecies;
    geometry.grammar = grammar;
    geometry.grammarIndex = grammarIndex;
    geometry.species = grammar;
    // Os pisos de enquadramento saíram na V13 (ver presence).

    return {
      ...profile,
      version: VERSION,
      geometry,
      quality: applyQualityGrammar(profile.quality, grammarIndex, qualityRng)
    };
  }

  function createProfile() {
    return applyGrammar(baseCreateProfile());
  }

  function tuneQualityFromRuntime(profile, fps) {
    const tuned = baseTuneQuality(profile, fps);
    if (!tuned?.geometry?.grammar) {
      return applyGrammar(tuned);
    }

    const grammarIndex = tuned.geometry.grammarIndex;
    const qualityRng = derivedRandom(
      tuned,
      0xbb67ae85 ^ Math.imul(grammarIndex + 1, 0x85ebca6b)
    );

    return {
      ...tuned,
      version: VERSION,
      quality: applyQualityGrammar(tuned.quality, grammarIndex, qualityRng)
    };
  }

  window.MPAdaptiveArt = {
    ...baseApi,
    version: VERSION,
    grammars: [...GRAMMARS],
    createProfile,
    tuneQualityFromRuntime,
    resetIdentity: baseResetIdentity
  };
})();