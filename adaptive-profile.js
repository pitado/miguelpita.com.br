(() => {
  "use strict";

  const VERSION = "mp-art-v7";
  const CACHE_KEY = `${VERSION}-profile`;
  const CACHE_TTL = 1000 * 60 * 60 * 24 * 7;

  const clamp = (v, min, max) =>
    Math.min(max, Math.max(min, v));

  function hashString(str) {
    let h = 2166136261;

    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;

    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;

      let t =
        Math.imul(
          a ^ (a >>> 15),
          1 | a
        );

      t =
        (
          t +
          Math.imul(
            t ^ (t >>> 7),
            61 | t
          )
        ) ^ t;

      return (
        (
          t ^
          (t >>> 14)
        ) >>> 0
      ) / 4294967296;
    };
  }

  function getRendererInfo() {
    try {
      const canvas =
        document.createElement("canvas");

      const gl =
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl");

      if (!gl) {
        return {
          vendor: "no-webgl",
          renderer: "no-webgl"
        };
      }

      const ext =
        gl.getExtension(
          "WEBGL_debug_renderer_info"
        );

      if (!ext) {
        return {
          vendor: "masked-vendor",
          renderer: "masked-renderer"
        };
      }

      return {
        vendor:
          gl.getParameter(
            ext.UNMASKED_VENDOR_WEBGL
          ) ||
          "unknown-vendor",

        renderer:
          gl.getParameter(
            ext.UNMASKED_RENDERER_WEBGL
          ) ||
          "unknown-renderer"
      };
    }
    catch {
      return {
        vendor: "renderer-error",
        renderer: "renderer-error"
      };
    }
  }

  function buildIdentity() {
    const renderer =
      getRendererInfo();

    const fingerprint = [
      screen.width || 0,
      screen.height || 0,
      screen.colorDepth || 0,
      window.devicePixelRatio || 1,
      navigator.hardwareConcurrency || 4,
      navigator.deviceMemory || 4,
      renderer.vendor,
      renderer.renderer
    ].join("|");

    const hash =
      hashString(
        fingerprint
      );

    return {
      hash,

      seed:
        hash /
        4294967295,

      renderer
    };
  }

  function estimatePower(identity) {
    const cores =
      navigator.hardwareConcurrency || 4;

    const memory =
      navigator.deviceMemory || 4;

    const dpr =
      window.devicePixelRatio || 1;

    let score =
      45;

    score +=
      clamp(
        (cores - 4) * 4,
        -10,
        24
      );

    score +=
      clamp(
        (memory - 4) * 3,
        -8,
        24
      );

    score -=
      clamp(
        (dpr - 1) * 9,
        0,
        14
      );

    const renderer =
      `${identity.renderer.vendor} ${identity.renderer.renderer}`
        .toLowerCase();

    if (
      renderer.includes("nvidia") ||
      renderer.includes("radeon") ||
      renderer.includes("apple")
    ) {
      score +=
        8;
    }

    if (
      renderer.includes("intel") ||
      renderer.includes("uhd") ||
      renderer.includes("iris")
    ) {
      score +=
        2;
    }

    return clamp(
      Math.round(score),
      18,
      92
    );
  }

  function tierFromScore(score) {
    if (score >= 68) {
      return "high";
    }

    if (score >= 42) {
      return "medium";
    }

    return "low";
  }

  function buildConfig(
    identity,
    powerScore,
    measuredFps = null
  ) {
    const tier =
      tierFromScore(
        powerScore
      );

    const random =
      mulberry32(
        identity.hash ^
        0x9E3779B9
      );

    const base = {
      low: {
        renderScale: 0.86,
        lineDensity: 30,
        structuralDensity: 8,
        warpStrength: 0.055,
        detailStrength: 0.035,
        arcOpacity: 0.045,
        speed: 0.80
      },

      medium: {
        renderScale: 1.00,
        lineDensity: 39,
        structuralDensity: 10,
        warpStrength: 0.075,
        detailStrength: 0.050,
        arcOpacity: 0.060,
        speed: 0.92
      },

      high: {
        renderScale: 1.12,
        lineDensity: 49,
        structuralDensity: 12,
        warpStrength: 0.098,
        detailStrength: 0.066,
        arcOpacity: 0.078,
        speed: 1.04
      }
    }[tier];

    return {
      tier,
      powerScore,
      measuredFps,

      renderScale:
        base.renderScale,

      lineDensity:
        base.lineDensity +
        Math.floor(
          (random() - 0.5) * 6
        ),

      structuralDensity:
        base.structuralDensity +
        (random() - 0.5) *
        1.5,

      warpStrength:
        base.warpStrength *
        (
          0.90 +
          random() *
          0.20
        ),

      detailStrength:
        base.detailStrength *
        (
          0.90 +
          random() *
          0.22
        ),

      arcOpacity:
        Math.max(
          0.02,
          base.arcOpacity +
          (random() - 0.5) *
          0.015
        ),

      speed:
        base.speed *
        (
          0.92 +
          random() *
          0.16
        ),

      massOffsetX:
        -0.39 +
        (random() - 0.5) *
        0.12,

      massOffsetY:
        -0.015 +
        (random() - 0.5) *
        0.075,

      massWidth:
        0.93 +
        (random() - 0.5) *
        0.17,

      massHeight:
        1.12 +
        (random() - 0.5) *
        0.16,

      ridgeLean:
        -0.10 +
        (random() - 0.5) *
        0.30,

      flowBend:
        0.20 +
        random() *
        0.28,

      asymmetry:
        0.16 +
        random() *
        0.24,

      openSpace:
        0.67 +
        (random() - 0.5) *
        0.08,

      phaseA:
        random() *
        Math.PI *
        2,

      phaseB:
        random() *
        Math.PI *
        2,

      phaseC:
        random() *
        Math.PI *
        2,

      flowDirection:
        random() > 0.5
          ? 1
          : -1
    };
  }

  function loadCached() {
    try {
      const raw =
        localStorage.getItem(
          CACHE_KEY
        );

      if (!raw) {
        return null;
      }

      const profile =
        JSON.parse(raw);

      if (
        !profile ||
        Date.now() -
          profile.savedAt >
          CACHE_TTL
      ) {
        return null;
      }

      return profile;
    }
    catch {
      return null;
    }
  }

  function save(profile) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify(
          profile
        )
      );
    }
    catch {}
  }

  function createProfile() {
    const cached =
      loadCached();

    if (cached) {
      return cached;
    }

    const identity =
      buildIdentity();

    const powerScore =
      estimatePower(
        identity
      );

    const profile = {
      version:
        VERSION,

      savedAt:
        Date.now(),

      identity,

      powerScore,

      tier:
        tierFromScore(
          powerScore
        ),

      config:
        buildConfig(
          identity,
          powerScore
        )
    };

    save(
      profile
    );

    return profile;
  }

  function tuneProfileFromRuntime(
    profile,
    measuredFps
  ) {
    if (
      !profile ||
      !Number.isFinite(
        measuredFps
      )
    ) {
      return profile;
    }

    let score =
      profile.powerScore;

    if (
      measuredFps >= 57
    ) {
      score += 8;
    }
    else if (
      measuredFps >= 50
    ) {
      score += 4;
    }
    else if (
      measuredFps < 32
    ) {
      score -= 18;
    }
    else if (
      measuredFps < 44
    ) {
      score -= 9;
    }

    score =
      clamp(
        Math.round(
          score
        ),
        18,
        92
      );

    const updated = {
      ...profile,

      savedAt:
        Date.now(),

      powerScore:
        score,

      tier:
        tierFromScore(
          score
        ),

      config:
        buildConfig(
          profile.identity,
          score,
          measuredFps
        )
    };

    save(
      updated
    );

    return updated;
  }

  window.MPAdaptiveArt = {
    createProfile,
    tuneProfileFromRuntime
  };
})();
