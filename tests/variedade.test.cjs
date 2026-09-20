/*
  Teste de variedade da população de peças.

  Os outros testes verificam uma peça de cada vez: determinismo,
  limites de array, contraste, anatomia. Nenhum deles enxerga o
  problema que motivou a V13, porque o problema não está em nenhuma
  peça — está na DISTRIBUIÇÃO. Todas as peças eram individualmente
  válidas e coletivamente iguais.

  Este arquivo gera uma população, reduz cada peça a um vetor de
  características e reprova três formas de colapso:

    1. dimensão constante            (activeMasses era sempre 6)
    2. dimensão com CV abaixo de 0,15 (bgL tinha 0,020)
    3. pares próximos demais          (peças diferentes no papel que
                                       chegam iguais ao olho)

  As faixas de normalização são FIXAS, de projeto, e não derivadas da
  amostra. Se fossem derivadas, uma população colapsada encolheria a
  própria régua junto e as distâncias continuariam parecendo grandes:
  o teste passaria exatamente no caso que deveria pegar.
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const LAYERS = [
  "adaptive-profile.js",
  "topology-v11.js",
  "presence-v11.1.js",
  "grammar-v12.js",
  "curation-v12.1.js"
];

const POPULATION = 500;
const MIN_CV = 0.15;
const PAIR_SAMPLE = 260;
const CLOSE_DISTANCE = 0.85;
const MAX_CLOSE_RATIO = 0.03;

function createEnvironment() {
  const storage = new Map();
  const window = {
    location: { search: "" },
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false }),
    crypto: {
      getRandomValues(values) {
        values.set([0x10203040, 0x50607080, 0x90a0b0c0, 0xd0e0f000]);
      }
    },
    addEventListener() {}
  };

  const webgl = {
    MAX_TEXTURE_SIZE: "a",
    MAX_RENDERBUFFER_SIZE: "b",
    MAX_FRAGMENT_UNIFORM_VECTORS: "c",
    MAX_VARYING_VECTORS: "d",
    MAX_VERTEX_ATTRIBS: "e",
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: "f",
    FRAGMENT_SHADER: "g",
    HIGH_FLOAT: "h",
    getExtension(name) {
      if (name === "WEBGL_debug_renderer_info") {
        return { UNMASKED_VENDOR_WEBGL: "v", UNMASKED_RENDERER_WEBGL: "r" };
      }
      if (name === "WEBGL_lose_context") return { loseContext() {} };
      return null;
    },
    getParameter(name) {
      return {
        v: "NVIDIA Corporation",
        r: "NVIDIA GeForce RTX 4070",
        a: 16384, b: 16384, c: 1024, d: 32, e: 16, f: 32
      }[name] || 0;
    },
    getShaderPrecisionFormat: () => ({ precision: 23 }),
    getSupportedExtensions: () => ["EXT_color_buffer_half_float"]
  };

  const context = {
    Array, Date, JSON, Math, Number, RegExp, Uint32Array, URLSearchParams,
    console: { log() {}, warn() {}, error() {} },
    document: {
      createElement: () => ({ getContext: () => webgl }),
      getElementById: () => null,
      querySelector: () => null,
      documentElement: { style: {}, dataset: {} }
    },
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    navigator: { hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 0 },
    screen: { width: 1440, height: 900, colorDepth: 24 },
    window
  };

  vm.createContext(context);

  for (const layer of LAYERS) {
    vm.runInContext(
      fs.readFileSync(path.join(__dirname, "..", layer), "utf8"),
      context,
      { filename: layer }
    );
  }

  return { api: window.MPAdaptiveArt, window };
}

function rgbToHsl(color) {
  const [r, g, b] = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  let h;
  if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / delta + 2) / 6;
  else h = ((r - g) / delta + 4) / 6;

  return {
    h: h * 360,
    s: l > 0.5 ? delta / (2 - max - min) : delta / (max + min),
    l
  };
}

// Faixa de projeto de cada dimensão contínua. Serve de régua fixa
// para a distância entre pares.
const CONTINUOUS = {
  bgL: [0, 1],
  lineL: [0, 1],
  accentL: [0, 1],
  activeMasses: [2, 14],
  activeCavities: [0, 6],
  presenceScale: [1.04, 2.32],
  rightFadeStart: [0.22, 1.20],
  fadeWidth: [0.20, 1.12],
  fadeStrength: [0, 0.70],
  verticalFade: [0.44, 1.26],
  flowStrength: [0, 0.36],
  warpA: [0, 0.22],
  asymmetry: [0, 1],
  animationSpeed: [0.30, 2.0],
  fineLineDensity: [12, 96]
};

/* As três saturações saíram do teste de CV e ganharam teste próprio
   logo abaixo. Motivo: a direção de arte passou a ser "sempre
   colorido", o que prende a saturação numa faixa alta de propósito —
   e faixa estreita derruba o coeficiente de variação por construção
   (accentS media CV 0,133). Cobrar CV ali passaria a punir
   exatamente o que foi pedido. O que elas precisam garantir agora é
   um PISO, não dispersão, e é isso que o teste novo cobra. */
