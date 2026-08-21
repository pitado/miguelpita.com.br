const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "adaptive-profile.js"),
  "utf8"
);

function createEnvironment({
  search = "",
  cores = 8,
  memory = 8,
  dpr = 1,
  width = 1440,
  height = 900,
  gpu = null,
  storage = new Map()
} = {}) {
  const window = {
    location: { search },
    devicePixelRatio: dpr,
    crypto: {
      getRandomValues(values) {
        values.set([
          0x10203040,
          0x50607080,
          0x90a0b0c0,
          0xd0e0f000
        ]);
      }
    }
  };

  const navigator = {
    hardwareConcurrency: cores,
    deviceMemory: memory,
    maxTouchPoints: 0
  };

  const screen = {
    width,
    height,
    colorDepth: 24
  };

  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  };

  const webgl = gpu
    ? {
        MAX_TEXTURE_SIZE: "maxTextureSize",
        MAX_RENDERBUFFER_SIZE: "maxRenderbufferSize",
        MAX_FRAGMENT_UNIFORM_VECTORS: "maxFragmentUniformVectors",
        MAX_VARYING_VECTORS: "maxVaryingVectors",
        MAX_VERTEX_ATTRIBS: "maxVertexAttribs",
        MAX_VERTEX_TEXTURE_IMAGE_UNITS: "maxVertexTextureImageUnits",
        FRAGMENT_SHADER: "fragmentShader",
        HIGH_FLOAT: "highFloat",
        getExtension(name) {
          if (name === "WEBGL_debug_renderer_info") {
            return {
              UNMASKED_VENDOR_WEBGL: "unmaskedVendor",
              UNMASKED_RENDERER_WEBGL: "unmaskedRenderer"
            };
          }

          if (name === "WEBGL_lose_context") {
            return { loseContext() {} };
          }

          return null;
        },
        getParameter(name) {
          const values = {
            unmaskedVendor: gpu.vendor,
            unmaskedRenderer: gpu.renderer,
            maxTextureSize: gpu.maxTextureSize || 16384,
            maxRenderbufferSize: gpu.maxRenderbufferSize || 16384,
            maxFragmentUniformVectors: gpu.maxFragmentUniformVectors || 1024,
            maxVaryingVectors: gpu.maxVaryingVectors || 32,
            maxVertexAttribs: gpu.maxVertexAttribs || 16,
            maxVertexTextureImageUnits: gpu.maxVertexTextureImageUnits || 32
          };

          return values[name] || 0;
        },
        getShaderPrecisionFormat() {
          return { precision: gpu.precision || 23 };
        },
        getSupportedExtensions() {
          return gpu.extensions || ["EXT_color_buffer_half_float"];
        }
      }
    : null;

  const context = {
    Array,
    Date,
    JSON,
    Math,
    Number,
    RegExp,
    Uint32Array,
    URLSearchParams,
    console,
    document: {
      createElement() {
        return {
          getContext() {
            return webgl;
          }
        };
      }
    },
    localStorage,
    navigator,
    screen,
    window
  };

  vm.createContext(context);
  vm.runInContext(source, context, {
    filename: "adaptive-profile.js"
  });

  return {
    api: window.MPAdaptiveArt,
    navigator,
    screen,
    storage,
    window
  };
}

function profileForSeed(environment, seed) {
  environment.window.location.search =
    `?artSeed=${seed.toString(16).padStart(8, "0")}`;

  return environment.api.createProfile();
}

test("the same explicit seed produces identical identity and geometry", () => {
  const first = profileForSeed(createEnvironment(), 0x1234abcd);
  const second = profileForSeed(createEnvironment(), 0x1234abcd);

  assert.equal(first.identity.hash, 0x1234abcd);
  assert.equal(first.identity.seedA, second.identity.seedA);
  assert.equal(first.identity.seedB, second.identity.seedB);
  assert.equal(
    JSON.stringify(first.geometry),
    JSON.stringify(second.geometry)
  );
});

test("independent seeds distribute across every composition family", () => {
  const environment = createEnvironment();
  const counts = new Map();

  for (let seed = 1; seed <= 256; seed++) {
    const family = profileForSeed(environment, seed).geometry.family;
    counts.set(family, (counts.get(family) || 0) + 1);
  }

  assert.deepEqual(
    [...counts.keys()].sort(),
    ["archipelago", "basin", "spine", "strata"]
  );

  for (const count of counts.values()) {
    assert.ok(count >= 45 && count <= 85, `unbalanced count: ${count}`);
  }
});

test("GPU hashes distribute across radically different render species", () => {
  const environment = createEnvironment();
  const species = new Set();

  for (let seed = 1; seed <= 512; seed++) {
    environment.window.location.search =
      `?artSeed=13572468&gpuSeed=${seed.toString(16)}`;
    species.add(environment.api.createProfile().geometry.species);
  }

  assert.deepEqual(
    [...species].sort(),
    ["cellular", "crystal", "filament", "orbital", "topographic", "void"]
  );
});

