const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "curation-v12.1.js"),
  "utf8"
);

// Peça quebrada: as massas estão fora do viewport e colapsadas num
// ponto. Não há nada para ver. Isto a curadoria PRECISA rejeitar.
function brokenGeometry() {
  return {
    grammar: "technical",
    grammarIndex: 2,
    renderMode: 1,
    activeMasses: 3,
    activeCavities: 0,
    masses: [
      7.0, 7.0, 0.03, 0.02,
      7.2, 7.1, 0.03, 0.02,
      7.4, 7.2, 0.03, 0.02
    ],
    massMeta: [
      0, 0, 0.8, 0,
      0, 0, 0.8, 1,
      0, 0, 0.8, 2
    ],
    cavities: [5, 5, 0.02, 0.02],
    cavityMeta: [0, 0, 0, 0],
    backgroundColor: [0.96, 0.97, 0.95],
    lineColor: [0.30, 0.34, 0.31],
    accentColor: [0.14, 0.18, 0.15],
    rightFadeStart: 0.9,
    fadeWidth: 0.8,
    fadeStrength: 0.1,
    verticalFade: 1.0,
    globalAngle: 0,
    fadeDirection: 1
  };
}

// Peça sã e convencional: larga, centrada, contínua.
function healthyGeometry() {
  return {
    grammar: "organic",
    grammarIndex: 0,
    renderMode: 0,
    activeMasses: 6,
    activeCavities: 1,
    masses: [
      -0.52, -0.12, 0.34, 0.18,
      -0.24, 0.10, 0.31, 0.17,
      0.02, -0.08, 0.38, 0.22,
      0.28, 0.13, 0.32, 0.18,
      0.52, -0.10, 0.30, 0.16,
      0.12, 0.28, 0.30, 0.15
    ],
    massMeta: [
      0, 0.1, 1, 0,
      0.1, 0.1, 1, 1,
      -0.1, 0.05, 1.1, 2,
      0.2, -0.1, 1, 3,
      -0.2, 0.1, 1, 4,
      0.1, -0.05, 1, 5
    ],
    cavities: [0.12, 0.06, 0.12, 0.09],
    cavityMeta: [0, 0.25, 0, 0.30],
    backgroundColor: [0.96, 0.97, 0.95],
    lineColor: [0.38, 0.46, 0.40],
    accentColor: [0.20, 0.28, 0.22],
    rightFadeStart: 0.88,
    fadeWidth: 0.78,
    fadeStrength: 0.12,
    verticalFade: 0.98,
    globalAngle: 0,
    fadeDirection: 1
  };
}

// Peça sã mas NADA convencional: duas massas pequenas, deslocadas
// para a periferia, com vinheta fechada. A V12 dava nota baixa nisto
// e "consertava" até virar a peça larga e centrada de sempre. É o
// caso que define se a curadoria corta a cauda ou comprime o meio.
function intimateGeometry() {
  return {
    ...healthyGeometry(),
    grammar: "technical",
    activeMasses: 2,
    activeCavities: 0,
    masses: [
      -0.46, 0.22, 0.13, 0.09,
      -0.30, 0.31, 0.10, 0.07
    ],
    massMeta: [
      0, 0, 1, 0,
      0, 0, 0.9, 1
    ],
    cavities: [5, 5, 0.02, 0.02],
    cavityMeta: [0, 0, 0, 0],
    rightFadeStart: 0.34,
    fadeWidth: 0.30,
    fadeStrength: 0.52,
    verticalFade: 0.52
  };
}

function createEnvironment(geometryFactory = healthyGeometry, options = {}) {
  const { sequence = null } = options;
  let calls = 0;

  const createProfile = () => {
    const factory = sequence
      ? sequence[Math.min(calls, sequence.length - 1)]
      : geometryFactory;

    calls++;

    return {
      version: "mp-art-v12",
      identity: {
        hash: 0x12345678,
        detailHash: 0x10203040,
        gpuHash: 0x87654321,
        state: [1, 2, 3, 4]
      },
      geometry: factory(),
      quality: {
        fineLineDensity: 42,
        secondaryLineDensity: 28,
        structuralDensity: 11,
        noiseWeight: 0.8,
        microDetail: 0.04,
        arcOpacity: 0.06,
        pixelBudget: 1600000,
        renderScale: 1
      }
    };
  };

  const tuneQualityFromRuntime = (profile, fps) => ({
    ...profile,
    quality: {
      ...profile.quality,
      measuredFps: fps,
      fineLineDensity: Math.max(10, profile.quality.fineLineDensity - 6)
    }
  });

  const window = {
    MPAdaptiveArt: {
      version: "mp-art-v12",
      createProfile,
      tuneQualityFromRuntime,
      resetIdentity() {}
    }
  };

  const context = {
    Array,
    Math,
    Number,
    console,
    window
  };

  vm.createContext(context);
  vm.runInContext(source, context, {
    filename: "curation-v12.1.js"
  });

  return { api: window.MPAdaptiveArt, calls: () => calls };
}