const SATURATIONS = ["bgS", "lineS", "accentS"];

const DISCRETE = [
  "paletteRegime",
  "topology",
  "grammar",
  "family",
  "density",
  "order",
  "balance",
  "energy",
  "framing",
  "scale"
];

function featuresOf(profile) {
  const geometry = profile.geometry;
  const background = rgbToHsl(geometry.backgroundColor);
  const line = rgbToHsl(geometry.lineColor);
  const accent = rgbToHsl(geometry.accentColor);
  const archetypes = geometry.archetypes || {};

  return {
    paletteRegime: geometry.paletteRegime,
    topology: geometry.topology,
    grammar: geometry.grammar,
    family: geometry.family,
    density: archetypes.density,
    order: archetypes.order,
    balance: archetypes.balance,
    energy: archetypes.energy,
    framing: archetypes.framing,
    scale: archetypes.scale,

    bgL: background.l,
    bgS: background.s,
    lineL: line.l,
    lineS: line.s,
    accentL: accent.l,
    accentS: accent.s,
    activeMasses: geometry.activeMasses,
    activeCavities: geometry.activeCavities,
    presenceScale: geometry.presenceScale,
    coverage: geometry.curation?.coverage ?? 1,
    bgH: background.h,
    rightFadeStart: geometry.rightFadeStart,
    fadeWidth: geometry.fadeWidth,
    fadeStrength: geometry.fadeStrength,
    verticalFade: geometry.verticalFade,
    flowStrength: geometry.flowStrength,
    warpA: geometry.warpA,
    asymmetry: geometry.asymmetry,
    animationSpeed: geometry.animationSpeed,
    fineLineDensity: profile.quality.fineLineDensity
  };
}

function buildPopulation(size) {
  const environment = createEnvironment();
  const rows = [];

  for (let index = 1; index <= size; index++) {
    const seed = (Math.imul(index, 2654435761) >>> 0)
      .toString(16)
      .padStart(8, "0");

    environment.window.location.search = `?artSeed=${seed}`;
    rows.push(featuresOf(environment.api.createProfile()));
  }

  return rows;
}

const population = buildPopulation(POPULATION);

test("no continuous dimension of the population is frozen", () => {
  const frozen = [];

  for (const key of Object.keys(CONTINUOUS)) {
    const values = population.map(row => Number(row[key]));

    for (const value of values) {
      assert.ok(Number.isFinite(value), `${key} tem valor não finito`);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max - min < 1e-9) {
      frozen.push(`${key} (sempre ${min})`);
    }
  }

  assert.deepEqual(
    frozen,
    [],
    `dimensões congeladas: ${frozen.join(", ")}`
  );
});

test("no continuous dimension collapses below a 0.15 coefficient of variation", () => {
  const weak = [];

  for (const key of Object.keys(CONTINUOUS)) {
    const values = population.map(row => Number(row[key]));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length;
    const cv = mean === 0 ? Infinity : Math.sqrt(variance) / Math.abs(mean);

    if (cv < MIN_CV) {
      weak.push(`${key} (CV ${cv.toFixed(3)})`);
    }
  }

  assert.deepEqual(
    weak,
    [],
    `dimensões com variação insuficiente: ${weak.join(", ")}`
  );
});

