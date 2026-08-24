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

  function stream(rootHash, salt) {
    return mulberry32(mix32((rootHash >>> 0) ^ (salt >>> 0)));
  }

  function between(rng, min, max) {
    return lerp(min, max, rng());
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

  function chooseGrammar(identity) {
    const override = readGrammarOverride();
    if (override !== null) return override;

    const gpuHash = identity?.gpuHash >>> 0;
    const rootHash = identity?.hash >>> 0;
    return mix32(rootHash ^ Math.imul(gpuHash, 0x27d4eb2d)) % GRAMMARS.length;
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

  function transformColor(color, contrast = 1, bias = 0) {
    return color.map(channel =>
      clamp(0.5 + (channel - 0.5) * contrast + bias, 0, 1)
    );
  }

  function desaturate(color, amount) {
    const gray = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
    return color.map(channel => lerp(channel, gray, amount));
  }

  function forEachMass(geometry, callback) {
    const count = clamp(geometry.activeMasses || 6, 0, 6);
    for (let index = 0; index < count; index++) {
      callback(index, index * 4);
    }
  }

  function forEachCavity(geometry, callback) {
    const count = clamp(geometry.activeCavities || 3, 0, 3);
    for (let index = 0; index < count; index++) {
      callback(index, index * 4);
    }
  }

  function applyOrganic(geometry, rng) {
    geometry.renderMode = 0;
    geometry.flowStrength = between(rng, 0.13, 0.23);
    geometry.flowX = between(rng, 0.7, 2.8);
    geometry.flowY = between(rng, 0.7, 3.2);
    geometry.warpA = between(rng, 0.10, 0.18);
    geometry.warpB = between(rng, 0.08, 0.16);
    geometry.warpScaleA = between(rng, 0.65, 1.8);
    geometry.warpScaleB = between(rng, 1.2, 3.0);
    geometry.faultStrength = between(rng, 0.0, 0.055);
    geometry.foldFrequencyA = between(rng, 0.8, 2.5);
    geometry.foldFrequencyB = between(rng, 1.2, 3.4);
    geometry.foldStrengthA = between(rng, 0.045, 0.10);
    geometry.foldStrengthB = between(rng, 0.025, 0.075);
    geometry.asymmetry = between(rng, 0.58, 0.92);

    forEachMass(geometry, (_index, offset) => {
      geometry.masses[offset] += between(rng, -0.08, 0.08);
      geometry.masses[offset + 1] += between(rng, -0.07, 0.07);
      geometry.masses[offset + 2] *= between(rng, 1.05, 1.34);
      geometry.masses[offset + 3] *= between(rng, 0.95, 1.28);
      geometry.massMeta[offset] += between(rng, -0.34, 0.34);
      geometry.massMeta[offset + 1] += between(rng, -0.28, 0.28);
    });

    geometry.lineColor = transformColor(geometry.lineColor, 1.05, 0.02);
    geometry.accentColor = transformColor(geometry.accentColor, 1.08, 0.0);
  }

  function applyGeological(geometry, rng) {
    geometry.renderMode = 5;
    geometry.faultStrength = between(rng, 0.14, 0.23);
    geometry.faultAngle = between(rng, -1.5, 1.5);
    geometry.faultOffset = between(rng, -0.30, 0.30);
    geometry.foldFrequencyA = between(rng, 3.5, 7.0);
    geometry.foldFrequencyB = between(rng, 4.5, 9.5);
    geometry.foldStrengthA = between(rng, 0.065, 0.12);
    geometry.foldStrengthB = between(rng, 0.040, 0.085);
    geometry.flowStrength = between(rng, 0.035, 0.095);
    geometry.warpA = between(rng, 0.035, 0.085);
    geometry.warpB = between(rng, 0.025, 0.070);
    geometry.asymmetry = between(rng, 0.35, 0.74);

    forEachCavity(geometry, (_index, offset) => {
      geometry.cavities[offset + 2] *= between(rng, 1.15, 1.65);
      geometry.cavities[offset + 3] *= between(rng, 1.10, 1.55);
      geometry.cavityMeta[offset + 1] = clamp(
        geometry.cavityMeta[offset + 1] * between(rng, 1.25, 1.70),
        0,
        0.62
      );
      geometry.cavityMeta[offset + 3] = clamp(
        geometry.cavityMeta[offset + 3] * between(rng, 1.10, 1.45),
        0,
        0.94
      );
    });

    geometry.lineColor = transformColor(geometry.lineColor, 1.18, -0.03);
    geometry.accentColor = transformColor(geometry.accentColor, 1.22, -0.05);
  }

  function applyTechnical(geometry, rng) {
    geometry.renderMode = 1;
    geometry.flowStrength = between(rng, 0.018, 0.050);
    geometry.warpA = between(rng, 0.012, 0.040);
    geometry.warpB = between(rng, 0.010, 0.032);
    geometry.faultStrength = between(rng, 0.0, 0.045);
    geometry.foldStrengthA = between(rng, 0.006, 0.025);
    geometry.foldStrengthB = between(rng, 0.004, 0.018);
    geometry.asymmetry = between(rng, 0.08, 0.30);

    forEachMass(geometry, (index, offset) => {
      const snap = Math.PI / 4;
      geometry.massMeta[offset] =
        Math.round(geometry.massMeta[offset] / snap) * snap;
      geometry.massMeta[offset + 1] *= between(rng, 0.25, 0.55);
      geometry.masses[offset + 2] *= index % 2 === 0 ? 1.15 : 0.88;
      geometry.masses[offset + 3] *= index % 2 === 0 ? 0.88 : 1.15;
    });

    geometry.lineColor = desaturate(transformColor(geometry.lineColor, 1.28, -0.02), 0.20);
    geometry.accentColor = desaturate(transformColor(geometry.accentColor, 1.30, -0.05), 0.12);
  }

  function applyFragmented(geometry, rng) {
    geometry.renderMode = 3;
    geometry.flowStrength = between(rng, 0.10, 0.18);
    geometry.warpA = between(rng, 0.055, 0.12);
    geometry.warpB = between(rng, 0.040, 0.10);
    geometry.faultStrength = between(rng, 0.11, 0.21);
    geometry.foldFrequencyA = between(rng, 5.0, 9.0);
    geometry.foldFrequencyB = between(rng, 6.0, 11.0);
    geometry.foldStrengthA = between(rng, 0.035, 0.075);
    geometry.foldStrengthB = between(rng, 0.020, 0.060);
    geometry.asymmetry = between(rng, 0.64, 0.96);

    forEachMass(geometry, (index, offset) => {
      const x = geometry.masses[offset];
      const y = geometry.masses[offset + 1];
      const push = between(rng, 1.12, 1.42);
      geometry.masses[offset] = x * push + between(rng, -0.12, 0.12);
      geometry.masses[offset + 1] = y * push + between(rng, -0.10, 0.10);
      geometry.masses[offset + 2] *= between(rng, 0.70, 1.02);
      geometry.masses[offset + 3] *= between(rng, 0.66, 0.98);
      geometry.massMeta[offset] += (index % 2 ? 1 : -1) * between(rng, 0.24, 0.70);
      geometry.massMeta[offset + 1] += between(rng, -0.52, 0.52);
    });

    geometry.lineColor = transformColor(geometry.lineColor, 1.24, -0.035);
    geometry.accentColor = transformColor(geometry.accentColor, 1.32, -0.06);
  }

  function applyRadial(geometry, rng) {
    geometry.renderMode = 2;
    const centerX = between(rng, -0.14, 0.14);
    const centerY = between(rng, -0.10, 0.10);
    const radiusX = between(rng, 0.42, 0.70);
    const radiusY = between(rng, 0.30, 0.54);
    const phaseOffset = between(rng, -Math.PI, Math.PI);

    forEachMass(geometry, (index, offset) => {
      const angle = phaseOffset + (index / Math.max(1, geometry.activeMasses)) * Math.PI * 2;
      geometry.masses[offset] = centerX + Math.cos(angle) * radiusX * between(rng, 0.72, 1.0);
      geometry.masses[offset + 1] = centerY + Math.sin(angle) * radiusY * between(rng, 0.72, 1.0);
      geometry.masses[offset + 2] *= between(rng, 0.78, 1.16);
      geometry.masses[offset + 3] *= between(rng, 0.78, 1.16);
      geometry.massMeta[offset] = angle + Math.PI / 2;
      geometry.massMeta[offset + 1] *= 0.35;
    });

    if ((geometry.activeCavities || 0) > 0) {
      geometry.cavities[0] = centerX;
      geometry.cavities[1] = centerY;
      geometry.cavities[2] = between(rng, 0.11, 0.24);
      geometry.cavities[3] = between(rng, 0.09, 0.20);
      geometry.cavityMeta[1] = between(rng, 0.34, 0.58);
      geometry.cavityMeta[3] = between(rng, 0.54, 0.88);
    }

    geometry.flowStrength = between(rng, 0.06, 0.13);
    geometry.warpA = between(rng, 0.025, 0.070);
    geometry.warpB = between(rng, 0.025, 0.070);
    geometry.faultStrength = between(rng, 0.0, 0.035);
    geometry.asymmetry = between(rng, 0.16, 0.42);
  }

  function applyInterference(geometry, rng) {
    geometry.renderMode = 4;
    geometry.flowStrength = between(rng, 0.15, 0.24);
    geometry.flowX = between(rng, 4.5, 8.0);
    geometry.flowY = between(rng, 4.5, 8.5);
    geometry.warpA = between(rng, 0.075, 0.14);
    geometry.warpB = between(rng, 0.060, 0.13);
    geometry.warpScaleA = between(rng, 2.8, 5.5);
    geometry.warpScaleB = between(rng, 4.0, 8.0);
    geometry.faultStrength = between(rng, 0.045, 0.13);
    geometry.foldFrequencyA = between(rng, 7.0, 13.0);
    geometry.foldFrequencyB = between(rng, 8.0, 15.0);
    geometry.foldStrengthA = between(rng, 0.018, 0.052);
    geometry.foldStrengthB = between(rng, 0.016, 0.048);
    geometry.asymmetry = between(rng, 0.44, 0.86);

    forEachMass(geometry, (index, offset) => {
      const band = (index - 2.5) * between(rng, 0.10, 0.18);
      geometry.masses[offset] += band;
      geometry.masses[offset + 1] += Math.sin(index * 1.7) * between(rng, 0.08, 0.18);
      geometry.massMeta[offset] += between(rng, -0.18, 0.18);
      geometry.massMeta[offset + 1] += between(rng, -0.38, 0.38);
    });

    geometry.lineColor = transformColor(geometry.lineColor, 1.30, -0.02);
    geometry.accentColor = transformColor(geometry.accentColor, 1.36, -0.07);
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
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * between(rng, 0.72, 0.92), 20, 62));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * between(rng, 0.72, 0.92), 14, 44);
      next.structuralDensity = clamp(next.structuralDensity * between(rng, 0.78, 1.0), 4, 17);
      next.noiseWeight = clamp(next.noiseWeight * between(rng, 1.08, 1.28), 0.45, 1.28);
      next.arcOpacity = clamp(next.arcOpacity * 0.50, 0.012, 0.050);
    }
    else if (grammarIndex === 1) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * between(rng, 0.92, 1.12), 24, 68));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * between(rng, 0.88, 1.10), 18, 48);
      next.structuralDensity = clamp(next.structuralDensity * between(rng, 1.10, 1.34), 7, 20);
      next.microDetail = clamp(next.microDetail * between(rng, 1.10, 1.36), 0.018, 0.080);
      next.arcOpacity = clamp(next.arcOpacity * 0.45, 0.010, 0.045);
    }
    else if (grammarIndex === 2) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * between(rng, 0.62, 0.82), 18, 52));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * between(rng, 0.58, 0.78), 12, 34);
      next.structuralDensity = clamp(next.structuralDensity * between(rng, 0.70, 0.92), 4, 14);
      next.noiseWeight = clamp(next.noiseWeight * 0.62, 0.32, 0.85);
      next.arcOpacity = clamp(next.arcOpacity * between(rng, 1.75, 2.35), 0.075, 0.18);
    }
    else if (grammarIndex === 3) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * between(rng, 0.72, 0.94), 20, 58));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * between(rng, 0.70, 0.95), 14, 40);
      next.structuralDensity = clamp(next.structuralDensity * between(rng, 1.20, 1.50), 8, 22);
      next.noiseWeight = clamp(next.noiseWeight * between(rng, 1.18, 1.45), 0.62, 1.38);
      next.arcOpacity = clamp(next.arcOpacity * 0.34, 0.008, 0.036);
    }
    else if (grammarIndex === 4) {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * between(rng, 0.55, 0.75), 16, 46));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * between(rng, 0.55, 0.76), 12, 32);
      next.structuralDensity = clamp(next.structuralDensity * between(rng, 0.62, 0.84), 4, 13);
      next.arcOpacity = clamp(next.arcOpacity * between(rng, 2.0, 2.8), 0.09, 0.20);
      next.noiseWeight = clamp(next.noiseWeight * 0.72, 0.34, 0.92);
    }
    else {
      next.fineLineDensity = Math.round(clamp(next.fineLineDensity * between(rng, 1.15, 1.45), 30, 78));
      next.secondaryLineDensity = clamp(next.secondaryLineDensity * between(rng, 1.18, 1.50), 24, 58);
      next.structuralDensity = clamp(next.structuralDensity * between(rng, 0.60, 0.82), 4, 13);
      next.noiseWeight = clamp(next.noiseWeight * between(rng, 1.28, 1.58), 0.70, 1.48);
      next.microDetail = clamp(next.microDetail * between(rng, 1.25, 1.55), 0.022, 0.085);
      next.arcOpacity = clamp(next.arcOpacity * 0.28, 0.006, 0.032);
    }

    return next;
  }

  function applyGrammar(profile) {
    if (!profile?.identity || !profile?.geometry || !profile?.quality) {
      return profile;
    }

    const grammarIndex = chooseGrammar(profile.identity);
    const grammar = GRAMMARS[grammarIndex];
    const root = profile.identity.detailHash || profile.identity.hash || 1;
    const geometryRng = stream(root, 0x6a09e667 ^ Math.imul(grammarIndex + 1, 0x9e3779b1));
    const qualityRng = stream(root, 0xbb67ae85 ^ Math.imul(grammarIndex + 1, 0x85ebca6b));
    const geometry = cloneGeometry(profile.geometry);
    const baseSpecies = geometry.species;

    geometryTransforms[grammarIndex](geometry, geometryRng);

    geometry.baseSpecies = baseSpecies;
    geometry.grammar = grammar;
    geometry.grammarIndex = grammarIndex;
    geometry.species = grammar;
    geometry.rightFadeStart = Math.max(geometry.rightFadeStart || 0, 0.82);
    geometry.fadeWidth = Math.max(geometry.fadeWidth || 0, 0.72);
    geometry.fadeStrength = Math.min(geometry.fadeStrength ?? 0.2, 0.18);
    geometry.verticalFade = Math.max(geometry.verticalFade || 0, 0.94);

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
    const root = tuned.identity?.detailHash || tuned.identity?.hash || 1;
    const qualityRng = stream(root, 0xbb67ae85 ^ Math.imul(grammarIndex + 1, 0x85ebca6b));

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