test("a healthy composition is accepted on the first attempt", () => {
  const { api } = createEnvironment(healthyGeometry);
  const profile = api.createProfile();

  assert.equal(profile.version, "mp-art-v12.1");
  assert.equal(profile.geometry.curation.version, "v13");
  assert.equal(profile.geometry.curation.accepted, true);
  assert.equal(profile.geometry.curation.attempts, 1);
  assert.equal(profile.geometry.curation.faults.length, 0);
});

test("curation no longer carries a repair strength", () => {
  const profile = createEnvironment(healthyGeometry).api.createProfile();

  // repairStrength era o mecanismo que empurrava toda peça para o
  // mesmo ótimo. Não pode voltar por acidente.
  assert.equal(profile.geometry.curation.repairStrength, undefined);
  assert.equal(profile.geometry.curation.repaired, undefined);

  // O nome pode aparecer em comentário explicando por que saiu; o que
  // não pode voltar é atribuição ou propriedade com esse nome.
  assert.doesNotMatch(source, /repairStrength\s*[:=]/);
  assert.doesNotMatch(source, /function (recenter|expandToViewport|ensureHeroMass|repairContinuity|tameCavities|stabilizeStyle)/);
});

test("an unconventional composition passes through untouched", () => {
  const before = intimateGeometry();
  const profile = createEnvironment(intimateGeometry).api.createProfile();
  const after = profile.geometry;

  assert.equal(after.curation.accepted, true);
  assert.equal(after.curation.attempts, 1);

  // Nenhuma massa, cavidade ou valor de enquadramento pode ter sido
  // reescrito: a peça é diferente, não quebrada.
  assert.deepEqual([...after.masses], [...before.masses]);
  assert.deepEqual([...after.massMeta], [...before.massMeta]);
  assert.deepEqual([...after.cavities], [...before.cavities]);
  assert.equal(after.rightFadeStart, before.rightFadeStart);
  assert.equal(after.fadeWidth, before.fadeWidth);
  assert.equal(after.fadeStrength, before.fadeStrength);
  assert.equal(after.verticalFade, before.verticalFade);
  assert.deepEqual([...after.lineColor], [...before.lineColor]);
  assert.deepEqual([...after.accentColor], [...before.accentColor]);
  assert.equal(after.renderMode, before.renderMode);
});

test("a broken composition is rejected and re-drawn, not repaired", () => {
  const { api, calls } = createEnvironment(null, {
    sequence: [brokenGeometry, brokenGeometry, healthyGeometry]
  });
  const profile = api.createProfile();

  assert.equal(profile.geometry.curation.accepted, true);
  assert.equal(profile.geometry.curation.attempts, 3);
  assert.equal(profile.geometry.curation.rejected.length, 2);
  assert.ok(profile.geometry.curation.rejected[0].score < 45);

  // A peça entregue é a terceira candidata, inteira — não a primeira
  // corrigida. Suas massas são as da peça sã.
  assert.deepEqual([...profile.geometry.masses], healthyGeometry().masses);
  assert.equal(calls(), 3);
});

test("rejection gives up after a bounded number of attempts", () => {
  const { api, calls } = createEnvironment(brokenGeometry);
  const profile = api.createProfile();

  assert.equal(profile.geometry.curation.accepted, false);
  assert.equal(profile.geometry.curation.attempts, 12);
  assert.ok(calls() <= 12);

  // Mesmo desistindo, entrega a peça: nunca trava nem devolve nada.
  assert.ok(Array.isArray(profile.geometry.masses));
});

test("diagnose names what is broken instead of scoring taste", () => {
  const { api } = createEnvironment(healthyGeometry);
  const broken = api.diagnose(brokenGeometry(), { fineLineDensity: 42 });
  const healthy = api.diagnose(healthyGeometry(), { fineLineDensity: 42 });
  const intimate = api.diagnose(intimateGeometry(), { fineLineDensity: 42 });

  assert.ok(broken.score < 45, `peça quebrada passou: ${broken.score}`);
  assert.ok(broken.faults.length > 0);

  assert.ok(healthy.score >= 45);
  assert.equal(healthy.faults.length, 0);

  // O ponto central da V13: a peça íntima e periférica NÃO é um
  // defeito. Na V12 ela levava nota baixa e era "consertada".
  assert.ok(intimate.score >= 45, `peça íntima rejeitada: ${intimate.score}`);
  assert.equal(intimate.faults.length, 0, `falhas: ${[...intimate.faults]}`);
});

test("coverage measures drawn area, not width or centrality", () => {
  const { api } = createEnvironment(healthyGeometry);

  assert.ok(api.coverage(brokenGeometry()) < 0.006);
  assert.ok(api.coverage(healthyGeometry()) > 0.20);

  // A peça íntima cobre pouca tela, mas cobre — e isso basta.
  const intimate = api.coverage(intimateGeometry());
  assert.ok(intimate > 0.02 && intimate < 0.45, `cobertura: ${intimate}`);
});

test("runtime tuning keeps the curated geometry", () => {
  const { api } = createEnvironment(healthyGeometry);
  const profile = api.createProfile();
  const before = JSON.stringify(profile.geometry);
  const tuned = api.tuneQualityFromRuntime(profile, 38);

  assert.equal(JSON.stringify(tuned.geometry), before);
  assert.equal(tuned.version, "mp-art-v12.1");
  assert.equal(tuned.quality.measuredFps, 38);
});