test("every discrete family is actually reachable", () => {
  const missing = [];

  for (const key of DISCRETE) {
    const seen = new Set(population.map(row => row[key]));

    if (seen.size < 2) {
      missing.push(`${key} (${seen.size} valor)`);
    }

    for (const value of seen) {
      assert.ok(value !== undefined, `${key} indefinido`);
    }
  }

  assert.deepEqual(missing, [], `dimensões discretas travadas: ${missing.join(", ")}`);

  // Os catálogos completos precisam aparecer: se um regime, uma
  // topologia ou uma gramática sumir da população, alguma etapa
  // voltou a filtrar a variedade em silêncio.
  assert.equal(new Set(population.map(row => row.paletteRegime)).size, 7);
  assert.equal(new Set(population.map(row => row.topology)).size, 10);
  assert.equal(new Set(population.map(row => row.grammar)).size, 6);
  assert.equal(new Set(population.map(row => row.family)).size, 4);
  assert.equal(new Set(population.map(row => row.density)).size, 4);
  assert.equal(new Set(population.map(row => row.energy)).size, 4);
  assert.equal(new Set(population.map(row => row.framing)).size, 4);
  assert.equal(new Set(population.map(row => row.scale)).size, 4);
});

test("few pairs of pieces land close enough to read as the same artwork", () => {
  const sample = population.slice(0, PAIR_SAMPLE);
  const keys = Object.keys(CONTINUOUS);

  let close = 0;
  let pairs = 0;
  let closest = Infinity;
  let closestPair = null;

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      let squared = 0;

      for (const key of keys) {
        const [low, high] = CONTINUOUS[key];
        const span = high - low || 1;
        squared += ((sample[i][key] - sample[j][key]) / span) ** 2;
      }

      for (const key of DISCRETE) {
        if (sample[i][key] !== sample[j][key]) squared += 1;
      }

      const distance = Math.sqrt(squared);

      if (distance < closest) {
        closest = distance;
        closestPair = [i, j];
      }

      if (distance < CLOSE_DISTANCE) close++;
      pairs++;
    }
  }

  const ratio = close / pairs;

  assert.ok(
    ratio <= MAX_CLOSE_RATIO,
    `${(ratio * 100).toFixed(2)}% dos pares abaixo de ${CLOSE_DISTANCE} ` +
      `(limite ${(MAX_CLOSE_RATIO * 100).toFixed(0)}%); ` +
      `par mais próximo: ${closestPair} a ${closest.toFixed(3)}`
  );
});

test("the art direction holds for every piece in the population", () => {
  // Sempre colorido: nenhum dos três tons vira cinza.
  let weakest = 1;
  for (const row of population) {
    for (const key of SATURATIONS) weakest = Math.min(weakest, row[key]);
  }
  assert.ok(weakest >= 0.20, `peça sem cor: saturação ${weakest.toFixed(3)}`);

  // Mas a cor não pode ter virado uma cor só: o matiz do fundo
  // precisa percorrer o círculo inteiro.
  const sectors = new Set(population.map(row => Math.floor(row.bgH / 30)));
  assert.equal(sectors.size, 12, `setores de matiz cobertos: ${sectors.size}/12`);

  // E a saturação, mesmo com piso, precisa variar de verdade.
  for (const key of SATURATIONS) {
    const values = population.map(row => row[key]);
    const span = Math.max(...values) - Math.min(...values);
    assert.ok(span >= 0.25, `${key} quase fixo: amplitude ${span.toFixed(3)}`);
  }

  // Sempre preenchendo: toda peça tem composição de fato na tela,
  // não apenas o campo de textura ao fundo.
  const worst = Math.min(...population.map(row => row.coverage));
  assert.ok(worst >= 0.15, `peça sem forma na tela: cobertura ${worst.toFixed(3)}`);
});

test("the same seed still produces the same piece", () => {
  // A variedade não pode ter vindo às custas do determinismo: o
  // ponto do site é que a sua peça continue sendo a sua.
  const first = createEnvironment();
  const second = createEnvironment();

  first.window.location.search = "?artSeed=1234abcd";
  second.window.location.search = "?artSeed=1234abcd";

  const a = first.api.createProfile();
  const b = second.api.createProfile();

  assert.equal(
    JSON.stringify(featuresOf(a)),
    JSON.stringify(featuresOf(b))
  );
  assert.deepEqual([...a.geometry.masses], [...b.geometry.masses]);
});
