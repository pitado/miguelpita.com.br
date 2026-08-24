const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const adaptiveSource = fs.readFileSync(
  path.join(__dirname, "..", "adaptive-profile.js"),
  "utf8"
);

const topologySource = fs.readFileSync(
  path.join(__dirname, "..", "topology-v11.js"),
  "utf8"
);

function createEnvironment({ search = "", storage = new Map() } = {}) {
  const window = {
    location: { search },
    devicePixelRatio: 1,
    crypto: {
      getRandomValues(values) {
        values.set([
          0x10203040,
          0x50607080,
          0x90a0b0c0,
          0xd0e0f000
        ]);
      }
    },
    addEventListener() {}
  };

  const navigator = {
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0
  };

  const screen = {
    width: 1440,
    height: 900,
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

  const webgl = {
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
        unmaskedVendor: "NVIDIA Corporation",
        unmaskedRenderer: "NVIDIA GeForce RTX 4070",
        maxTextureSize: 16384,
        maxRenderbufferSize: 16384,
        maxFragmentUniformVectors: 1024,
        maxVaryingVectors: 32,
        maxVertexAttribs: 16,
        maxVertexTextureImageUnits: 32
      };

      return values[name] || 0;
    },
    getShaderPrecisionFormat() {
      return { precision: 23 };
    },
    getSupportedExtensions() {
      return ["EXT_color_buffer_half_float"];
    }
  };

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
      },
      getElementById() {
        return null;
      }
    },
    localStorage,
    navigator,
    screen,
    window
  };

  vm.createContext(context);
  vm.runInContext(adaptiveSource, context, {
    filename: "adaptive-profile.js"
  });
  vm.runInContext(topologySource, context, {
    filename: "topology-v11.js"
  });

  return { api: window.MPAdaptiveArt, window };
}

function profileForSeed(environment, seed) {
  environment.window.location.search =
    `?artSeed=${seed.toString(16).padStart(8, "0")}`;
  return environment.api.createProfile();
}

test("V11 exposes all topology families across independent seeds", () => {
  const environment = createEnvironment();
  const seen = new Set();

  for (let seed = 1; seed <= 4096 && seen.size < 10; seed++) {
    seen.add(profileForSeed(environment, seed).geometry.topology);
  }

  assert.deepEqual(
    [...seen].sort(),
    [
      "bifurcation",
      "cloud",
      "crater",
      "fracture",
      "lattice",
      "ridge",
      "ribbon",
      "shards",
      "shell",
      "vortex"
    ]
  );
});

test("same seed keeps the V11 anatomy deterministic", () => {
  const firstEnvironment = createEnvironment();
  const secondEnvironment = createEnvironment();
  const first = profileForSeed(firstEnvironment, 0x1234abcd);
  const second = profileForSeed(secondEnvironment, 0x1234abcd);

  assert.equal(first.version, "mp-art-v11");
  assert.equal(first.geometry.topology, second.geometry.topology);
  assert.equal(
    JSON.stringify(first.geometry.masses),
    JSON.stringify(second.geometry.masses)
  );
  assert.equal(
    JSON.stringify(first.geometry.cavities),
    JSON.stringify(second.geometry.cavities)
  );
});

test("every V11 topology preserves WebGL1 fixed-size geometry arrays", () => {
  const environment = createEnvironment();

  for (let seed = 1; seed <= 512; seed++) {
    const geometry = profileForSeed(environment, seed).geometry;

    assert.equal(geometry.masses.length, 24);
    assert.equal(geometry.massMeta.length, 24);
    assert.equal(geometry.cavities.length, 12);
    assert.equal(geometry.cavityMeta.length, 12);
    assert.ok(geometry.activeMasses >= 1 && geometry.activeMasses <= 6);
    assert.ok(geometry.activeCavities >= 0 && geometry.activeCavities <= 3);

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

test("runtime quality tuning preserves the chosen topology", () => {
  const environment = createEnvironment();
  const profile = profileForSeed(environment, 0xdeadbeef);
  const topology = profile.geometry.topology;
  const masses = JSON.stringify(profile.geometry.masses);

  const tuned = environment.api.tuneQualityFromRuntime(profile, 27);

  assert.equal(tuned.geometry.topology, topology);
  assert.equal(JSON.stringify(tuned.geometry.masses), masses);
  assert.notEqual(tuned.powerScore, profile.powerScore);
});
