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

    // Antes esta camada era semeada por detailHash, que inclui tela,
    // núcleos e memória: a mesma pessoa via outra peça ao trocar de
    // monitor. Agora consome o gerador da peça, preso ao token.
    const rng = randomFor(profile);
    const detailRng = rng;
    const geometry = copyGeometry(profile.geometry);
    const bias = topologyBias(geometry.topology || geometry.family);
    const activeMasses = clamp(
      Number.isFinite(geometry.activeMasses) ? geometry.activeMasses : 6,
      1,
      LIMITS.maxMasses
    );
    const activeCavities = clamp(
      Number.isFinite(geometry.activeCavities) ? geometry.activeCavities : 3,
      0,
      LIMITS.maxCavities
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

    // presenceScale media 1,16 a 1,34 (CV 0,042): toda peça ocupava a
    // tela do mesmo jeito. Agora vem do arquétipo de escala, cujas
    // faixas são separadas por lacunas — íntimo e transbordante são
    // famílias distintas, não as caudas raras de um sorteio só.
    const scaleRange = geometry.archetypeRanges?.scale || [0.72, 1.92];
    const balance = geometry.archetypeRanges?.balance || {
      driftX: [0, 0.11],
      driftY: [0, 0.08]
    };

    const presenceScale = rng.between(scaleRange[0], scaleRange[1]);
    const spreadX = bias.spreadX * rng.between(0.98, 1.10);
    const spreadY = bias.spreadY * rng.between(0.98, 1.10);
    const radiusX = bias.radiusX * presenceScale * rng.between(0.96, 1.08);
    const radiusY = bias.radiusY * presenceScale * rng.between(0.96, 1.08);

    // O arquétipo de balanço decide o quanto a peça sai do centro; o
    // sinal é sorteado à parte para não enviesar sempre para um lado.
    const driftX = rng.sign() * rng.between(balance.driftX[0], balance.driftX[1]);
    const driftY = rng.sign() * rng.between(balance.driftY[0], balance.driftY[1]);
    const heroIndex = Math.floor(rng.unit() * activeMasses);
    let breakIndex = Math.floor(rng.unit() * activeMasses);

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
        ? detailRng.between(0.085, 0.16)
        : detailRng.between(0.008, 0.045);
      const jitterAngle = detailRng.between(-Math.PI, Math.PI);
      const heroBoost = i === heroIndex
        ? detailRng.between(1.18, 1.36)
        : detailRng.between(0.94, 1.10);

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

      // O arquétipo de ordem decide se os ângulos ficam soltos ou
      // presos a uma grade: ortogonal trava em 90 graus, modular em
      // 45, orgânico e caótico não travam em nada.
      const snap = geometry.archetypeRanges?.order?.snap || 0;
      const loosened =
        (geometry.massMeta[offset] || 0) +
        detailRng.between(-0.24, 0.24) +
        (i === breakIndex ? detailRng.between(-0.28, 0.28) : 0);

      geometry.massMeta[offset] = snap > 0
        ? Math.round(loosened / snap) * snap
        : loosened;
      geometry.massMeta[offset + 1] = clamp(
        (geometry.massMeta[offset + 1] || 0) +
          detailRng.between(-0.16, 0.16),
        -0.72,
        0.72
      );
      geometry.massMeta[offset + 2] = clamp(
        (geometry.massMeta[offset + 2] || 1) *
          (i === heroIndex
            ? detailRng.between(1.04, 1.16)
            : detailRng.between(0.93, 1.08)),
        0.28,
        1.35
      );
    }

    for (let i = 0; i < activeCavities; i++) {
      const offset = i * 4;
      const x = geometry.cavities[offset] || 0;
      const y = geometry.cavities[offset + 1] || 0;

      geometry.cavities[offset] = clamp(
        centroidX + (x - centroidX) * spreadX + driftX + detailRng.between(-0.04, 0.04),
        -0.80,
        0.80
      );
      geometry.cavities[offset + 1] = clamp(
        centroidY + (y - centroidY) * spreadY + driftY + detailRng.between(-0.035, 0.035),
        -0.60,
        0.60
      );
      geometry.cavities[offset + 2] = clamp(
        Math.max(0.025, geometry.cavities[offset + 2] || 0.025) *
          detailRng.between(1.12, 1.34),
        0.025,
        0.58
      );
      geometry.cavities[offset + 3] = clamp(
        Math.max(0.025, geometry.cavities[offset + 3] || 0.025) *
          detailRng.between(1.10, 1.30),
        0.025,
        0.52
      );
      geometry.cavityMeta[offset] =
        (geometry.cavityMeta[offset] || 0) +
        detailRng.between(-0.18, 0.18);
      geometry.cavityMeta[offset + 3] = clamp(
        (geometry.cavityMeta[offset + 3] || 0) *
          detailRng.between(0.92, 1.12),
        0,
        0.94
      );
    }

    // Os quatro pisos de enquadramento que existiam aqui
    // (rightFadeStart >= 0.76, fadeWidth >= 0.66, verticalFade >= 0.92
    // e um teto de 0.22 em fadeStrength) saíram na V13. Somados aos
    // pisos de grammar e curation, eles faziam as três dimensões
    // medirem exatamente o mesmo valor em 3.000 sementes. O
    // enquadramento é decidido uma única vez, em adaptive-profile.

    /* -----------------------------------------------------
       O bloco de "imperfeição controlada" que ficava aqui foi
       removido na V13. Ele fazia:

         asymmetry    = max(asymmetry, entre 0,40 e 0,82)
         flowStrength = clamp(flow * ~1,2 + 0,012, 0,035, 0,22)
         warpA/warpB/fault/fold: mesmo padrão de multiplicar e
                                 prender numa faixa estreita

       Ou seja: um piso e um teto aplicados por cima da decisão
       de quem veio antes. Com os arquétipos (V13) isso apagaria
       justamente o que os separa — o piso de asymmetry sozinho
       tornaria impossível uma peça `ortogonal` (0,03-0,20), e o
       clamp de flow engoliria `calmo` (0,004-0,042) e `violento`
       (0,212-0,340) nos dois extremos, devolvendo todo mundo
       para o meio. O arquétipo é a autoridade agora.
    ----------------------------------------------------- */

    /* -----------------------------------------------------
       ATRAVESSAR O VIEWPORT

       DIRECAO DE ARTE, declarada, nao reparo estetico.

       Ate aqui nada garantia que as massas cruzassem a tela. Uma
       composicao de 4 massas podia ocupar x de -0,13 a 0,76 num
       viewport de -0,8 a 0,8 e medir 66% de cobertura, porque os
       34% que faltavam estavam concentrados num bloco so: o canto
       vazio que o dono da obra reclamou, duas vezes.

       Este passo estica as posicoes em torno do centroide ate a
       caixa das massas cruzar a tela nos dois eixos. Ele NAO e o
       expandToViewport da V12: aquele era condicional, disparado
       por nota baixa, e escalava tambem os raios ate empurrar toda
       peca para o mesmo otimo. Este roda sempre, mexe so em
       posicao, e tem teto — o que a peca faz DENTRO da area
       continua livre.
    ----------------------------------------------------- */
    const SPAN_X = 1.46;
    const SPAN_Y = 0.92;

    let boxMinX = Infinity;
    let boxMaxX = -Infinity;
    let boxMinY = Infinity;
    let boxMaxY = -Infinity;

    for (let i = 0; i < activeMasses; i++) {
      const offset = i * 4;
      const rx = geometry.masses[offset + 2];
      const ry = geometry.masses[offset + 3];

      boxMinX = Math.min(boxMinX, geometry.masses[offset] - rx);
      boxMaxX = Math.max(boxMaxX, geometry.masses[offset] + rx);
      boxMinY = Math.min(boxMinY, geometry.masses[offset + 1] - ry);
      boxMaxY = Math.max(boxMaxY, geometry.masses[offset + 1] + ry);
    }

    const stretchX = clamp(SPAN_X / Math.max(0.2, boxMaxX - boxMinX), 1, 2.1);
    const stretchY = clamp(SPAN_Y / Math.max(0.15, boxMaxY - boxMinY), 1, 2.1);
    const boxCenterX = (boxMinX + boxMaxX) * 0.5;
    const boxCenterY = (boxMinY + boxMaxY) * 0.5;

    for (let i = 0; i < activeMasses; i++) {
      const offset = i * 4;

      geometry.masses[offset] =
        boxCenterX + (geometry.masses[offset] - boxCenterX) * stretchX;
      geometry.masses[offset + 1] =
        boxCenterY + (geometry.masses[offset + 1] - boxCenterY) * stretchY;
    }

    for (let i = 0; i < activeCavities; i++) {
      const offset = i * 4;

      geometry.cavities[offset] =
        boxCenterX + (geometry.cavities[offset] - boxCenterX) * stretchX;
      geometry.cavities[offset + 1] =
        boxCenterY + (geometry.cavities[offset + 1] - boxCenterY) * stretchY;
    }

    geometry.viewportStretch = [
      Number(stretchX.toFixed(3)),
      Number(stretchY.toFixed(3))
    ];

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
