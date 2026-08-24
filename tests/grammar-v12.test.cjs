const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "grammar-v12.js"),
  "utf8"
);

function baseGeometry() {
  return {
    family: "archipelago",
    topology: "fracture",
    species: "topographic",
    renderMode: 0,
    activeMasses: 6,
    activeCavities: 3,
    masses: [
      -0.42, -0.24, 0.22, 0.12,
      -0.16,  0.08, 0.20, 0.10,
      -0.30,  0.31, 0.18, 0.09,
       0.19, -0.28, 0.21, 0.11,
       0.42,  0.02, 0.18, 0.10,
       0.26,  0.34, 0.16, 0.09
    ],
    massMeta: [
      0.1,  0.1, 1.0, 0.0,
      0.2, -0.1, 0.9, 1.0,
     -0.2,  0.2, 0.8, 2.0,
      0.3, -0.2, 1.1, 3.0,
     -0.1,  0.1, 0.9, 4.0,
      0.2, -0.1, 0.8, 5.0
    ],
    cavities: [
      0.00,  0.00, 0.09, 0.18,
     -0.22,  0.19, 0.07, 0.11,
      0.25, -0.18, 0.08, 0.12
    ],
    cavityMeta: [
      0, 0.34, 0.0, 0.65,
      0, 0.28, 1.0, 0.52,
      0, 0.30, 2.0, 0.58
    ],
    backgroundColor: [0.94, 0.96, 0.94],
    lineColor: [0.42, 0.58, 0.48],
    accentColor: [0.16, 0.31, 0.22],
    globalAngle: 0.1,
    shear: 0.08,
    flowX: 3.2,
    flowY: 3.4,
    flowStrength: 0.08,
    flowDirection: 1,
    warpA: 0.05,
    warpB: 0.04,
    warpScaleA: 1.8,
    warpScaleB: 3.6,
    faultAngle: 0.3,
    faultOffset: 0.05,
    faultStrength: 0.08,
    foldFrequencyA: 4.2,
    foldFrequencyB: 5.4,
    foldStrengthA: 0.04,
    foldStrengthB: 0.025,
    asymmetry: 0.35,
    rightFadeStart: 0.82,
    fadeWidth: 0.72,
    fadeStrength: 0.18,
    verticalFade: 0.94,
    anchorX: -0.42,
    anchorY: -0.24
  };
}

function baseQuality() {
  return {
    powerScore: 55,
    renderScale: 0.92,
    pixelBudget: 1500000,
    fineLineDensity: 44,
    secondaryLineDensity: 30,
    structuralDensity: 10,
    noiseWeight: 0.8,
    microDetail: 0.04,
    arcOpacity: 0.055
  };
}

function createEnvironment({
  hash = 0x12345678,
  gpuHash = 0x87654321,
  search = ""
} = {}) {
  const createProfile = () => ({
    version: "mp-art-v11.1",
    identity: {
      hash,
      detailHash: hash ^ 0x55aa55aa,
      gpuHash
    },
    geometry: baseGeometry(),
    quality: baseQuality()
  });

  const tuneQualityFromRuntime = (profile, fps) => ({
    ...profile,
    quality: {
      ...baseQuality(),
      measuredFps: fps
    }
  });

  const window = {
    location: { search },
    MPAdaptiveArt: {
      version: "mp-art-v11.1",
      createProfile,
      tuneQualityFromRuntime,
      resetIdentity() {}
    }
  };

  const context = {
    Array,
    Math,
    Number,
    URLSearchParams,
    console,
    window
  };

  vm.createContext(context);
  vm.runInContext(source, context, {
    filename: "grammar-v12.js"
  });

  return window.MPAdaptiveArt;
}

const grammarNames = [
  "organic",
  "geological",
  "technical",
  "fragmented",
  "radial",
  "interference"
];

const expectedModes = [0, 5, 1, 3, 2, 4];

for (let index = 0; index < grammarNames.length; index++) {
  test(`grammar override ${grammarNames[index]} selects its own render mode`, () => {
    const api = createEnvironment({
      search: `?artGrammar=${grammarNames[index]}`
    });
    const profile = api.createProfile();

    assert.equal(profile.version, "mp-art-v12");
    assert.equal(profile.geometry.grammar, grammarNames[index]);
    assert.equal(profile.geometry.grammarIndex, index);
    assert.equal(profile.geometry.renderMode, expectedModes[index]);
    assert.equal(profile.geometry.species, grammarNames[index]);
    assert.equal(profile.geometry.baseSpecies, "topographic");
  });
}

