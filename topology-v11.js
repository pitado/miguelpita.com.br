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

  const LIMITS = baseApi.LIMITS || { maxMasses: 14, maxCavities: 6 };

  function ensureArrays(geometry) {
    if (!Array.isArray(geometry.masses)) geometry.masses = [];
    if (!Array.isArray(geometry.massMeta)) geometry.massMeta = [];
    if (!Array.isArray(geometry.cavities)) geometry.cavities = [];
    if (!Array.isArray(geometry.cavityMeta)) geometry.cavityMeta = [];

    geometry.masses.length = LIMITS.maxMasses * 4;
    geometry.massMeta.length = LIMITS.maxMasses * 4;
    geometry.cavities.length = LIMITS.maxCavities * 4;
    geometry.cavityMeta.length = LIMITS.maxCavities * 4;
  }

  function clearGeometry(geometry) {
    ensureArrays(geometry);

    for (let i = 0; i < LIMITS.maxMasses; i++) {
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

    for (let i = 0; i < LIMITS.maxCavities; i++) {
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
    return rng.unit() * Math.PI * 2;
  }

  /* =========================================================
     TOPOLOGIAS COM CONTAGEM VARIÁVEL (V13)

     As dez topologias emitiam exatamente seis massas cada, com
     índices normalizados na mão (i - 2.5) / 2.5. Agora recebem a
     contagem decidida pelo DNA e distribuem a mesma anatomia por
     2 a 14 massas. O `span` normaliza o índice para -1..1 seja
     qual for a contagem.

     Elas também não escrevem mais fade/verticalFade: enquadramento
     virou decisão única em adaptive-profile, senão volta a existir
     uma cadeia de camadas sobrescrevendo umas às outras.
  ========================================================= */

  function span(index, count) {
    return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
  }

  function buildRibbon(geometry, rng, massCount, cavityCount) {
    const tilt = rng.between(-0.55, 0.55);
    const wave = rng.between(0.08, 0.18);
    const yBase = rng.between(-0.05, 0.08);
    const reach = rng.between(0.55, 0.78);

    for (let i = 0; i < massCount; i++) {
      const t = span(i, massCount);

      setMass(geometry, i, {
        x: t * reach,
        y: yBase + Math.sin(t * Math.PI * 1.25) * wave,
        rx: rng.between(0.22, 0.35),
        ry: rng.between(0.045, 0.085),
        angle: tilt + rng.between(-0.14, 0.14),
        shear: rng.between(-0.32, 0.32),
        weight: rng.between(0.72, 1.16),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      setCavity(geometry, i, {
        x: span(i, Math.max(2, cavityCount)) * rng.between(0.10, 0.34),
        y: yBase + rng.between(-0.04, 0.04),
        rx: rng.between(0.08, 0.15),
        ry: rng.between(0.025, 0.05),
        angle: tilt,
        field: 0.16,
        cutout: rng.between(0.14, 0.34),
        phase: phase(rng)
      });
    }

    geometry.globalAngle = rng.between(-0.42, 0.42);
    return [massCount, cavityCount];
  }

  function buildShell(geometry, rng, massCount, cavityCount) {
    const centerX = rng.between(-0.10, 0.10);
    const centerY = rng.between(-0.06, 0.08);
    const radiusX = rng.between(0.34, 0.48);
    const radiusY = rng.between(0.22, 0.36);
    const start = rng.between(-0.8, 0.15);
    const sweep = rng.between(4.4, 5.5);

    for (let i = 0; i < massCount; i++) {
      const a = start + sweep * (massCount <= 1 ? 0.5 : i / (massCount - 1));

      setMass(geometry, i, {
        x: centerX + Math.cos(a) * radiusX,
        y: centerY + Math.sin(a) * radiusY,
        rx: rng.between(0.16, 0.25),
        ry: rng.between(0.055, 0.10),
        angle: a + Math.PI / 2 + rng.between(-0.18, 0.18),
        shear: rng.between(-0.22, 0.22),
        weight: rng.between(0.72, 1.08),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      const shrink = 1 - i * 0.18;

      setCavity(geometry, i, {
        x: centerX,
        y: centerY,
        rx: radiusX * rng.between(0.48, 0.66) * shrink,
        ry: radiusY * rng.between(0.46, 0.64) * shrink,
        angle: rng.between(-0.4, 0.4),
        field: rng.between(0.25, 0.42),
        cutout: rng.between(0.62, 0.90),
        phase: phase(rng)
      });
    }

    return [massCount, cavityCount];
  }

  function buildFracture(geometry, rng, massCount, cavityCount) {
    const gap = rng.between(0.12, 0.22);
    const lean = rng.between(-0.55, 0.55);
    const perSide = Math.ceil(massCount / 2);

    for (let i = 0; i < massCount; i++) {
      const side = i < perSide ? -1 : 1;
      const row = i % perSide;

      setMass(geometry, i, {
        x: side * (gap + rng.between(0.10, 0.30)) + rng.between(-0.04, 0.04),
        y: span(row, perSide) * rng.between(0.24, 0.42) + rng.between(-0.06, 0.06),
        rx: rng.between(0.18, 0.33),
        ry: rng.between(0.075, 0.16),
        angle: lean + side * rng.between(0.12, 0.48),
        shear: side * rng.between(0.08, 0.42),
        weight: rng.between(0.68, 1.12),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      setCavity(geometry, i, {
        x: rng.between(-0.035, 0.035),
        y: span(i, Math.max(2, cavityCount)) * rng.between(0.22, 0.38),
        rx: rng.between(0.055, 0.095),
        ry: rng.between(0.18, 0.30),
        angle: lean + rng.between(-0.20, 0.20),
        field: rng.between(0.25, 0.48),
        cutout: rng.between(0.56, 0.88),
        phase: phase(rng)
      });
    }

    geometry.faultStrength = Math.max(
      geometry.faultStrength || 0,
      rng.between(0.10, 0.17)
    );
    return [massCount, cavityCount];
  }

  function buildVortex(geometry, rng, massCount, cavityCount) {
    const centerX = rng.between(-0.08, 0.08);
    const centerY = rng.between(-0.06, 0.06);
    const spin = rng.sign();
    const start = rng.between(-Math.PI, Math.PI);
    const turns = rng.between(3.7, 5.2);
    const outer = rng.between(0.42, 0.54);
    const inner = rng.between(0.08, 0.16);
    const squash = rng.between(0.70, 0.92);

    for (let i = 0; i < massCount; i++) {
      const t = massCount <= 1 ? 0 : i / (massCount - 1);
      const a = start + spin * t * turns;
      const radius = lerp(outer, inner, t);

      setMass(geometry, i, {
        x: centerX + Math.cos(a) * radius,
        y: centerY + Math.sin(a) * radius * squash,
        rx: lerp(rng.between(0.20, 0.28), rng.between(0.10, 0.16), t),
        ry: lerp(rng.between(0.075, 0.11), rng.between(0.045, 0.075), t),
        angle: a + spin * Math.PI / 2,
        shear: spin * rng.between(0.12, 0.40),
        weight: lerp(0.76, 1.12, t),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      setCavity(geometry, i, {
        x: centerX + rng.between(-0.06, 0.06) * i,
        y: centerY + rng.between(-0.05, 0.05) * i,
        rx: rng.between(0.065, 0.12),
        ry: rng.between(0.055, 0.10),
        field: rng.between(0.28, 0.48),
        cutout: rng.between(0.52, 0.82),
        phase: phase(rng)
      });
    }

    geometry.flowDirection = spin;
    geometry.flowStrength = Math.max(
      geometry.flowStrength || 0,
      rng.between(0.09, 0.16)
    );
    return [massCount, cavityCount];
  }

  function buildRidge(geometry, rng, massCount, cavityCount) {
    const angle = rng.between(-0.95, 0.95);
    const normalX = -Math.sin(angle);
    const normalY = Math.cos(angle);
    const axisX = Math.cos(angle);
    const axisY = Math.sin(angle);
    const reach = rng.between(0.42, 0.62);
    const hero = Math.floor(massCount / 2);

    for (let i = 0; i < massCount; i++) {
      const t = span(i, massCount);
      const zig = (i % 2 === 0 ? -1 : 1) * rng.between(0.025, 0.08);

      setMass(geometry, i, {
        x: axisX * t * reach + normalX * zig,
        y: axisY * t * reach + normalY * zig,
        rx: rng.between(0.07, 0.13),
        ry: rng.between(0.21, 0.36),
        angle: angle + Math.PI / 2 + rng.between(-0.18, 0.18),
        shear: rng.between(-0.26, 0.26),
        weight: i === hero
          ? rng.between(0.98, 1.24)
          : rng.between(0.66, 0.98),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      const t = span(i, Math.max(2, cavityCount));

      setCavity(geometry, i, {
        x: axisX * t * reach * 0.6 + normalX * rng.between(-0.05, 0.05),
        y: axisY * t * reach * 0.6 + normalY * rng.between(-0.05, 0.05),
        rx: rng.between(0.035, 0.065),
        ry: rng.between(0.18, 0.30),
        angle: angle + Math.PI / 2,
        field: 0.18,
        cutout: rng.between(0.24, 0.46),
        phase: phase(rng)
      });
    }

    geometry.globalAngle = rng.between(-0.28, 0.28);
    return [massCount, cavityCount];
  }

  function buildLattice(geometry, rng, massCount, cavityCount) {
    const rotation = rng.between(-0.42, 0.42);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const cols = Math.max(2, Math.round(Math.sqrt(massCount * 1.6)));
    const rows = Math.ceil(massCount / cols);
    const stepX = rng.between(0.27, 0.34) * (3 / Math.max(2, cols)) * 1.6;
    const stepY = rng.between(0.26, 0.34) * (2 / Math.max(1, rows)) * 1.3;

    for (let i = 0; i < massCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = (col - (cols - 1) / 2) * stepX;
      const py = (row - (rows - 1) / 2) * stepY;

      setMass(geometry, i, {
        x: px * cosR - py * sinR,
        y: px * sinR + py * cosR,
        rx: rng.between(0.11, 0.18),
        ry: rng.between(0.09, 0.16),
        angle: rotation + rng.between(-0.25, 0.25),
        shear: rng.between(-0.20, 0.20),
        weight: rng.between(0.72, 1.05),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      setCavity(geometry, i, {
        x: span(i, Math.max(2, cavityCount)) * rng.between(0.12, 0.30),
        y: rng.between(-0.18, 0.18),
        rx: rng.between(0.05, 0.09),
        ry: rng.between(0.05, 0.10),
        angle: rotation,
        field: rng.between(0.12, 0.26),
        cutout: rng.between(0.18, 0.42),
        phase: phase(rng)
      });
    }

    return [massCount, cavityCount];
  }

  function buildCloud(geometry, rng, massCount, cavityCount) {
    const centerX = rng.between(-0.12, 0.12);
    const centerY = rng.between(-0.08, 0.08);

    for (let i = 0; i < massCount; i++) {
      const a = phase(rng);
      const radius = rng.between(0.10, 0.44);

      setMass(geometry, i, {
        x: centerX + Math.cos(a) * radius,
        y: centerY + Math.sin(a) * radius * rng.between(0.62, 0.92),
        rx: rng.between(0.15, 0.30),
        ry: rng.between(0.12, 0.25),
        angle: rng.between(-1.1, 1.1),
        shear: rng.between(-0.32, 0.32),
        weight: rng.between(0.62, 1.08),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      setCavity(geometry, i, {
        x: centerX + rng.between(-0.24, 0.24),
        y: centerY + rng.between(-0.16, 0.16),
        rx: rng.between(0.06, 0.14),
        ry: rng.between(0.05, 0.12),
        angle: rng.between(-1.0, 1.0),
        field: rng.between(0.14, 0.34),
        cutout: rng.between(0.22, 0.56),
        phase: phase(rng)
      });
    }

    return [massCount, cavityCount];
  }

  function buildBifurcation(geometry, rng, massCount, cavityCount) {
    const lean = rng.between(-0.28, 0.28);
    const trunkCount = Math.max(1, Math.round(massCount / 3));
    const branchCount = massCount - trunkCount;
    const branchY = rng.between(0.22, 0.32);

    for (let i = 0; i < trunkCount; i++) {
      setMass(geometry, i, {
        x: rng.between(-0.04, 0.04),
        y: -0.30 + (trunkCount <= 1 ? 0 : (i / (trunkCount - 1)) * 0.30),
        rx: rng.between(0.10, 0.18),
        ry: rng.between(0.23, 0.34),
        angle: lean,
        shear: rng.between(-0.16, 0.16),
        weight: rng.between(1.02, 1.16),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < branchCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const level = Math.floor(i / 2);

      setMass(geometry, trunkCount + i, {
        x: side * rng.between(0.18 + level * 0.09, 0.30 + level * 0.11),
        y: branchY + level * rng.between(0.13, 0.20),
        rx: rng.between(0.09, 0.16),
        ry: rng.between(0.20, 0.30),
        angle: lean + side * rng.between(0.45, 0.82),
        shear: side * rng.between(0.08, 0.28),
        weight: rng.between(0.72, 1.02),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      setCavity(geometry, i, {
        x: span(i, Math.max(2, cavityCount)) * rng.between(0.06, 0.22),
        y: branchY + 0.03,
        rx: rng.between(0.055, 0.10),
        ry: rng.between(0.08, 0.15),
        field: rng.between(0.16, 0.30),
        cutout: rng.between(0.30, 0.58),
        phase: phase(rng)
      });
    }

    return [massCount, cavityCount];
  }

  function buildCrater(geometry, rng, massCount, cavityCount) {
    const centerX = rng.between(-0.10, 0.10);
    const centerY = rng.between(-0.06, 0.08);

    setMass(geometry, 0, {
      x: centerX,
      y: centerY,
      rx: rng.between(0.52, 0.72),
      ry: rng.between(0.30, 0.48),
      angle: rng.between(-0.50, 0.50),
      shear: rng.between(-0.22, 0.22),
      weight: rng.between(1.12, 1.28),
      phase: phase(rng)
    });

    const ring = Math.max(1, massCount - 1);

    for (let i = 1; i < massCount; i++) {
      const a = ((i - 1) / ring) * Math.PI * 2 + rng.between(-0.18, 0.18);

      setMass(geometry, i, {
        x: centerX + Math.cos(a) * rng.between(0.32, 0.48),
        y: centerY + Math.sin(a) * rng.between(0.20, 0.34),
        rx: rng.between(0.12, 0.20),
        ry: rng.between(0.08, 0.16),
        angle: a,
        shear: rng.between(-0.20, 0.20),
        weight: rng.between(0.54, 0.82),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      const shrink = 1 - i * 0.16;

      setCavity(geometry, i, {
        x: centerX + rng.between(-0.04, 0.04),
        y: centerY + rng.between(-0.03, 0.03),
        rx: rng.between(0.24, 0.38) * shrink,
        ry: rng.between(0.15, 0.27) * shrink,
        angle: rng.between(-0.5, 0.5),
        field: rng.between(0.34, 0.56),
        cutout: rng.between(0.76, 0.94),
        phase: phase(rng)
      });
    }

    return [massCount, cavityCount];
  }

  function buildShards(geometry, rng, massCount, cavityCount) {
    const baseAngle = rng.between(-1.10, 1.10);
    const reach = rng.between(0.42, 0.66);

    for (let i = 0; i < massCount; i++) {
      const band = span(i, massCount);
      const side = i % 2 === 0 ? -1 : 1;

      setMass(geometry, i, {
        x: band * reach + side * rng.between(0.02, 0.09),
        y: rng.between(-0.36, 0.36),
        rx: rng.between(0.055, 0.105),
        ry: rng.between(0.20, 0.40),
        angle: baseAngle + side * rng.between(0.42, 1.10),
        shear: side * rng.between(0.18, 0.48),
        weight: rng.between(0.58, 0.96),
        phase: phase(rng)
      });
    }

    for (let i = 0; i < cavityCount; i++) {
      setCavity(geometry, i, {
        x: span(i, Math.max(2, cavityCount)) * rng.between(0.08, 0.26),
        y: rng.between(-0.20, 0.20),
        rx: rng.between(0.035, 0.07),
        ry: rng.between(0.15, 0.26),
        angle: baseAngle + rng.between(-0.7, 0.7),
        field: rng.between(0.18, 0.38),
        cutout: rng.between(0.34, 0.70),
        phase: phase(rng)
      });
    }

    geometry.faultStrength = Math.max(
      geometry.faultStrength || 0,
      rng.between(0.08, 0.16)
    );
    return [massCount, cavityCount];
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
    const rng = randomFor(profile);

    // Antes o índice saía de `hash % 10` sobre um hash de 32 bits já
    // correlacionado com renderMode: duas topologias praticamente
    // nunca apareciam. Agora é um sorteio uniforme sem viés de módulo.
    const topologyIndex = rng.int(TOPOLOGY_NAMES.length);
    const topology = TOPOLOGY_NAMES[topologyIndex];
    const topologyHash = mix32(
      rootHash ^ Math.imul(topologyIndex + 1, 0x9e3779b1) ^ 0xd1b54a35
    );
    const geometry = profile.geometry;

    const massCount = clamp(
      Math.round(geometry.activeMasses || 6),
      2,
      LIMITS.maxMasses
    );
    const cavityCount = clamp(
      Math.round(geometry.activeCavities ?? 2),
      0,
      LIMITS.maxCavities
    );

    clearGeometry(geometry);
    const [activeMasses, activeCavities] = BUILDERS[topologyIndex](
      geometry,
      rng,
      massCount,
      cavityCount
    );

    geometry.topology = topology;
    geometry.topologyIndex = topologyIndex;
    geometry.topologyHash = topologyHash;
    geometry.activeMasses = activeMasses;
    geometry.activeCavities = activeCavities;
    geometry.anchorX = geometry.masses[0];
    geometry.anchorY = geometry.masses[1];

    // Os clamps de flowStrength/warpA/warpB saíram na V13 junto com
    // os de fade: prendiam o movimento numa faixa estreita e, com os
    // arquétipos de energia, apagariam a diferença entre uma peça
    // calma e uma violenta. Resta apenas o teto de segurança, largo,
    // para uma anatomia extrema não destruir a leitura em tela pequena.
    geometry.flowStrength = clamp(geometry.flowStrength, 0.002, 0.36);
    geometry.warpA = clamp(geometry.warpA, 0.004, 0.22);
    geometry.warpB = clamp(geometry.warpB, 0.003, 0.20);

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