test("changing the GPU changes the artwork species and GPU DNA", () => {
  const storage = new Map([
    ["mp-art-device-token", "11111111222222223333333344444444"]
  ]);
  const nvidia = createEnvironment({
    storage,
    gpu: {
      vendor: "NVIDIA Corporation",
      renderer: "NVIDIA GeForce RTX 4080",
      maxTextureSize: 32768,
      extensions: ["EXT_float_blend", "WEBGL_compressed_texture_s3tc"]
    }
  }).api.createProfile();
  const intel = createEnvironment({
    storage,
    gpu: {
      vendor: "Intel Inc.",
      renderer: "Intel Iris Xe Graphics",
      maxTextureSize: 16384,
      extensions: ["EXT_color_buffer_half_float"]
    }
  }).api.createProfile();

  assert.notEqual(nvidia.identity.gpuHash, intel.identity.gpuHash);
  assert.notEqual(nvidia.identity.hash, intel.identity.hash);
  assert.notEqual(
    `${nvidia.geometry.family}:${nvidia.geometry.species}`,
    `${intel.geometry.family}:${intel.geometry.species}`
  );
});

test("families have different structural signatures", () => {
  const environment = createEnvironment();
  const examples = new Map();

  for (let seed = 1; examples.size < 4 && seed < 1000; seed++) {
    const geometry = profileForSeed(environment, seed).geometry;
    examples.set(geometry.family, geometry);
  }

  const strata = examples.get("strata");
  const archipelago = examples.get("archipelago");
  const spine = examples.get("spine");
  const basin = examples.get("basin");

  const radii = geometry =>
    Array.from({ length: geometry.activeMasses }, (_, index) => ({
      x: geometry.masses[index * 4 + 2],
      y: geometry.masses[index * 4 + 3]
    }));

  const strataRatio = radii(strata)
    .reduce((sum, radius) => sum + radius.x / radius.y, 0) /
    strata.activeMasses;
  const spineRatio = radii(spine)
    .reduce((sum, radius) => sum + radius.y / radius.x, 0) /
    spine.activeMasses;
  const archipelagoCenters = Array.from(
    { length: archipelago.activeMasses },
    (_, index) => archipelago.masses[index * 4]
  );
  const basinCutouts = Array.from(
    { length: basin.activeCavities },
    (_, index) => basin.cavityMeta[index * 4 + 3]
  );

  assert.ok(strataRatio > 3);
  assert.ok(spineRatio > 1.5);
  assert.ok(
    Math.max(...archipelagoCenters) -
      Math.min(...archipelagoCenters) > 0.45
  );
  assert.ok(Math.max(...radii(basin).map(radius => radius.x)) > 0.55);
  assert.ok(Math.max(...basinCutouts) > 0.45);
});

test("all profiles keep WebGL1 fixed-size arrays and finite values", () => {
  const environment = createEnvironment();

  for (let seed = 1; seed <= 128; seed++) {
    const geometry = profileForSeed(environment, seed).geometry;

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

test("layout stays stable while device traits and power are recomputed", () => {
  const storage = new Map();
  const firstEnvironment = createEnvironment({
    cores: 4,
    memory: 4,
    width: 1366,
    height: 768,
    storage
  });
  const first = firstEnvironment.api.createProfile();
  const token = storage.get("mp-art-device-token");

  const secondEnvironment = createEnvironment({
    cores: 16,
    memory: 16,
    dpr: 2,
    width: 3840,
    height: 2160,
    storage
  });
  const second = secondEnvironment.api.createProfile();

  assert.equal(storage.get("mp-art-device-token"), token);
  assert.notEqual(first.identity.traitsHash, second.identity.traitsHash);
  assert.notEqual(first.identity.detailHash, second.identity.detailHash);
  assert.equal(first.identity.hash, second.identity.hash);
  assert.equal(
    JSON.stringify(first.geometry),
    JSON.stringify(second.geometry)
  );
  assert.notEqual(first.basePowerScore, second.basePowerScore);
});

test("different installation tokens generate different artwork", () => {
  const firstStorage = new Map([
    ["mp-art-device-token", "11111111222222223333333344444444"]
  ]);
  const secondStorage = new Map([
    ["mp-art-device-token", "aaaabbbbccccddddeeeeffff00001111"]
  ]);
  const first = createEnvironment({ storage: firstStorage })
    .api.createProfile();
  const second = createEnvironment({ storage: secondStorage })
    .api.createProfile();

  assert.notEqual(first.identity.hash, second.identity.hash);
  assert.notEqual(
    JSON.stringify(first.geometry),
    JSON.stringify(second.geometry)
  );
});

test("runtime quality tuning never accumulates across visits", () => {
  const environment = createEnvironment({ cores: 4, memory: 4 });
  let profile = environment.api.createProfile();
  const expectedScore = Math.min(95, profile.basePowerScore + 7);

  for (let visit = 0; visit < 12; visit++) {
    profile = environment.api.tuneQualityFromRuntime(profile, 60);
  }

  assert.equal(profile.powerScore, expectedScore);
  assert.ok(profile.quality.pixelBudget <= 3000000);
  assert.ok(profile.quality.pixelBudget >= 750000);
});