test("all six grammars appear across independent DNA values", () => {
  const found = new Set();

  for (let seed = 1; seed <= 256; seed++) {
    const api = createEnvironment({
      hash: (seed * 0x9e3779b1) >>> 0,
      gpuHash: (seed * 0x85ebca6b) >>> 0
    });
    found.add(api.createProfile().geometry.grammar);
  }

  assert.deepEqual([...found].sort(), [...grammarNames].sort());
});

test("same DNA is deterministic", () => {
  const first = createEnvironment({ hash: 0x0badcafe, gpuHash: 0x13572468 })
    .createProfile();
  const second = createEnvironment({ hash: 0x0badcafe, gpuHash: 0x13572468 })
    .createProfile();

  assert.equal(first.geometry.grammar, second.geometry.grammar);
  assert.equal(JSON.stringify(first.geometry), JSON.stringify(second.geometry));
  assert.equal(JSON.stringify(first.quality), JSON.stringify(second.quality));
});

test("different grammar overrides produce structurally different artwork", () => {
  const organic = createEnvironment({ search: "?artGrammar=organic" })
    .createProfile();
  const fragmented = createEnvironment({ search: "?artGrammar=fragmented" })
    .createProfile();
  const radial = createEnvironment({ search: "?artGrammar=radial" })
    .createProfile();

  assert.notEqual(organic.geometry.renderMode, fragmented.geometry.renderMode);
  assert.notEqual(fragmented.geometry.renderMode, radial.geometry.renderMode);
  assert.notEqual(
    JSON.stringify(organic.geometry.masses),
    JSON.stringify(fragmented.geometry.masses)
  );
  assert.notEqual(
    JSON.stringify(fragmented.geometry.masses),
    JSON.stringify(radial.geometry.masses)
  );
  assert.notEqual(
    JSON.stringify(organic.quality),
    JSON.stringify(radial.quality)
  );
});

test("technical and radial grammars emphasize technical arcs", () => {
  const technical = createEnvironment({ search: "?artGrammar=technical" })
    .createProfile();
  const radial = createEnvironment({ search: "?artGrammar=radial" })
    .createProfile();
  const fragmented = createEnvironment({ search: "?artGrammar=fragmented" })
    .createProfile();

  assert.ok(technical.quality.arcOpacity > fragmented.quality.arcOpacity * 2);
  assert.ok(radial.quality.arcOpacity > fragmented.quality.arcOpacity * 2);
});

test("interference grammar is denser and noisier than technical", () => {
  const interference = createEnvironment({ search: "?artGrammar=interference" })
    .createProfile();
  const technical = createEnvironment({ search: "?artGrammar=technical" })
    .createProfile();

  assert.ok(interference.quality.fineLineDensity > technical.quality.fineLineDensity);
  assert.ok(interference.quality.noiseWeight > technical.quality.noiseWeight);
  assert.ok(interference.geometry.flowStrength > technical.geometry.flowStrength);
});

test("runtime quality tuning keeps the chosen grammar and geometry", () => {
  const api = createEnvironment({ search: "?artGrammar=geological" });
  const profile = api.createProfile();
  const geometrySnapshot = JSON.stringify(profile.geometry);
  const tuned = api.tuneQualityFromRuntime(profile, 38.5);

  assert.equal(tuned.version, "mp-art-v12");
  assert.equal(tuned.geometry.grammar, "geological");
  assert.equal(JSON.stringify(tuned.geometry), geometrySnapshot);
  assert.equal(tuned.quality.measuredFps, 38.5);
});

test("WebGL1 geometry arrays remain fixed and finite for every grammar", () => {
  for (const grammar of grammarNames) {
    const geometry = createEnvironment({ search: `?artGrammar=${grammar}` })
      .createProfile().geometry;

    assert.equal(geometry.masses.length, 24);
    assert.equal(geometry.massMeta.length, 24);
    assert.equal(geometry.cavities.length, 12);
    assert.equal(geometry.cavityMeta.length, 12);

    for (const value of [
      ...geometry.masses,
      ...geometry.massMeta,
      ...geometry.cavities,
      ...geometry.cavityMeta
    ]) {
      assert.ok(Number.isFinite(value));
    }
  }
});
