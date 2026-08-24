const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "curation-v12.1.js"),
  "utf8"
);

function uglyGeometry() {
  return {
    grammar: "technical",
    grammarIndex: 2,
    renderMode: 1,
    activeMasses: 6,
    activeCavities: 2,
    masses: [
      -0.72, -0.30, 0.10, 0.05,
      -0.48,  0.24, 0.09, 0.05,
       0.10, -0.36, 0.08, 0.04,
       0.52,  0.26, 0.09, 0.05,
       0.78, -0.12, 0.07, 0.04,
       0.42,  0.38, 0.08, 0.04
    ],
    massMeta: [
      0, 0, 0.8, 0,
      0, 0, 0.8, 1,
      0, 0, 0.8, 2,
      0, 0, 0.8, 3,
      0, 0, 0.8, 4,
      0, 0, 0.8, 5
    ],
    cavities: [
      0.02, 0.01, 0.34, 0.28,
      0.16, 0.04, 0.20, 0.18,
      5, 5, 0.02, 0.02
    ],
    cavityMeta: [
      0, 0.5, 0, 0.92,
      0, 0.4, 1, 0.82,
      0, 0, 0, 0
    ],
    backgroundColor: [0.96, 0.97, 0.95],
    lineColor: [0.87, 0.90, 0.88],
    accentColor: [0.82, 0.86, 0.84],
    rightFadeStart: 0.70,
    fadeWidth: 0.50,
    fadeStrength: 0.35,
    verticalFade: 0.82,
    asymmetry: 0.94,
    faultStrength: 0.21,
    warpA: 0.16,
    warpB: 0.14,
    anchorX: -0.72,
    anchorY: -0.30
  };
}

function goodGeometry() {
  return {
    grammar: "organic",
    grammarIndex: 0,
    renderMode: 0,
    activeMasses: 6,
    activeCavities: 1,
    masses: [
      -0.52, -0.12, 0.34, 0.18,
      -0.24,  0.10, 0.31, 0.17,
       0.02, -0.08, 0.38, 0.22,
       0.28,  0.13, 0.32, 0.18,
       0.52, -0.10, 0.30, 0.16,
       0.12,  0.28, 0.30, 0.15
    ],
    massMeta: [
      0, .1, 1, 0,
      .1, .1, 1, 1,
      -.1, .05, 1.1, 2,
      .2, -.1, 1, 3,
      -.2, .1, 1, 4,
      .1, -.05, 1, 5
    ],
    cavities: [
      0.12, 0.06, 0.12, 0.09,
      5, 5, 0.02, 0.02,
      6, 6, 0.02, 0.02
    ],
    cavityMeta: [
      0, 0.25, 0, 0.30,
      0, 0, 0, 0,
      0, 0, 0, 0
    ],
    backgroundColor: [0.96, 0.97, 0.95],
    lineColor: [0.55, 0.67, 0.59],
    accentColor: [0.28, 0.40, 0.32],
    rightFadeStart: 0.88,
    fadeWidth: 0.78,
    fadeStrength: 0.12,
    verticalFade: 0.98,
    asymmetry: 0.62,
    faultStrength: 0.05,
    warpA: 0.10,
    warpB: 0.08,
    anchorX: 0.02,
    anchorY: -0.08
  };
}

function createEnvironment(geometryFactory = uglyGeometry) {
  const createProfile = () => ({
    version: "mp-art-v12",
    identity: {
      hash: 0x12345678,
      detailHash: 0x10203040,
      gpuHash: 0x87654321
    },
    geometry: geometryFactory(),
    quality: {
      fineLineDensity: geometryFactory === uglyGeometry ? 18 : 42,
      secondaryLineDensity: geometryFactory === uglyGeometry ? 12 : 28,
      structuralDensity: geometryFactory === uglyGeometry ? 4 : 11,
      noiseWeight: 0.8,
      microDetail: 0.04,
      arcOpacity: 0.06,
      pixelBudget: 1600000,
      renderScale: 1
    }
  });

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

  return window.MPAdaptiveArt;
}

function luminance(color) {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function extent(geometry) {
  const xs = [];
  const ys = [];

  for (let i = 0; i < geometry.activeMasses; i++) {
    const offset = i * 4;
    const x = geometry.masses[offset];
    const y = geometry.masses[offset + 1];
    const rx = geometry.masses[offset + 2];
    const ry = geometry.masses[offset + 3];
    xs.push(x - rx, x + rx);
    ys.push(y - ry, y + ry);
  }

  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

test("bad compositions are detected and repaired", () => {
  const api = createEnvironment();
  const profile = api.createProfile();

  assert.equal(profile.version, "mp-art-v12.1");
  assert.equal(profile.geometry.curation.version, "v12.1");
  assert.equal(profile.geometry.curation.repaired, true);
  assert.ok(profile.geometry.curation.scoreAfter > profile.geometry.curation.scoreBefore);
});

test("curation guarantees useful viewport presence", () => {
  const profile = createEnvironment().createProfile();
  const box = extent(profile.geometry);

  assert.ok(box.width >= 1.35);
  assert.ok(box.height >= 0.72);
  assert.ok(profile.geometry.masses[profile.geometry.heroMass * 4 + 2] >= 0.28);
});

test("curation enforces readable contrast", () => {
  const geometry = createEnvironment().createProfile().geometry;
  const bg = luminance(geometry.backgroundColor);
  const line = luminance(geometry.lineColor);
  const accent = luminance(geometry.accentColor);

  assert.ok(bg - line >= 0.15);
  assert.ok(bg - accent >= 0.24);
});

test("large central cavities are tamed", () => {
  const geometry = createEnvironment().createProfile().geometry;

  assert.ok(geometry.cavityMeta[3] <= 0.50);
  assert.ok(geometry.cavityMeta[7] <= 0.56);
});

test("unsafe angular mode falls back when repair is strong", () => {
  const geometry = createEnvironment().createProfile().geometry;

  assert.equal(geometry.renderMode, 0);
  assert.equal(geometry.renderModeFallback, "topographic");
});

test("already-good compositions receive only light curation", () => {
  const profile = createEnvironment(goodGeometry).createProfile();

  assert.equal(profile.geometry.curation.repaired, false);
  assert.equal(profile.geometry.renderMode, 0);
  assert.ok(profile.geometry.curation.repairStrength <= 0.48);
});

test("runtime tuning preserves curated geometry", () => {
  const api = createEnvironment();
  const profile = api.createProfile();
  const before = JSON.stringify(profile.geometry);
  const tuned = api.tuneQualityFromRuntime(profile, 38);

  assert.equal(JSON.stringify(tuned.geometry), before);
  assert.equal(tuned.version, "mp-art-v12.1");
  assert.ok(tuned.quality.fineLineDensity >= 30);
});
