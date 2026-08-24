(() => {
  "use strict";

  if (!window.MPAdaptiveArt) {
    console.error("topology-v11.js precisa carregar antes de presence-v11.1.js.");
    return;
  }

  const VERSION = "mp-art-v11.1";
  const PRESENCE_VERSION = "v11.1";
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

  function copyGeometry(geometry) {
    return {
      ...geometry,
      masses: Array.isArray(geometry.masses)
        ? geometry.masses.slice()
        : [],
      massMeta: Array.isArray(geometry.massMeta)
        ? geometry.massMeta.slice()
        : [],
      cavities: Array.isArray(geometry.cavities)
        ? geometry.cavities.slice()
        : [],
      cavityMeta: Array.isArray(geometry.cavityMeta)
        ? geometry.cavityMeta.slice()
        : []
    };
  }

  function topologyBias(topology) {
    switch (topology) {
      case "ribbon":
        return { spreadX: 1.18, spreadY: 1.08, radiusX: 1.28, radiusY: 1.22 };
      case "ridge":
      case "bifurcation":
        return { spreadX: 1.16, spreadY: 1.18, radiusX: 1.22, radiusY: 1.28 };
      case "fracture":
      case "shards":
        return { spreadX: 1.24, spreadY: 1.20, radiusX: 1.20, radiusY: 1.20 };
      case "shell":
      case "vortex":
      case "crater":
        return { spreadX: 1.20, spreadY: 1.17, radiusX: 1.25, radiusY: 1.25 };
      default:
        return { spreadX: 1.20, spreadY: 1.16, radiusX: 1.24, radiusY: 1.24 };
    }
  }

  function enhanceGeometry(profile) {
    if (!profile?.geometry || !profile?.identity) {
      return profile;
    }

    if (profile.geometry.presenceVersion === PRESENCE_VERSION) {
      return profile;
    }

    const rootHash = (
      profile.identity.detailHash ??
      profile.identity.hash ??
      0x51f15e77
    ) >>> 0;
    const rng = stream(rootHash, 0x51f15e77);
    const detailRng = stream(rootHash, 0x9e3779b9);
    const geometry = copyGeometry(profile.geometry);
    const bias = topologyBias(geometry.topology || geometry.family);
    const activeMasses = clamp(
      Number.isFinite(geometry.activeMasses) ? geometry.activeMasses : 6,
      1,
      6
    );
    const activeCavities = clamp(
      Number.isFinite(geometry.activeCavities) ? geometry.activeCavities : 3,
      0,
      3
    );

    let centroidX = 0;
    let centroidY = 0;

    for (let i = 0; i < activeMasses; i++) {
      const offset = i * 4;
      centroidX += geometry.masses[offset] || 0;
      centroidY += geometry.masses[offset + 1] || 0;
    }

    centroidX /= activeMasses;
    centroidY /= activeMasses;

    // A composição passa a ocupar a tela como peça principal, não como
    // objeto contido no centro. O valor continua seguro para o mesmo
    // campo normalizado usado pelo shader WebGL1.
    const presenceScale = between(rng, 1.16, 1.34);
    const spreadX = bias.spreadX * between(rng, 0.98, 1.10);
    const spreadY = bias.spreadY * between(rng, 0.98, 1.10);
    const radiusX = bias.radiusX * presenceScale * between(rng, 0.96, 1.08);
    const radiusY = bias.radiusY * presenceScale * between(rng, 0.96, 1.08);
    const driftX = between(rng, -0.11, 0.11);
    const driftY = between(rng, -0.08, 0.08);
    const heroIndex = Math.floor(rng() * activeMasses);
    let breakIndex = Math.floor(rng() * activeMasses);

    if (activeMasses > 1 && breakIndex === heroIndex) {
      breakIndex = (breakIndex + 1) % activeMasses;
    }

    for (let i = 0; i < activeMasses; i++) {
      const offset = i * 4;
      const x = geometry.masses[offset] || 0;
      const y = geometry.masses[offset + 1] || 0;
      const localX = x - centroidX;
      const localY = y - centroidY;
      const localJitter = i === breakIndex
        ? between(detailRng, 0.085, 0.16)
        : between(detailRng, 0.008, 0.045);
      const jitterAngle = between(detailRng, -Math.PI, Math.PI);
      const heroBoost = i === heroIndex
        ? between(detailRng, 1.18, 1.36)
        : between(detailRng, 0.94, 1.10);

      geometry.masses[offset] = clamp(
        centroidX + localX * spreadX + driftX + Math.cos(jitterAngle) * localJitter,
        -0.82,
        0.82
      );
      geometry.masses[offset + 1] = clamp(
        centroidY + localY * spreadY + driftY + Math.sin(jitterAngle) * localJitter,
        -0.62,
        0.62
      );
      geometry.masses[offset + 2] = clamp(
        Math.max(0.025, geometry.masses[offset + 2] || 0.025) * radiusX * heroBoost,
        0.035,
        0.92
      );
      geometry.masses[offset + 3] = clamp(
        Math.max(0.025, geometry.masses[offset + 3] || 0.025) * radiusY * heroBoost,
        0.035,
        0.78
      );

      geometry.massMeta[offset] =
        (geometry.massMeta[offset] || 0) +
        between(detailRng, -0.24, 0.24) +
        (i === breakIndex ? between(detailRng, -0.28, 0.28) : 0);
      geometry.massMeta[offset + 1] = clamp(
        (geometry.massMeta[offset + 1] || 0) +
          between(detailRng, -0.16, 0.16),
        -0.72,
        0.72
      );
      geometry.massMeta[offset + 2] = clamp(
        (geometry.massMeta[offset + 2] || 1) *
          (i === heroIndex
            ? between(detailRng, 1.04, 1.16)
            : between(detailRng, 0.93, 1.08)),
        0.28,
        1.35
      );
    }

    for (let i = 0; i < activeCavities; i++) {
      const offset = i * 4;
      const x = geometry.cavities[offset] || 0;
      const y = geometry.cavities[offset + 1] || 0;

      geometry.cavities[offset] = clamp(
        centroidX + (x - centroidX) * spreadX + driftX + between(detailRng, -0.04, 0.04),
        -0.80,
        0.80
      );
      geometry.cavities[offset + 1] = clamp(
        centroidY + (y - centroidY) * spreadY + driftY + between(detailRng, -0.035, 0.035),
        -0.60,
        0.60
      );
      geometry.cavities[offset + 2] = clamp(
        Math.max(0.025, geometry.cavities[offset + 2] || 0.025) *
          between(detailRng, 1.12, 1.34),
        0.025,
        0.58
      );
      geometry.cavities[offset + 3] = clamp(
        Math.max(0.025, geometry.cavities[offset + 3] || 0.025) *
          between(detailRng, 1.10, 1.30),
        0.025,
        0.52
      );
      geometry.cavityMeta[offset] =
        (geometry.cavityMeta[offset] || 0) +
        between(detailRng, -0.18, 0.18);
      geometry.cavityMeta[offset + 3] = clamp(
        (geometry.cavityMeta[offset + 3] || 0) *
          between(detailRng, 0.92, 1.12),
        0,
        0.94
      );
    }

    // Remove a sensação de moldura/círculo: as bordas não apagam a arte
    // cedo demais e a geometria pode atravessar visualmente o viewport.
    geometry.rightFadeStart = Math.max(0.76, geometry.rightFadeStart || 0.45);
    geometry.fadeWidth = Math.max(0.66, geometry.fadeWidth || 0.55);
    geometry.fadeStrength = clamp(
      (geometry.fadeStrength || 0.30) * between(detailRng, 0.36, 0.68),
      0.045,
      0.22
    );
    geometry.verticalFade = Math.max(0.92, geometry.verticalFade || 0.64);

    // Imperfeição controlada. Não aumenta custo de renderização; apenas
    // desloca os parâmetros que já existem no shader.
    geometry.asymmetry = clamp(
      Math.max(geometry.asymmetry || 0.10, between(detailRng, 0.40, 0.82)),
      0.10,
      0.88
    );
    geometry.flowStrength = clamp(
      (geometry.flowStrength || 0.04) * between(detailRng, 1.12, 1.34) + 0.012,
      0.035,
      0.22
    );
    geometry.warpA = clamp(
      (geometry.warpA || 0.04) * between(detailRng, 1.10, 1.30),
      0.02,
      0.15
    );
    geometry.warpB = clamp(
      (geometry.warpB || 0.035) * between(detailRng, 1.08, 1.26),
      0.016,
      0.13
    );
    geometry.faultStrength = clamp(
      (geometry.faultStrength || 0) * between(detailRng, 1.06, 1.28) +
        between(detailRng, 0.008, 0.035),
      0.008,
      0.22
    );
    geometry.foldStrengthA = clamp(
      (geometry.foldStrengthA || 0.025) * between(detailRng, 1.05, 1.22),
      0.012,
      0.095
    );
    geometry.foldStrengthB = clamp(
      (geometry.foldStrengthB || 0.015) * between(detailRng, 1.04, 1.20),
      0.006,
      0.065
    );

    geometry.anchorX = geometry.masses[0];
    geometry.anchorY = geometry.masses[1];
    geometry.presenceVersion = PRESENCE_VERSION;
    geometry.presenceScale = presenceScale;
    geometry.heroMass = heroIndex;
    geometry.breakMass = breakIndex;

    return {
      ...profile,
      version: VERSION,
      geometry
    };
  }

  function createProfile() {
    return enhanceGeometry(baseCreateProfile());
  }

  function tuneQualityFromRuntime(profile, fps) {
    const currentGeometry = profile?.geometry;
    const updated = baseTuneQuality(profile, fps);

    if (currentGeometry?.presenceVersion === PRESENCE_VERSION) {
      return {
        ...updated,
        version: VERSION,
        geometry: currentGeometry
      };
    }

    return enhanceGeometry(updated);
  }

  window.MPAdaptiveArt = {
    ...baseApi,
    version: VERSION,
    createProfile,
    tuneQualityFromRuntime,
    resetIdentity: baseResetIdentity
  };
})();
