(() => {
  "use strict";

  if (!window.MPAdaptiveArt) {
    console.error("adaptive-profile.js precisa carregar antes de topology-v11.js.");
    return;
  }

  const VERSION = "mp-art-v11";
  const TOPOLOGY_NAMES = [
    "ribbon",
    "shell",
    "fracture",
    "vortex",
    "ridge",
    "lattice",
    "cloud",
    "bifurcation",
    "crater",
    "shards"
  ];

  const baseApi = window.MPAdaptiveArt;
  const baseCreateProfile = baseApi.createProfile.bind(baseApi);
  const baseTuneQuality = baseApi.tuneQualityFromRuntime.bind(baseApi);
  const baseResetIdentity = baseApi.resetIdentity.bind(baseApi);

  let lastProfile = null;

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

  function ensureArrays(geometry) {
    if (!Array.isArray(geometry.masses)) geometry.masses = [];
    if (!Array.isArray(geometry.massMeta)) geometry.massMeta = [];
    if (!Array.isArray(geometry.cavities)) geometry.cavities = [];
    if (!Array.isArray(geometry.cavityMeta)) geometry.cavityMeta = [];

    geometry.masses.length = 24;
    geometry.massMeta.length = 24;
    geometry.cavities.length = 12;
    geometry.cavityMeta.length = 12;
  }

  function clearGeometry(geometry) {
    ensureArrays(geometry);

    for (let i = 0; i < 6; i++) {
      const offset = i * 4;
      geometry.masses[offset] = 4 + i;
      geometry.masses[offset + 1] = 4 + i;
      geometry.masses[offset + 2] = 0.02;
      geometry.masses[offset + 3] = 0.02;
      geometry.massMeta[offset] = 0;
      geometry.massMeta[offset + 1] = 0;
      geometry.massMeta[offset + 2] = 0.25;
      geometry.massMeta[offset + 3] = 0;
    }

    for (let i = 0; i < 3; i++) {
      const offset = i * 4;
      geometry.cavities[offset] = 4 + i;
      geometry.cavities[offset + 1] = 4 + i;
      geometry.cavities[offset + 2] = 0.02;
      geometry.cavities[offset + 3] = 0.02;
      geometry.cavityMeta[offset] = 0;
      geometry.cavityMeta[offset + 1] = 0;
      geometry.cavityMeta[offset + 2] = 0;
      geometry.cavityMeta[offset + 3] = 0;
    }
  }

  function setMass(geometry, index, {
    x,
    y,
    rx,
    ry,
    angle = 0,
    shear = 0,
    weight = 1,
    phase = 0
  }) {
    const offset = index * 4;
    geometry.masses[offset] = x;
    geometry.masses[offset + 1] = y;
    geometry.masses[offset + 2] = Math.max(0.025, rx);
    geometry.masses[offset + 3] = Math.max(0.025, ry);
    geometry.massMeta[offset] = angle;
    geometry.massMeta[offset + 1] = shear;
    geometry.massMeta[offset + 2] = clamp(weight, 0.28, 1.35);
    geometry.massMeta[offset + 3] = phase;
  }

  function setCavity(geometry, index, {
    x,
    y,
    rx,
    ry,
    angle = 0,
    field = 0.24,
    phase = 0,
    cutout = 0.45
  }) {
    const offset = index * 4;
    geometry.cavities[offset] = x;
    geometry.cavities[offset + 1] = y;
    geometry.cavities[offset + 2] = Math.max(0.025, rx);
    geometry.cavities[offset + 3] = Math.max(0.025, ry);
    geometry.cavityMeta[offset] = angle;
    geometry.cavityMeta[offset + 1] = clamp(field, 0, 0.62);
    geometry.cavityMeta[offset + 2] = phase;
    geometry.cavityMeta[offset + 3] = clamp(cutout, 0, 0.94);
  }

  function phase(rng) {
    return rng() * Math.PI * 2;
  }

  function buildRibbon(geometry, rng) {
    const tilt = between(rng, -0.55, 0.55);
    const wave = between(rng, 0.08, 0.18);
    const yBase = between(rng, -0.05, 0.08);

    for (let i = 0; i < 6; i++) {
      const t = (i - 2.5) / 2.5;
      setMass(geometry, i, {
        x: t * between(rng, 0.22, 0.30),
        y: yBase + Math.sin(t * Math.PI * 1.25) * wave,
        rx: between(rng, 0.22, 0.35),
        ry: between(rng, 0.045, 0.085),
        angle: tilt + between(rng, -0.14, 0.14),
        shear: between(rng, -0.32, 0.32),
        weight: between(rng, 0.72, 1.16),
        phase: phase(rng)
      });
    }

    setCavity(geometry, 0, {
      x: between(rng, -0.12, 0.12),
      y: yBase + between(rng, -0.04, 0.04),
      rx: between(rng, 0.08, 0.15),
      ry: between(rng, 0.025, 0.05),
      angle: tilt,
      field: 0.16,
      cutout: between(rng, 0.14, 0.34),
      phase: phase(rng)
    });

    geometry.globalAngle = between(rng, -0.42, 0.42);
    geometry.fadeStrength = between(rng, 0.28, 0.56);
    geometry.verticalFade = between(rng, 0.56, 0.76);
    return [6, 1];
  }

  function buildShell(geometry, rng) {
    const centerX = between(rng, -0.10, 0.10);
    const centerY = between(rng, -0.06, 0.08);
    const radiusX = between(rng, 0.34, 0.48);
    const radiusY = between(rng, 0.22, 0.36);
    const start = between(rng, -0.8, 0.15);
    const sweep = between(rng, 4.4, 5.5);

    for (let i = 0; i < 6; i++) {
      const a = start + sweep * (i / 5);
      setMass(geometry, i, {
        x: centerX + Math.cos(a) * radiusX,
        y: centerY + Math.sin(a) * radiusY,
        rx: between(rng, 0.16, 0.25),
        ry: between(rng, 0.055, 0.10),
        angle: a + Math.PI / 2 + between(rng, -0.18, 0.18),
        shear: between(rng, -0.22, 0.22),
        weight: between(rng, 0.72, 1.08),
        phase: phase(rng)
      });
    }

    setCavity(geometry, 0, {
      x: centerX,
      y: centerY,
      rx: radiusX * between(rng, 0.48, 0.66),
      ry: radiusY * between(rng, 0.46, 0.64),
      angle: between(rng, -0.4, 0.4),
      field: between(rng, 0.25, 0.42),
      cutout: between(rng, 0.62, 0.90),
      phase: phase(rng)
    });

    geometry.fadeStrength = between(rng, 0.10, 0.30);
    geometry.verticalFade = between(rng, 0.68, 0.86);
    return [6, 1];
  }

  function buildFracture(geometry, rng) {
    const gap = between(rng, 0.12, 0.22);
    const lean = between(rng, -0.55, 0.55);

    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const row = i % 3;
      setMass(geometry, i, {
        x: side * (gap + between(rng, 0.10, 0.30)) + between(rng, -0.04, 0.04),
        y: (row - 1) * between(rng, 0.20, 0.29) + between(rng, -0.06, 0.06),
        rx: between(rng, 0.18, 0.33),
        ry: between(rng, 0.075, 0.16),
        angle: lean + side * between(rng, 0.12, 0.48),
        shear: side * between(rng, 0.08, 0.42),
        weight: between(rng, 0.68, 1.12),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < 3; i++) {
      setCavity(geometry, i, {
        x: between(rng, -0.035, 0.035),
        y: (i - 1) * between(rng, 0.20, 0.29),
        rx: between(rng, 0.055, 0.095),
        ry: between(rng, 0.18, 0.30),
        angle: lean + between(rng, -0.20, 0.20),
        field: between(rng, 0.25, 0.48),
        cutout: between(rng, 0.56, 0.88),
        phase: phase(rng)
      });
    }

    geometry.faultStrength = Math.max(geometry.faultStrength || 0, between(rng, 0.10, 0.17));
    geometry.fadeStrength = between(rng, 0.16, 0.40);
    geometry.verticalFade = between(rng, 0.72, 0.88);
    return [6, 3];
  }

  function buildVortex(geometry, rng) {
    const centerX = between(rng, -0.08, 0.08);
    const centerY = between(rng, -0.06, 0.06);
    const spin = rng() < 0.5 ? -1 : 1;
    const start = between(rng, -Math.PI, Math.PI);

    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const a = start + spin * t * between(rng, 3.7, 5.2);
      const radius = lerp(between(rng, 0.42, 0.54), between(rng, 0.08, 0.16), t);
      setMass(geometry, i, {
        x: centerX + Math.cos(a) * radius,
        y: centerY + Math.sin(a) * radius * between(rng, 0.70, 0.92),
        rx: lerp(between(rng, 0.20, 0.28), between(rng, 0.10, 0.16), t),
        ry: lerp(between(rng, 0.075, 0.11), between(rng, 0.045, 0.075), t),
        angle: a + spin * Math.PI / 2,
        shear: spin * between(rng, 0.12, 0.40),
        weight: lerp(0.76, 1.12, t),
        phase: phase(rng)
      });
    }

    setCavity(geometry, 0, {
      x: centerX,
      y: centerY,
      rx: between(rng, 0.065, 0.12),
      ry: between(rng, 0.055, 0.10),
      field: between(rng, 0.28, 0.48),
      cutout: between(rng, 0.52, 0.82),
      phase: phase(rng)
    });

    geometry.flowDirection = spin;
    geometry.flowStrength = Math.max(geometry.flowStrength || 0, between(rng, 0.09, 0.16));
    geometry.fadeStrength = between(rng, 0.08, 0.28);
    geometry.verticalFade = between(rng, 0.72, 0.90);
    return [6, 1];
  }

  function buildRidge(geometry, rng) {
    const angle = between(rng, -0.95, 0.95);
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const axisX = Math.cos(angle);
    const axisY = Math.sin(angle);

    for (let i = 0; i < 6; i++) {
      const t = (i - 2.5) / 2.5;
      const zig = (i % 2 === 0 ? -1 : 1) * between(rng, 0.025, 0.08);
      setMass(geometry, i, {
        x: axisX * t * 0.48 + normalX * zig,
        y: axisY * t * 0.48 + normalY * zig,
        rx: between(rng, 0.07, 0.13),
        ry: between(rng, 0.21, 0.36),
        angle: angle + Math.PI / 2 + between(rng, -0.18, 0.18),
        shear: between(rng, -0.26, 0.26),
        weight: i === 2 || i === 3 ? between(rng, 0.98, 1.24) : between(rng, 0.66, 0.98),
        phase: phase(rng)
      });
    }

    setCavity(geometry, 0, {
      x: normalX * between(rng, -0.05, 0.05),
      y: normalY * between(rng, -0.05, 0.05),
      rx: between(rng, 0.035, 0.065),
      ry: between(rng, 0.18, 0.30),
      angle: angle + Math.PI / 2,
      field: 0.18,
      cutout: between(rng, 0.24, 0.46),
      phase: phase(rng)
    });

    geometry.globalAngle = between(rng, -0.28, 0.28);
    geometry.fadeStrength = between(rng, 0.24, 0.48);
    geometry.verticalFade = between(rng, 0.70, 0.88);
    return [6, 1];
  }

  function buildLattice(geometry, rng) {
    const rotation = between(rng, -0.42, 0.42);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    let index = 0;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const px = (col - 1) * between(rng, 0.27, 0.34);
        const py = (row - 0.5) * between(rng, 0.26, 0.34);
        setMass(geometry, index++, {
          x: px * cosR - py * sinR,
          y: px * sinR + py * cosR,
          rx: between(rng, 0.11, 0.18),
          ry: between(rng, 0.09, 0.16),
          angle: rotation + between(rng, -0.25, 0.25),
          shear: between(rng, -0.20, 0.20),
          weight: between(rng, 0.72, 1.05),
          phase: phase(rng)
        });
      }
    }

    for (let i = 0; i < 2; i++) {
      setCavity(geometry, i, {
        x: (i === 0 ? -1 : 1) * between(rng, 0.12, 0.20),
        y: between(rng, -0.05, 0.05),
        rx: between(rng, 0.05, 0.09),
        ry: between(rng, 0.05, 0.10),
        angle: rotation,
        field: between(rng, 0.12, 0.26),
        cutout: between(rng, 0.18, 0.42),
        phase: phase(rng)
      });
    }

    geometry.fadeStrength = between(rng, 0.08, 0.24);
    geometry.verticalFade = between(rng, 0.70, 0.88);
    return [6, 2];
  }

  function buildCloud(geometry, rng) {
    const centerX = between(rng, -0.12, 0.12);
    const centerY = between(rng, -0.08, 0.08);

    for (let i = 0; i < 6; i++) {
      const a = phase(rng);
      const radius = between(rng, 0.10, 0.38);
      setMass(geometry, i, {
        x: centerX + Math.cos(a) * radius,
        y: centerY + Math.sin(a) * radius * between(rng, 0.62, 0.92),
        rx: between(rng, 0.15, 0.30),
        ry: between(rng, 0.12, 0.25),
        angle: between(rng, -1.1, 1.1),
        shear: between(rng, -0.32, 0.32),
        weight: between(rng, 0.62, 1.08),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < 2; i++) {
      setCavity(geometry, i, {
        x: centerX + between(rng, -0.20, 0.20),
        y: centerY + between(rng, -0.14, 0.14),
        rx: between(rng, 0.06, 0.14),
        ry: between(rng, 0.05, 0.12),
        angle: between(rng, -1.0, 1.0),
        field: between(rng, 0.14, 0.34),
        cutout: between(rng, 0.22, 0.56),
        phase: phase(rng)
      });
    }

    geometry.fadeStrength = between(rng, 0.10, 0.28);
    geometry.verticalFade = between(rng, 0.74, 0.90);
    return [6, 2];
  }

  function buildBifurcation(geometry, rng) {
    const lean = between(rng, -0.28, 0.28);

    setMass(geometry, 0, {
      x: between(rng, -0.04, 0.04), y: -0.30,
      rx: between(rng, 0.10, 0.16), ry: between(rng, 0.24, 0.34),
      angle: lean, shear: between(rng, -0.16, 0.16), weight: 1.12, phase: phase(rng)
    });
    setMass(geometry, 1, {
      x: between(rng, -0.03, 0.03), y: 0.00,
      rx: between(rng, 0.11, 0.18), ry: between(rng, 0.23, 0.32),
      angle: lean, shear: between(rng, -0.16, 0.16), weight: 1.08, phase: phase(rng)
    });

    const branchY = between(rng, 0.22, 0.32);
    for (let i = 0; i < 4; i++) {
      const side = i < 2 ? -1 : 1;
      const level = i % 2;
      setMass(geometry, i + 2, {
        x: side * between(rng, 0.18 + level * 0.10, 0.30 + level * 0.13),
        y: branchY + level * between(rng, 0.15, 0.22),
        rx: between(rng, 0.09, 0.16),
        ry: between(rng, 0.20, 0.30),
        angle: lean + side * between(rng, 0.45, 0.82),
        shear: side * between(rng, 0.08, 0.28),
        weight: between(rng, 0.72, 1.02),
        phase: phase(rng)
      });
    }

    setCavity(geometry, 0, {
      x: 0,
      y: branchY + 0.03,
      rx: between(rng, 0.055, 0.10),
      ry: between(rng, 0.08, 0.15),
      field: between(rng, 0.16, 0.30),
      cutout: between(rng, 0.30, 0.58),
      phase: phase(rng)
    });

    geometry.fadeStrength = between(rng, 0.16, 0.36);
    geometry.verticalFade = between(rng, 0.78, 0.92);
    return [6, 1];
  }

  function buildCrater(geometry, rng) {
    const centerX = between(rng, -0.10, 0.10);
    const centerY = between(rng, -0.06, 0.08);

    setMass(geometry, 0, {
      x: centerX,
      y: centerY,
      rx: between(rng, 0.52, 0.72),
      ry: between(rng, 0.30, 0.48),
      angle: between(rng, -0.50, 0.50),
      shear: between(rng, -0.22, 0.22),
      weight: between(rng, 1.12, 1.28),
      phase: phase(rng)
    });

    for (let i = 1; i < 6; i++) {
      const a = (i - 1) / 5 * Math.PI * 2 + between(rng, -0.18, 0.18);
      setMass(geometry, i, {
        x: centerX + Math.cos(a) * between(rng, 0.32, 0.48),
        y: centerY + Math.sin(a) * between(rng, 0.20, 0.34),
        rx: between(rng, 0.12, 0.20),
        ry: between(rng, 0.08, 0.16),
        angle: a,
        shear: between(rng, -0.20, 0.20),
        weight: between(rng, 0.54, 0.82),
        phase: phase(rng)
      });
    }

    setCavity(geometry, 0, {
      x: centerX + between(rng, -0.04, 0.04),
      y: centerY + between(rng, -0.03, 0.03),
      rx: between(rng, 0.24, 0.38),
      ry: between(rng, 0.15, 0.27),
      angle: between(rng, -0.5, 0.5),
      field: between(rng, 0.34, 0.56),
      cutout: between(rng, 0.76, 0.94),
      phase: phase(rng)
    });

    geometry.fadeStrength = between(rng, 0.04, 0.18);
    geometry.verticalFade = between(rng, 0.76, 0.92);
    return [6, 1];
  }

  function buildShards(geometry, rng) {
    const baseAngle = between(rng, -1.10, 1.10);

    for (let i = 0; i < 6; i++) {
      const band = (i - 2.5) / 2.5;
      const side = i % 2 === 0 ? -1 : 1;
      setMass(geometry, i, {
        x: band * between(rng, 0.16, 0.25) + side * between(rng, 0.02, 0.09),
        y: between(rng, -0.36, 0.36),
        rx: between(rng, 0.055, 0.105),
        ry: between(rng, 0.20, 0.40),
        angle: baseAngle + side * between(rng, 0.42, 1.10),
        shear: side * between(rng, 0.18, 0.48),
        weight: between(rng, 0.58, 0.96),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < 2; i++) {
      setCavity(geometry, i, {
        x: (i === 0 ? -1 : 1) * between(rng, 0.08, 0.18),
        y: between(rng, -0.20, 0.20),
        rx: between(rng, 0.035, 0.07),
        ry: between(rng, 0.15, 0.26),
        angle: baseAngle + between(rng, -0.7, 0.7),
        field: between(rng, 0.18, 0.38),
        cutout: between(rng, 0.34, 0.70),
        phase: phase(rng)
      });
    }

    geometry.faultStrength = Math.max(geometry.faultStrength || 0, between(rng, 0.08, 0.16));
    geometry.fadeStrength = between(rng, 0.10, 0.32);
    geometry.verticalFade = between(rng, 0.76, 0.92);
    return [6, 2];
  }

  const BUILDERS = [
    buildRibbon,
    buildShell,
    buildFracture,
    buildVortex,
    buildRidge,
    buildLattice,
    buildCloud,
    buildBifurcation,
    buildCrater,
    buildShards
  ];

  function applyTopologyDNA(profile) {
    if (!profile?.identity || !profile?.geometry) {
      return profile;
    }

    const rootHash = profile.identity.hash >>> 0;
    const speciesSalt = Math.imul((profile.geometry.renderMode || 0) + 1, 0x9e3779b1);
    const topologyHash = mix32(rootHash ^ speciesSalt ^ 0xd1b54a35);
    const topologyIndex = topologyHash % TOPOLOGY_NAMES.length;
    const topology = TOPOLOGY_NAMES[topologyIndex];
    const rng = stream(rootHash, 0x94d049bb ^ topologyHash);
    const geometry = profile.geometry;

    clearGeometry(geometry);
    const [activeMasses, activeCavities] = BUILDERS[topologyIndex](geometry, rng);

    geometry.topology = topology;
    geometry.topologyIndex = topologyIndex;
    geometry.topologyHash = topologyHash;
    geometry.activeMasses = activeMasses;
    geometry.activeCavities = activeCavities;
    geometry.anchorX = geometry.masses[0];
    geometry.anchorY = geometry.masses[1];

    // Mantém o DNA vivo, mas impede que uma anatomia muito extrema
    // destrua a legibilidade da composição em telas pequenas.
    geometry.flowStrength = clamp(geometry.flowStrength, 0.025, 0.17);
    geometry.warpA = clamp(geometry.warpA, 0.018, 0.12);
    geometry.warpB = clamp(geometry.warpB, 0.012, 0.10);
    geometry.fadeStrength = clamp(geometry.fadeStrength, 0.04, 0.62);
    geometry.verticalFade = clamp(geometry.verticalFade, 0.54, 0.92);

    profile.version = VERSION;
    return profile;
  }

  function createProfile() {
    lastProfile = applyTopologyDNA(baseCreateProfile());
    return lastProfile;
  }

  function tuneQualityFromRuntime(profile, fps) {
    const updated = baseTuneQuality(profile, fps);
    if (updated?.geometry?.topology) {
      lastProfile = updated;
      updated.version = VERSION;
      return updated;
    }

    lastProfile = applyTopologyDNA(updated);
    return lastProfile;
  }

  window.MPAdaptiveArt = {
    ...baseApi,
    version: VERSION,
    topologyNames: [...TOPOLOGY_NAMES],
    applyTopologyDNA,
    createProfile,
    tuneQualityFromRuntime,
    resetIdentity: baseResetIdentity,
    getLastProfile: () => lastProfile
  };

  window.addEventListener("DOMContentLoaded", () => {
    const signature = document.getElementById("deviceSignature");
    const profile = lastProfile;

    if (!signature || !profile?.geometry?.topology) {
      return;
    }

    const gpu = profile.identity.gpuHash
      .toString(16)
      .padStart(8, "0")
      .slice(0, 8);

    signature.textContent =
      `GPU ${profile.geometry.species} · ${gpu} · ${profile.geometry.family}/${profile.geometry.topology}`;
  });
})();
