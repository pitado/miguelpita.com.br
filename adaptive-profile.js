(() => {
  "use strict";

  const VERSION = "mp-art-v10";
  const TOKEN_KEY = "mp-art-device-token";
  const LEGACY_TOKEN_KEYS = ["mp-art-v8-device-token"];
  const LEGACY_PROFILE_KEYS = ["mp-art-v8-profile", "mp-art-v9-profile"];
  const UINT32_MAX = 0xffffffff;

  // Teto do DNA. O shader agora recebe estes tamanhos por #define e
  // reduz se a GPU não tiver uniform vectors suficientes.
  const LIMITS = {
    maxMasses: 14,
    maxCavities: 6
  };

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

  /* =========================================================
     ARQUÉTIPOS (V13)

     Antes, cada parâmetro contínuo saía de um sorteio uniforme
     próprio, e vários deles eram somados ou multiplicados entre
     camadas. Soma de uniformes converge para sino: toda dimensão
     media mediana no centro da faixa e a população inteira virava
     uma nuvem em volta da média. Extremos eram raros por
     construção, e "raro nos dois extremos" é o mesmo que "todo
     mundo parecido".

     Agora a amostragem tem dois estágios: sorteia-se primeiro um
     arquétipo discreto e só então um valor DENTRO da faixa dele.
     As faixas são separadas por lacunas de propósito: uma peça
     `calmo` e uma `violento` não têm como se encontrar no meio.
     O resultado é uma população com agrupamentos, não um borrão.
  ========================================================= */

  const ARCHETYPE_WEIGHTS = {
    density: [["esparso", 3], ["equilibrado", 4], ["denso", 3], ["saturado", 2]],
    order: [["ortogonal", 3], ["modular", 3], ["organico", 4], ["caotico", 3]],
    balance: [["centrado", 5], ["descentrado", 4], ["periferico", 1]],
    energy: [["calmo", 3], ["corrente", 4], ["turbulento", 3], ["violento", 2]],
    framing: [["sangrado", 3], ["janela", 3], ["vinheta", 3], ["lateral", 2]],
    scale: [["intimo", 2], ["medio", 4], ["amplo", 3], ["transbordante", 2]]
  };

  const DENSITY_RANGES = {
    esparso: { masses: [4, 6], cavities: [0, 1], lines: [0.64, 0.86] },
    equilibrado: { masses: [5, 7], cavities: [1, 3], lines: [0.84, 1.04] },
    denso: { masses: [8, 11], cavities: [2, 4], lines: [1.14, 1.36] },
    saturado: { masses: [12, 14], cavities: [4, 6], lines: [1.46, 1.72] }
  };

  const ORDER_RANGES = {
    ortogonal: {
      snap: Math.PI / 2,
      shear: [0, 0.07],
      foldFrequency: [0.6, 2.0],
      warpScale: [0.5, 1.4],
      asymmetry: [0.03, 0.20]
    },
    modular: {
      snap: Math.PI / 4,
      shear: [0.05, 0.21],
      foldFrequency: [1.9, 4.2],
      warpScale: [1.2, 2.8],
      asymmetry: [0.17, 0.40]
    },
    organico: {
      snap: 0,
      shear: [0.10, 0.38],
      foldFrequency: [3.6, 7.0],
      warpScale: [2.2, 4.6],
      asymmetry: [0.37, 0.66]
    },
    caotico: {
      snap: 0,
      shear: [0.30, 0.72],
      foldFrequency: [6.2, 12.0],
      warpScale: [3.8, 7.5],
      asymmetry: [0.63, 0.96]
    }
  };

  const ENERGY_RANGES = {
    calmo: {
      flow: [0.004, 0.042], warp: [0.006, 0.032], fault: [0, 0.028],
      fold: [0.004, 0.026], speed: [0.32, 0.60], breathing: [0.002, 0.011]
    },
    corrente: {
      flow: [0.052, 0.104], warp: [0.038, 0.072], fault: [0.034, 0.078],
      fold: [0.034, 0.056], speed: [0.66, 0.96], breathing: [0.014, 0.023]
    },
    turbulento: {
      flow: [0.118, 0.198], warp: [0.082, 0.130], fault: [0.088, 0.150],
      fold: [0.064, 0.094], speed: [1.02, 1.38], breathing: [0.027, 0.036]
    },
    violento: {
      flow: [0.212, 0.340], warp: [0.140, 0.205], fault: [0.160, 0.245],
      fold: [0.104, 0.145], speed: [1.46, 1.95], breathing: [0.040, 0.052]
    }
  };

  const FRAMING_RANGES = {
    // acima de ~1,0 o fade daquele eixo simplesmente não alcança a arte.
    sangrado: {
      fadeStart: [0.94, 1.16], fadeWidth: [0.82, 1.10],
      fadeStrength: [0.02, 0.09], verticalFade: [1.02, 1.24]
    },
    janela: {
      fadeStart: [0.64, 0.86], fadeWidth: [0.52, 0.78],
      fadeStrength: [0.15, 0.29], verticalFade: [0.80, 0.98]
    },
    /* vinheta e lateral foram suavizadas: com a direcao de "sempre
       preenchendo", um fade forte comecando em 0,24 apagava metade
       da tela e recriava o vazio que saiu pela porta da frente.
       Elas seguem existindo como enquadramento, agora como
       tratamento de borda, nao como recorte da composicao. */
    vinheta: {
      fadeStart: [0.46, 0.64], fadeWidth: [0.34, 0.58],
      fadeStrength: [0.24, 0.42], verticalFade: [0.64, 0.80]
    },
    lateral: {
      fadeStart: [0.48, 0.68], fadeWidth: [0.34, 0.62],
      fadeStrength: [0.20, 0.38], verticalFade: [0.96, 1.20]
    }
  };

  /* Direcao de arte: a peca SEMPRE ocupa a tela. O piso subiu de
     0,70 para 1,06, entao o antigo "intimo" virou o menos expansivo
     de uma familia que comeca cheia, nao a peca com respiro em
     volta. As lacunas entre as faixas continuam, para os
     agrupamentos nao virarem nuvem. */
  const SCALE_RANGES = {
    intimo: [1.06, 1.26],
    medio: [1.32, 1.54],
    amplo: [1.60, 1.86],
    transbordante: [1.92, 2.30]
  };

  const BALANCE_RANGES = {
    centrado: { driftX: [0, 0.08], driftY: [0, 0.06] },
    descentrado: { driftX: [0.19, 0.42], driftY: [0.11, 0.28] },
    periferico: { driftX: [0.47, 0.72], driftY: [0.27, 0.47] }
  };

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

  /* =========================================================
     PRNG COM ESTADO (V13)

     Antes: cada grupo de parâmetros abria um mulberry32 próprio
     re-projetado de um hash de 32 bits, e boa parte das decisões
     saía de seedA/seedB (16 bits cada). O token de 128 bits que
     mora no localStorage era esmagado para 32 bits logo na
     entrada, então as ~40 dimensões de geometry eram funções
     correlacionadas de pouquíssima entropia.

     Agora: os 128 bits do token viram diretamente o estado de um
     xoshiro128** e TODA decisão puxa o próximo valor do mesmo
     gerador. Mesmo token, mesma sequência, mesma peça.
  ========================================================= */

  function xoshiro128ss(words) {
    let s0 = words[0] >>> 0;
    let s1 = words[1] >>> 0;
    let s2 = words[2] >>> 0;
    let s3 = words[3] >>> 0;

    // estado todo zero é ponto fixo do xoshiro: troca por constantes.
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

    // Aquecimento obrigatório. As duas primeiras saídas do xoshiro
    // dependem só de s1, então sem isso qualquer entropia que entre
    // pelas outras palavras não aparece nas primeiras decisões.
    for (let i = 0; i < 12; i++) {
      step();
    }

    return step;
  }

  function createRandom(words) {
    const next = xoshiro128ss(words);
    let draws = 0;

    const uint32 = () => {
      draws++;
      return next();
    };

    const unit = () => uint32() / 4294967296;

    const api = {
      uint32,
      unit,

      between(min, max) {
        return lerp(min, max, unit());
      },

      // sem viés de módulo: descarta a cauda incompleta.
      int(bound) {
        const size = Math.floor(bound);

        if (!(size > 1)) {
          return 0;
        }

        const limit = 4294967296 - (4294967296 % size);
        let value = uint32();

        while (value >= limit) {
          value = uint32();
        }

        return value % size;
      },

      pick(list) {
        return list[api.int(list.length)];
      },

      // [["a", 3], ["b", 1]] -> "a" três vezes mais provável.
      weighted(entries) {
        let total = 0;

        for (let i = 0; i < entries.length; i++) {
          total += entries[i][1];
        }

        let ticket = unit() * total;

        for (let i = 0; i < entries.length; i++) {
          ticket -= entries[i][1];

          if (ticket <= 0) {
            return entries[i][0];
          }
        }

        return entries[entries.length - 1][0];
      },

      chance(probability) {
        return unit() < probability;
      },

      sign() {
        return api.chance(0.5) ? -1 : 1;
      },

      skip(count) {
        for (let i = 0; i < count; i++) {
          uint32();
        }
      },

      get draws() {
        return draws;
      }
    };

    return api;
  }

  function wordsFromToken(token, extra) {
    const clean = String(token)
      .replace(/[^0-9a-f]/gi, "")
      .toLowerCase()
      .padEnd(32, "7")
      .slice(0, 32);

    const words = [];

    for (let i = 0; i < 4; i++) {
      words.push(
        Number.parseInt(clean.slice(i * 8, i * 8 + 8), 16) >>> 0
      );
    }

    return seasonWords(words, extra);
  }

  function wordsFromSeed(seed, extra) {
    const words = [];
    let state = seed >>> 0;

    for (let i = 0; i < 4; i++) {
      state = (state + 0x9e3779b9) >>> 0;
      words.push(mix32(state));
    }

    return seasonWords(words, extra);
  }

  // A GPU continua participando da composição (é o conceito do site),
  // mas como tempero sobre 128 bits, nunca como fonte principal de
  // entropia. Entra nas QUATRO palavras: se entrasse só numa, levaria
  // rodadas para alcançar a saída do gerador.
  function seasonWords(words, extra) {
    const salt = extra >>> 0;

    return [
      mix32(words[0] ^ Math.imul(salt + 1, 0x9e3779b1)),
      mix32(words[1] ^ Math.imul(salt + 1, 0x85ebca6b)),
      mix32(words[2] ^ Math.imul(salt + 1, 0xc2b2ae35)),
      mix32(words[3] ^ salt)
    ];
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

  /* =========================================================
     REGIMES DE PALETA (V13)

     Antes: um único molde contínuo em HSL com fundo sempre em
     luminosidade 0.90-0.965 e accent sempre em 0.00-0.26. O matiz
     era livre nos 360 graus, mas num fundo com 93% de luz o matiz
     é invisível, e um accent com 12% de luz engole qualquer
     saturação. Resultado: 3.000 sementes, um visual só.

     Agora: sorteia-se primeiro um REGIME discreto, e cada regime
     traz as próprias faixas de luminosidade e saturação. O fundo
     pode ser escuro. O accent pode ser um meio-tom saturado e
     visível. O contraste mínimo é garantido DENTRO do regime,
     empurrando a luminosidade no sentido que aquele regime pede,
     em vez de clarear todo mundo até o branco.
  ========================================================= */

  /* Direcao de arte: SEMPRE colorido. O regime monocromatico saiu
     e nenhum outro sorteia saturacao baixa. A variedade de cor
     passa a morar no matiz, na relacao entre os tres tons e na
     luminosidade do fundo, nao mais na opcao de nao ter cor. */
  const PALETTE_REGIMES = [
    "claro-pigmentado",
    "escuro-profundo",
    "alto-contraste",
    "complementar",
    "duotonico",
    "saturado-quente",
    "saturado-frio"
  ];

  const PALETTE_WEIGHTS = [
    ["claro-pigmentado", 3],
    ["escuro-profundo", 3],
    ["alto-contraste", 2],
    ["complementar", 3],
    ["duotonico", 3],
    ["saturado-quente", 2],
    ["saturado-frio", 2]
  ];

  // Pisos de saturacao por papel. Nenhum regime desce daqui.
  const SATURATION_FLOOR = {
    background: 0.24,
    line: 0.34,
    accent: 0.58
  };

  // Luminância relativa da WCAG (sRGB linearizado), não a média
  // ponderada ingênua que a curadoria usava antes.
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

  function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);

    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  // Empurra a luminosidade no sentido pedido até bater o alvo de
  // contraste, preservando matiz e saturação. `direction` é +1 para
  // clarear (tema escuro) e -1 para escurecer (tema claro).
  function enforceContrast(tone, backgroundRgb, target, direction) {
    let lightness = tone.l;
    let best = hslToRgb(tone.h, tone.s, lightness);

    for (let step = 0; step < 60; step++) {
      best = hslToRgb(tone.h, tone.s, lightness);

      if (contrastRatio(best, backgroundRgb) >= target) {
        return { h: tone.h, s: tone.s, l: lightness, rgb: best };
      }

      const next = lightness + direction * 0.02;

      if (next < 0 || next > 1) {
        break;
      }

      lightness = next;
    }

    // Beco sem saída dentro do sentido pedido: vai ao extremo dele.
    lightness = clamp(direction > 0 ? 1 : 0, 0, 1);
    best = hslToRgb(tone.h, tone.s, lightness);

    return { h: tone.h, s: tone.s, l: lightness, rgb: best };
  }

  function buildRegimeTones(regime, random) {
    const hue = random.unit() * 360;

    if (regime === "escuro-profundo") {
      const spread = random.between(12, 34);

      return {
        background: { h: hue, s: random.between(0.30, 0.68), l: random.between(0.07, 0.19) },
        line: { h: hue + spread, s: random.between(0.34, 0.72), l: random.between(0.46, 0.68), dir: 1 },
        accent: { h: hue - spread, s: random.between(0.62, 0.94), l: random.between(0.54, 0.78), dir: 1 }
      };
    }

    if (regime === "alto-contraste") {
      const darkBase = random.chance(0.45);
      const accentHue = hue + random.between(130, 230);

      return {
        background: darkBase
          ? { h: hue, s: random.between(0.34, 0.66), l: random.between(0.08, 0.16) }
          : { h: hue, s: random.between(0.26, 0.52), l: random.between(0.84, 0.93) },
        line: darkBase
          ? { h: hue + random.between(-18, 18), s: random.between(0.38, 0.70), l: random.between(0.74, 0.90), dir: 1 }
          : { h: hue + random.between(-18, 18), s: random.between(0.48, 0.82), l: random.between(0.14, 0.28), dir: -1 },
        accent: {
          h: accentHue,
          s: random.between(0.74, 0.96),
          l: random.between(0.40, 0.60),
          dir: darkBase ? 1 : -1
        }
      };
    }

    // Substitui o monocromatico: mesma ideia de conjunto restrito,
    // mas com matizes opostos em vez de ausencia de cor.
    if (regime === "complementar") {
      const opposite = hue + random.between(150, 210);
      const darkBase = random.chance(0.45);

      return {
        background: darkBase
          ? { h: hue, s: random.between(0.34, 0.70), l: random.between(0.10, 0.22) }
          : { h: hue, s: random.between(0.24, 0.48), l: random.between(0.80, 0.91) },
        line: {
          h: hue + random.between(-14, 14),
          s: random.between(0.40, 0.76),
          l: darkBase ? random.between(0.58, 0.78) : random.between(0.26, 0.44),
          dir: darkBase ? 1 : -1
        },
        accent: {
          h: opposite,
          s: random.between(0.70, 0.96),
          l: random.between(0.44, 0.66),
          dir: darkBase ? 1 : -1
        }
      };
    }

    if (regime === "duotonico") {
      const other = hue + random.between(100, 250);
      const darkBase = random.chance(0.45);

      return {
        background: darkBase
          ? { h: hue, s: random.between(0.32, 0.64), l: random.between(0.14, 0.28) }
          : { h: hue, s: random.between(0.26, 0.52), l: random.between(0.78, 0.90) },
        line: {
          h: hue,
          s: random.between(0.38, 0.74),
          l: darkBase ? random.between(0.60, 0.82) : random.between(0.24, 0.44),
          dir: darkBase ? 1 : -1
        },
        accent: {
          h: other,
          s: random.between(0.66, 0.94),
          l: random.between(0.42, 0.68),
          dir: darkBase ? 1 : -1
        }
      };
    }

    if (regime === "saturado-quente" || regime === "saturado-frio") {
      const warm = regime === "saturado-quente";
      const baseHue = warm
        ? random.between(8, 60)
        : random.between(180, 272);
      const spread = random.between(14, 46);
      const darkBase = random.chance(0.45);

      return {
        background: darkBase
          ? { h: baseHue, s: random.between(0.40, 0.74), l: random.between(0.10, 0.22) }
          : { h: baseHue, s: random.between(0.30, 0.58), l: random.between(0.79, 0.90) },
        line: {
          h: baseHue + spread,
          s: random.between(0.44, 0.80),
          l: darkBase ? random.between(0.56, 0.76) : random.between(0.26, 0.44),
          dir: darkBase ? 1 : -1
        },
        accent: {
          h: baseHue - spread,
          s: random.between(0.72, 0.96),
          l: random.between(0.44, 0.68),
          dir: darkBase ? 1 : -1
        }
      };
    }

    // claro-pigmentado: o claro do site antigo, mas com pigmento de
    // verdade. O fundo desceu de 0,88-0,965 para 0,78-0,90: acima
    // disso o matiz simplesmente nao aparece.
    const spread = random.between(12, 34);

    return {
      background: { h: hue, s: random.between(0.26, 0.50), l: random.between(0.78, 0.90) },
      line: { h: hue + spread, s: random.between(0.40, 0.76), l: random.between(0.28, 0.46), dir: -1 },
      accent: { h: hue - spread, s: random.between(0.66, 0.94), l: random.between(0.34, 0.56), dir: -1 }
    };
  }

  function buildPalette(random) {
    const regime = random.weighted(PALETTE_WEIGHTS);
    const tones = buildRegimeTones(regime, random);

    // Rede de seguranca do "sempre colorido": nenhum papel passa
    // abaixo do piso, mesmo que um regime futuro esqueca disso.
    tones.background.s = Math.max(tones.background.s, SATURATION_FLOOR.background);
    tones.line.s = Math.max(tones.line.s, SATURATION_FLOOR.line);
    tones.accent.s = Math.max(tones.accent.s, SATURATION_FLOOR.accent);

    const backgroundColor = hslToRgb(
      tones.background.h,
      tones.background.s,
      tones.background.l
    );

    // A linha carrega a legibilidade da peça: piso WCAG 3:1.
    const line = enforceContrast(
      tones.line,
      backgroundColor,
      3,
      tones.line.dir
    );

    // O accent é a voz cromática, desenhado com opacidade baixa.
    // Piso menor, só para não sumir dentro do fundo.
    const accent = enforceContrast(
      tones.accent,
      backgroundColor,
      1.8,
      tones.accent.dir
    );

    const backgroundLuminance = relativeLuminance(backgroundColor);

    return {
      regime,
      dark: backgroundLuminance < 0.22,
      backgroundLuminance,
      lineContrast: contrastRatio(line.rgb, backgroundColor),
      accentContrast: contrastRatio(accent.rgb, backgroundColor),
      colors: [backgroundColor, line.rgb, accent.rgb]
    };
  }

  // u_seed do shader. Sai do estado de 128 bits, não do gerador
  // vivo, para continuar estável enquanto o gerador avança.
  function seedChannels(words) {
    const digest = mix32(
      words[0] ^ Math.imul(words[1], 0x9e3779b1) ^
      Math.imul(words[2], 0x85ebca6b) ^ Math.imul(words[3], 0xc2b2ae35)
    );

    return {
      seed: digest / UINT32_MAX,
      seedA: mix32(words[0] ^ 0x68bc21eb) / UINT32_MAX,
      seedB: mix32(words[2] ^ 0x02e5be93) / UINT32_MAX
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
      const gpuHash = gpuOverrideHash ?? overrideHash;
      const state = wordsFromSeed(overrideHash, gpuHash);

      return {
        hash: overrideHash,
        ...seedChannels(state),
        state,
        seedKey: `ovr:${overrideHash}:${gpuHash}`,
        token: "seed-override",
        traitsHash: 0,
        tokenHash: 0,
        gpuHash,
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

    // A peça nasce do token (+ GPU). Tela, núcleos e memória entram
    // só em traitsHash/detailHash, que alimentam qualidade — nunca a
    // composição. Trocar de monitor não pode trocar a sua obra.
    const state = wordsFromToken(token, gpuHash);
    const hash = mix32(
      state[0] ^
      Math.imul(state[1], 0x9e3779b1) ^
      Math.imul(state[3], 0x85ebca6b)
    );
    const detailHash = mix32(
      hash ^ Math.imul(traitsHash, 0x85ebca6b)
    );

    return {
      hash,
      ...seedChannels(state),
      state,
      seedKey: `dev:${token}:${gpuHash}`,
      token,
      traitsHash,
      tokenHash,
      gpuHash,
      detailHash,
      renderer,
      source: "device"
    };
  }

  /* =========================================================
     IDENTIDADE E GERADOR MEMOIZADOS

     buildIdentity abre um contexto WebGL a cada chamada, e o
     gerador precisa sobreviver entre chamadas de createProfile
     para que a rejeição da curadoria (V13) possa re-sortear
     avançando a sequência em vez de repetir a mesma peça.
  ========================================================= */

  let identityCache = null;
  let identityCacheKey = null;
  let activeRandom = null;
  let activeRandomKey = null;

  function currentIdentity() {
    let search = "";

    try {
      search = window.location.search || "";
    }
    catch {}

    if (identityCache && identityCacheKey === search) {
      return identityCache;
    }

    identityCache = buildIdentity();
    identityCacheKey = search;

    return identityCache;
  }

  function randomForIdentity(identity) {
    if (activeRandom && activeRandomKey === identity.seedKey) {
      return activeRandom;
    }

    activeRandom = createRandom(identity.state);
    activeRandomKey = identity.seedKey;

    return activeRandom;
  }

  /* =========================================================
     PEÇA DA SESSÃO

     createProfile() agora avança o gerador a cada chamada (é o que
     permite à curadoria rejeitar e re-sortear). Mas art.js, motion
     e internal-theme precisam ver A MESMA peça. getProfile() é o
     acessador memoizado que todos eles usam; resolve
     window.MPAdaptiveArt.createProfile na hora da chamada, então
     sempre pega o topo da pilha de camadas carregada.
  ========================================================= */

  let sessionProfile = null;
  let sessionKey = null;

  function getProfile() {
    const key = currentIdentity().seedKey;

    if (sessionProfile && sessionKey === key) {
      return sessionProfile;
    }

    const factory = window.MPAdaptiveArt?.createProfile || createProfile;

    sessionProfile = factory();
    sessionKey = key;

    return sessionProfile;
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
    // Tempero de estilo: precisa ser reproduzível a cada chamada
    // (tuneQualityFromRuntime roda várias vezes por visita), então
    // sai de um gerador derivado do estado, não do gerador vivo.
    const styleRandom = identity?.state
      ? createRandom([
          mix32(identity.state[0] ^ 0x9e3d1c2b),
          mix32(identity.state[1] ^ 0x1c2b9e3d),
          mix32(identity.state[2] ^ 0x3d1c2b9e),
          mix32(identity.state[3] ^ 0x2b9e3d1c)
        ])
      : null;
    const jitter = () =>
      styleRandom ? styleRandom.between(0.82, 1.18) : 1;

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

  function buildGeometryDNA(identity, random) {
    const rootHash = identity.hash >>> 0;
    const gpuHash = identity.gpuHash >>> 0;

    const familyIndex = random.int(FAMILY_NAMES.length);
    const family = FAMILY_NAMES[familyIndex];
    const renderMode = random.int(GPU_SPECIES.length);
    const species = GPU_SPECIES[renderMode];
    const palette = buildPalette(random);

    // ESTÁGIO 1: arquétipos discretos.
    const archetypes = {
      density: random.weighted(ARCHETYPE_WEIGHTS.density),
      order: random.weighted(ARCHETYPE_WEIGHTS.order),
      balance: random.weighted(ARCHETYPE_WEIGHTS.balance),
      energy: random.weighted(ARCHETYPE_WEIGHTS.energy),
      framing: random.weighted(ARCHETYPE_WEIGHTS.framing),
      scale: random.weighted(ARCHETYPE_WEIGHTS.scale)
    };

    const ranges = {
      density: DENSITY_RANGES[archetypes.density],
      order: ORDER_RANGES[archetypes.order],
      balance: BALANCE_RANGES[archetypes.balance],
      energy: ENERGY_RANGES[archetypes.energy],
      framing: FRAMING_RANGES[archetypes.framing],
      scale: SCALE_RANGES[archetypes.scale]
    };

    // ESTÁGIO 2: valor dentro da faixa daquele arquétipo.
    const inRange = pair => random.between(pair[0], pair[1]);

    const massCount = clamp(
      Math.round(inRange(ranges.density.masses)),
      2,
      LIMITS.maxMasses
    );
    const cavityCount = clamp(
      Math.round(inRange(ranges.density.cavities)),
      0,
      LIMITS.maxCavities
    );

    const mirrorX = random.sign();
    const mirrorY = random.sign();
    const masses = [];
    const massMeta = [];
    const cavities = [];
    const cavityMeta = [];

    let globalAngle = 0;

    /* -----------------------------------------------------
       ENQUADRAMENTO

       rightFadeStart, fadeWidth e verticalFade saíam com faixas
       razoáveis daqui, e depois três camadas aplicavam piso por
       cima: presence forçava >= 0.76/0.66/0.92, grammar >=
       0.82/0.72/0.94 e curation >= 0.86/0.76/0.96. O último piso
       vencia sempre, e por isso os três mediam constante em
       3.000 sementes. Os pisos saíram; esta é a única decisão de
       enquadramento da pilha, e agora ela vem do arquétipo, então
       sangrado e vinheta são famílias separadas, não dois extremos
       raros de um mesmo sorteio uniforme.
    ----------------------------------------------------- */
    const fadeStart = inRange(ranges.framing.fadeStart);
    const fadeWidth = inRange(ranges.framing.fadeWidth);
    const fadeStrength = inRange(ranges.framing.fadeStrength);
    const verticalFade = inRange(ranges.framing.verticalFade);

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

    // Normaliza o índice para -1..1 seja qual for a contagem, para
    // que a mesma família funcione com 2 ou com 14 massas.
    function span(index, count) {
      return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
    }

    if (family === "strata") {
      const anchorX = random.between(-0.16, 0.16);
      const anchorY = random.between(-0.08, 0.08);
      const driftX = random.between(0.10, 0.19);
      const driftY = random.between(0.04, 0.13);
      const hero = Math.floor(massCount / 2);

      globalAngle = random.between(-0.72, 0.72);

      for (let i = 0; i < massCount; i++) {
        const progression = span(i, massCount);

        addMass(
          anchorX + progression * driftX * 2.5 + random.between(-0.035, 0.035),
          anchorY + progression * driftY * 2.5 + random.between(-0.025, 0.025),
          random.between(0.38, 0.68),
          random.between(0.055, 0.13),
          random.between(-0.18, 0.18),
          random.between(-0.34, 0.34),
          i === hero ? random.between(1.02, 1.18) : random.between(0.68, 1.02),
          random.unit() * Math.PI * 2
        );
      }

      for (let i = 0; i < cavityCount; i++) {
        addCavity(
          anchorX + random.between(-0.26, 0.26),
          anchorY + random.between(-0.10, 0.10),
          random.between(0.09, 0.20),
          random.between(0.035, 0.075),
          random.between(-0.35, 0.35),
          random.between(0.08, 0.24),
          random.unit() * Math.PI * 2,
          random.between(0.10, 0.30)
        );
      }
    }
    else if (family === "archipelago") {
      globalAngle = random.between(-0.42, 0.42);

      // Os sítios eram uma lista fixa de cinco posições, o que travava
      // a família em no máximo cinco massas. Agora são gerados.
      const sites = [];

      for (let i = 0; i < massCount; i++) {
        const angle = (i / massCount) * Math.PI * 2 + random.between(-0.5, 0.5);
        const radius = random.between(0.18, 0.52);

        sites.push([
          Math.cos(angle) * radius * 1.35,
          Math.sin(angle) * radius
        ]);
      }

      for (let i = 0; i < massCount; i++) {
        addMass(
          sites[i][0] + random.between(-0.065, 0.065),
          sites[i][1] + random.between(-0.055, 0.055),
          random.between(0.14, 0.27),
          random.between(0.10, 0.22),
          random.between(-1.1, 1.1),
          random.between(-0.48, 0.48),
          random.between(0.66, 1.02),
          random.unit() * Math.PI * 2
        );
      }

      for (let i = 0; i < cavityCount; i++) {
        const target = sites[(i + 1) % sites.length];

        addCavity(
          target[0] + random.between(-0.04, 0.04),
          target[1] + random.between(-0.04, 0.04),
          random.between(0.055, 0.12),
          random.between(0.045, 0.10),
          random.between(-1.2, 1.2),
          random.between(0.10, 0.30),
          random.unit() * Math.PI * 2,
          random.between(0.25, 0.58)
        );
      }
    }
    else if (family === "spine") {
      const anchorX = random.between(-0.11, 0.11);
      const anchorY = random.between(-0.05, 0.05);
      const bend = random.between(0.05, 0.16);
      const reach = random.between(0.44, 0.56);

      globalAngle = random.between(-1.05, 1.05);

      for (let i = 0; i < massCount; i++) {
        const progression = span(i, massCount);

        addMass(
          anchorX + Math.sin(progression * Math.PI * 0.7) * bend +
            random.between(-0.025, 0.025),
          anchorY + progression * reach,
          random.between(0.085, 0.17),
          random.between(0.22, 0.39),
          random.between(-0.22, 0.22),
          random.between(-0.32, 0.32),
          Math.abs(progression) < 0.3
            ? random.between(0.94, 1.14)
            : random.between(0.58, 0.92),
          random.unit() * Math.PI * 2
        );
      }

      for (let i = 0; i < cavityCount; i++) {
        addCavity(
          anchorX + random.between(-0.08, 0.08),
          anchorY + span(i, Math.max(2, cavityCount)) * 0.34,
          random.between(0.035, 0.075),
          random.between(0.10, 0.19),
          random.between(-0.25, 0.25),
          random.between(0.12, 0.34),
          random.unit() * Math.PI * 2,
          random.between(0.22, 0.52)
        );
      }
    }
    else {
      const anchorX = random.between(-0.16, 0.16);
      const anchorY = random.between(-0.08, 0.10);

      globalAngle = random.between(-0.88, 0.88);

      addMass(
        anchorX,
        anchorY,
        random.between(0.56, 0.76),
        random.between(0.29, 0.46),
        random.between(-0.35, 0.35),
        random.between(-0.30, 0.30),
        random.between(1.08, 1.24),
        random.unit() * Math.PI * 2
      );

      for (let i = 1; i < massCount; i++) {
        const side = i % 2 === 0 ? -1 : 1;

        addMass(
          anchorX + side * random.between(0.32, 0.54),
          anchorY + random.between(-0.28, 0.28),
          random.between(0.16, 0.31),
          random.between(0.11, 0.24),
          random.between(-1.0, 1.0),
          random.between(-0.42, 0.42),
          random.between(0.54, 0.88),
          random.unit() * Math.PI * 2
        );
      }

      for (let i = 0; i < cavityCount; i++) {
        addCavity(
          anchorX + random.between(-0.25, 0.25),
          anchorY + random.between(-0.16, 0.16),
          random.between(0.09, 0.22),
          random.between(0.065, 0.16),
          random.between(-1.2, 1.2),
          random.between(0.18, 0.46),
          random.unit() * Math.PI * 2,
          random.between(0.48, 0.88)
        );
      }
    }

    const activeMasses = masses.length / 4;
    const activeCavities = cavities.length / 4;

    // Slots não usados ficam estacionados longe do campo visível com
    // raio mínimo: o shader percorre o array inteiro e o min() ignora
    // quem está longe, sem precisar de laço de tamanho variável (que
    // GLSL ES 1.00 não aceita).
    while (masses.length < LIMITS.maxMasses * 4) {
      const index = masses.length / 4;
      masses.push(4 + index, 4 + index, 0.02, 0.02);
      massMeta.push(0, 0, 0.25, 0);
    }

    while (cavities.length < LIMITS.maxCavities * 4) {
      const index = cavities.length / 4;
      cavities.push(4 + index, 4 + index, 0.02, 0.02);
      cavityMeta.push(0, 0, 0, 0);
    }

    return {
      family,
      familyIndex,
      species,
      renderMode,
      backgroundColor: palette.colors[0],
      lineColor: palette.colors[1],
      accentColor: palette.colors[2],
      paletteRegime: palette.regime,
      paletteDark: palette.dark,
      backgroundLuminance: palette.backgroundLuminance,
      lineContrast: palette.lineContrast,
      accentContrast: palette.accentContrast,
      activeMasses,
      activeCavities,
      anchorX: masses[0],
      anchorY: masses[1],
      globalAngle: globalAngle * mirrorX * mirrorY,
      archetypes,
      archetypeRanges: ranges,

      // ORDER governa o quanto a peça é reta ou desgovernada.
      shear: random.sign() * inRange(ranges.order.shear),
      warpScaleA: inRange(ranges.order.warpScale),
      warpScaleB: inRange(ranges.order.warpScale) * random.between(1.4, 2.2),
      foldFrequencyA: inRange(ranges.order.foldFrequency),
      foldFrequencyB: inRange(ranges.order.foldFrequency) * random.between(1.2, 1.7),
      asymmetry: inRange(ranges.order.asymmetry),

      // ENERGY governa o quanto ela se move e se deforma.
      flowStrength: inRange(ranges.energy.flow),
      warpA: inRange(ranges.energy.warp),
      warpB: inRange(ranges.energy.warp) * random.between(0.62, 0.92),
      faultStrength: inRange(ranges.energy.fault),
      foldStrengthA: inRange(ranges.energy.fold),
      foldStrengthB: inRange(ranges.energy.fold) * random.between(0.45, 0.80),
      animationSpeed: inRange(ranges.energy.speed),
      breathing: inRange(ranges.energy.breathing),

      flowX: random.between(1.0, 5.8),
      flowY: random.between(0.8, 6.2),
      flowDirection: random.sign(),
      faultAngle: random.between(-1.55, 1.55),
      faultOffset: random.between(-0.22, 0.22),
      // Alcance do campo alem do nucleo. Piso alto: toda peca leva
      // o desenho ate as bordas, variando o quanto.
      fieldReach: random.between(3.0, 5.6),
      fieldFill: random.between(0.34, 0.56),

      // Piso que nunca zera: garante textura ate os cantos mesmo
      // quando a composicao e pequena e deslocada. E o que faz o
      // "sempre preenchendo" valer para a cauda, nao so na mediana.
      fieldFloor: random.between(0.13, 0.22),

      rightFadeStart: fadeStart,
      fadeWidth,
      fadeStrength,
      fadeDirection: mirrorX,
      verticalFade,
      linePhase: random.unit() * Math.PI * 2,
      technicalPhase: random.unit() * Math.PI * 2,
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

  // A densidade da peça é escolha de composição, não de hardware: o
  // arquétipo multiplica a densidade de linha que o aparelho aguenta.
  // Usa o meio da faixa, sem consumir o gerador vivo, porque
  // tuneQualityFromRuntime recalcula isto a cada medição de FPS.
  function applyDensityToQuality(quality, geometry) {
    const lines = geometry?.archetypeRanges?.density?.lines;

    if (!lines) {
      return quality;
    }

    const factor = (lines[0] + lines[1]) / 2;

    return {
      ...quality,
      fineLineDensity: Math.round(
        clamp(quality.fineLineDensity * factor, 12, 96)
      ),
      secondaryLineDensity: clamp(
        quality.secondaryLineDensity * factor,
        8,
        70
      ),
      structuralDensity: clamp(
        quality.structuralDensity * (0.6 + factor * 0.5),
        3,
        26
      )
    };
  }

  /* =========================================================
     TEMA DA PÁGINA (V13)

     style.css fixava --bg em #f6f3ee e punha os gradientes de
     .stage e .soft-light em coordenadas constantes. Toda peça
     recebia a mesma moldura por cima: o mesmo brilho em 66% 28%,
     o mesmo véu em 73% 29%, o mesmo grão. Duas peças com DNA
     completamente diferente chegavam ao olho dentro do mesmo
     quadro — e com os regimes de fundo escuro isso passava de
     monótono a quebrado, porque o dock de vidro claro e o texto
     escuro ficam ilegíveis sobre preto.

     Aqui cada um desses valores vira custom property derivada do
     perfil. Os valores originais continuam escritos no :root do
     CSS, então a página sem JS é exatamente a de antes.
  ========================================================= */

  function applyPageTheme(profile) {
    const geometry = profile?.geometry;

    if (!geometry) {
      return null;
    }

    let root = null;

    try {
      root = document.documentElement;
    }
    catch {
      return null;
    }

    if (!root || !root.style || !root.style.setProperty) {
      return null;
    }

    const toRgb = color =>
      `rgb(${color.map(v => Math.round(clamp(v, 0, 1) * 255)).join(", ")})`;

    // Mapeia uma coordenada do campo normalizado do shader para
    // porcentagem de viewport, que é o que o gradiente CSS quer.
    const toX = value => `${clamp(50 + value * 46, 4, 96).toFixed(1)}%`;
    const toY = value => `${clamp(50 - value * 46, 4, 96).toFixed(1)}%`;

    const dark = !!geometry.paletteDark;
    const masses = geometry.masses || [];
    const hero = clamp(geometry.heroMass || 0, 0, 13) * 4;
    const second = masses.length > 8 ? 4 : 0;
    const presence = geometry.presenceScale || 1;
    const density = geometry.archetypes?.density || "equilibrado";

    // O brilho segue a massa protagonista; o véu segue outra massa.
    const theme = {
      "--bg": toRgb(geometry.backgroundColor),
      "--ink": toRgb(geometry.lineColor),

      "--glow-a-x": toX(masses[hero] ?? 0.2),
      "--glow-a-y": toY(masses[hero + 1] ?? 0.1),
      "--glow-a-size": `${clamp(22 + presence * 14, 16, 52).toFixed(0)}%`,
      "--glow-a-alpha": (dark ? 0.06 : 0.22).toFixed(3),

      "--glow-b-x": toX(masses[second] ?? -0.2),
      "--glow-b-y": toY(masses[second + 1] ?? -0.05),
      "--glow-b-size": `${clamp(18 + presence * 12, 14, 46).toFixed(0)}%`,
      "--glow-b-alpha": (dark ? 0.03 : 0.10).toFixed(3),

      "--soft-a-x": toX((masses[hero] ?? 0.2) * 0.82 + 0.12),
      "--soft-a-y": toY((masses[hero + 1] ?? 0.1) * 0.82 + 0.05),
      "--soft-a-size": `${clamp(20 + presence * 11, 14, 44).toFixed(0)}%`,
      "--soft-a-alpha": (dark ? 0.05 : 0.20).toFixed(3),

      "--soft-b-x": toX((masses[second] ?? -0.2) * 0.82 - 0.08),
      "--soft-b-y": toY((masses[second + 1] ?? -0.05) * 0.82),
      "--soft-b-size": `${clamp(16 + presence * 9, 12, 38).toFixed(0)}%`,
      "--soft-b-alpha": (dark ? 0.02 : 0.08).toFixed(3),

      // Peça esparsa aguenta mais grão; peça saturada já tem
      // textura demais e o grão vira sujeira.
      "--grain-opacity": (
        density === "esparso" ? 0.022
        : density === "equilibrado" ? 0.016
        : density === "denso" ? 0.011
        : 0.008
      ).toFixed(3),

      "--glass-tint": dark ? "16, 16, 18" : "255, 255, 255",
      "--glass-border": dark
        ? "rgba(255,255,255,.14)"
        : "rgba(255,255,255,.62)",
      "--glass-top": dark
        ? "rgba(255,255,255,.10)"
        : "rgba(255,255,255,.78)",
      "--shortcut-ink": dark
        ? "rgba(236,236,240,.74)"
        : "rgba(28,28,31,.72)",
      "--shortcut-ink-hover": dark
        ? "rgba(255,255,255,.96)"
        : "rgba(18,18,20,.94)",
      "--signature-ink": dark
        ? "rgba(232,232,238,.42)"
        : "rgba(35,35,38,.42)",
      "--fallback-ink": dark ? "#b9bac0" : "#55565a"
    };

    for (const property in theme) {
      root.style.setProperty(property, theme[property]);
    }

    // A barra do navegador no celular também acompanha a peça.
    try {
      const meta = document.querySelector?.('meta[name="theme-color"]');

      if (meta) {
        meta.setAttribute("content", theme["--bg"]);
      }
    }
    catch {}

    return theme;
  }

  function createProfile() {
    const identity = currentIdentity();
    const random = randomForIdentity(identity);
    const basePowerScore = estimatePower(identity);
    const geometry = buildGeometryDNA(identity, random);

    return {
      version: VERSION,
      identity,
      random,
      geometry,
      quality: applyDensityToQuality(
        qualityFromPower(basePowerScore, identity),
        geometry
      ),
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
      quality: applyDensityToQuality(
        qualityFromPower(powerScore, profile.identity),
        profile.geometry
      )
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

    identityCache = null;
    identityCacheKey = null;
    activeRandom = null;
    activeRandomKey = null;
    sessionProfile = null;
    sessionKey = null;
  }

  window.MPAdaptiveArt = {
    version: VERSION,
    createProfile,
    getProfile,
    tuneQualityFromRuntime,
    resetIdentity,
    createRandom,
    applyPageTheme,
    LIMITS,
    currentIdentity,
    seedKey: () => currentIdentity().seedKey
  };
})();
