const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "presence-v11.1.js"),
  "utf8"
);

function baseGeometry() {
  return {
    topology: "fracture",
    family: "archipelago",
    activeMasses: 6,
    activeCavities: 1,
    masses: [
      -0.34, -0.18, 0.16, 0.09,
      -0.14,  0.04, 0.18, 0.10,
      -0.28,  0.25, 0.15, 0.08,
       0.17, -0.22, 0.17, 0.09,
       0.36,  0.02, 0.16, 0.10,
       0.22,  0.27, 0.14, 0.08
    ],
    massMeta: [
      0, 0, 1, 0,
      0, 0, 1, 1,
      0, 0, 1, 2,
      0, 0, 1, 3,
      0, 0, 1, 4,
      0, 0, 1, 5
    ],
    cavities: [
      0, 0, 0.08, 0.18,
      5, 5, 0.02, 0.02,
      6, 6, 0.02, 0.02
    ],
    cavityMeta: [
      0, 0.3, 0, 0.65,
      0, 0, 0, 0,
      0, 0, 0, 0
    ],
    rightFadeStart: 0.44,
    fadeWidth: 0.42,
    fadeStrength: 0.48,
    verticalFade: 0.65,
    asymmetry: 0.2,
    flowStrength: 0.07,
    warpA: 0.05,
    warpB: 0.04,
    faultStrength: 0.08,
    foldStrengthA: 0.035,
    foldStrengthB: 0.02,
    anchorX: -0.34,
    anchorY: -0.18
  };
}

function createEnvironment(hash = 0x12345678) {
  const createProfile = () => ({
    version: "mp-art-v11",
    identity: {
      hash,
      detailHash: hash,
      gpuHash: 0x87654321
    },
    geometry: baseGeometry(),
    quality: {
      pixelBudget: 1200000,
      renderScale: 0.9
    }
  });

  const tuneQualityFromRuntime = (profile, fps) => ({
    ...profile,
    quality: {
      ...profile.quality,
      measuredFps: fps
    }
  });

  const window = {
    MPAdaptiveArt: {
      version: "mp-art-v11",
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
    filename: "presence-v11.1.js"
  });

  return window.MPAdaptiveArt;
}

function activeExtent(geometry) {
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

test("V11.1 authors presence across the full intimate-to-overflowing range", () => {
  const api = createEnvironment();
  const after = api.createProfile().geometry;

  assert.equal(after.presenceVersion, "v11.1");
  assert.ok(after.presenceScale >= 0.72 && after.presenceScale <= 1.92);

  // A faixa precisa ser exercida de verdade, não só permitida: com
  // 1,16-1,34 toda peça ocupava a tela igual (CV medido: 0,042).
  const scales = [];
  for (let hash = 1; hash <= 200; hash++) {
    scales.push(createEnvironment(hash).createProfile().geometry.presenceScale);
  }

  const mean = scales.reduce((a, b) => a + b, 0) / scales.length;
  const sd = Math.sqrt(
    scales.reduce((a, b) => a + (b - mean) ** 2, 0) / scales.length
  );

  assert.ok(Math.min(...scales) < 0.95, "nenhuma peça íntima");
  assert.ok(Math.max(...scales) > 1.70, "nenhuma peça transbordante");
  assert.ok(sd / mean > 0.15, `CV de presenceScale baixo: ${(sd / mean).toFixed(3)}`);
});

test("V11.1 no longer re-ratchets the framing decided upstream", () => {
  // Esta camada aplicava piso em rightFadeStart, fadeWidth e
  // verticalFade. Somado aos pisos de grammar e curation, congelava
  // as três dimensões. Agora o enquadramento passa intacto.
  const input = baseGeometry();
  const geometry = createEnvironment().createProfile().geometry;

  assert.equal(geometry.rightFadeStart, input.rightFadeStart);
  assert.equal(geometry.fadeWidth, input.fadeWidth);
  assert.equal(geometry.fadeStrength, input.fadeStrength);
  assert.equal(geometry.verticalFade, input.verticalFade);
});

test("same DNA produces identical presence geometry", () => {
  const first = createEnvironment(0x0badcafe).createProfile();
  const second = createEnvironment(0x0badcafe).createProfile();

  assert.equal(
    JSON.stringify(first.geometry),
    JSON.stringify(second.geometry)
  );
});

test("different DNA produces a different authored composition", () => {
  const first = createEnvironment(0x11112222).createProfile();
  const second = createEnvironment(0xaaaabbbb).createProfile();

  assert.notEqual(
    JSON.stringify(first.geometry.masses),
    JSON.stringify(second.geometry.masses)
  );
  assert.notEqual(
    JSON.stringify({
      presenceScale: first.geometry.presenceScale,
      breakMass: first.geometry.breakMass,
      warpA: first.geometry.warpA,
      asymmetry: first.geometry.asymmetry
    }),
    JSON.stringify({
      presenceScale: second.geometry.presenceScale,
      breakMass: second.geometry.breakMass,
      warpA: second.geometry.warpA,
      asymmetry: second.geometry.asymmetry
    })
  );
});

test("WebGL1 array sizes remain unchanged and finite", () => {
  const geometry = createEnvironment().createProfile().geometry;

  assert.equal(geometry.masses.length, baseGeometry().masses.length);
  assert.equal(geometry.massMeta.length, baseGeometry().massMeta.length);
  assert.equal(geometry.cavities.length, baseGeometry().cavities.length);
  assert.equal(geometry.cavityMeta.length, baseGeometry().cavityMeta.length);

  for (const value of [
    ...geometry.masses,
    ...geometry.massMeta,
    ...geometry.cavities,
    ...geometry.cavityMeta
  ]) {
    assert.ok(Number.isFinite(value));
  }
});

test("runtime quality tuning preserves the authored geometry", () => {
  const api = createEnvironment();
  const profile = api.createProfile();
  const geometrySnapshot = JSON.stringify(profile.geometry);
  const tuned = api.tuneQualityFromRuntime(profile, 37.5);

  assert.equal(JSON.stringify(tuned.geometry), geometrySnapshot);
  assert.equal(tuned.quality.measuredFps, 37.5);
  assert.equal(tuned.version, "mp-art-v11.1");
});
