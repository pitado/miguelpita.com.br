(() => {
  "use strict";

  const VERSION = "mp-art-v8";
  const PROFILE_KEY = `${VERSION}-profile`;
  const TOKEN_KEY = `${VERSION}-device-token`;
  const CACHE_TTL = 1000 * 60 * 60 * 24 * 30;

  const clamp = (v, a, b) =>
    Math.min(b, Math.max(a, v));

  const lerp = (a, b, t) =>
    a + (b - a) * t;

  function hashString(text) {
    let h = 2166136261;

    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;

    return () => {
      a =
        (a + 0x6D2B79F5) | 0;

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

  function between(
    rng,
    min,
    max
  ) {
    return lerp(
      min,
      max,
      rng()
    );
  }

  function getOrCreateLocalToken() {
    try {
      const current =
        localStorage.getItem(
          TOKEN_KEY
        );

      if (current) {
        return current;
      }

      const bytes =
        new Uint32Array(4);

      if (
        window.crypto?.getRandomValues
      ) {
        window.crypto.getRandomValues(
          bytes
        );
      } else {
        for (
          let i = 0;
          i < bytes.length;
          i++
        ) {
          bytes[i] =
            Math.floor(
              Math.random() *
              0xffffffff
            );
        }
      }

      const token =
        Array.from(bytes)
          .map(
            v =>
              v
                .toString(16)
                .padStart(8, "0")
          )
          .join("");

      localStorage.setItem(
        TOKEN_KEY,
        token
      );

      return token;
    }

    catch {
      return (
        `volatile-${Date.now()}-${Math.random()}`
      );
    }
  }

  function getRendererInfo() {
    try {
      const canvas =
        document.createElement(
          "canvas"
        );

      const gl =
        canvas.getContext(
          "webgl"
        ) ||
        canvas.getContext(
          "experimental-webgl"
        );

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
          vendor:
            "masked-vendor",

          renderer:
            "masked-renderer"
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
        vendor:
          "renderer-error",

        renderer:
          "renderer-error"
      };
    }
  }

  function buildIdentity() {
    const renderer =
      getRendererInfo();

    const token =
      getOrCreateLocalToken();

    const signature = [
      renderer.vendor,
      renderer.renderer,

      navigator.hardwareConcurrency ||
      0,

      navigator.deviceMemory ||
      0,

      screen.width ||
      0,

      screen.height ||
      0,

      screen.colorDepth ||
      0,

      window.devicePixelRatio ||
      1,

      token
    ].join("|");

    const hash =
      hashString(
        signature
      );

    return {
      hash,

      seed:
        hash /
        4294967295,

      token,

      renderer
    };
  }

  function estimatePower(
    identity
  ) {
    const cores =
      navigator.hardwareConcurrency ||
      4;

    const memory =
      navigator.deviceMemory ||
      4;

    const dpr =
      window.devicePixelRatio ||
      1;

    let score =
      42;

    score +=
      clamp(
        (cores - 4) * 4,
        -10,
        26
      );

    score +=
      clamp(
        (memory - 4) * 3,
        -8,
        24
      );

    score -=
      clamp(
        (dpr - 1) * 7,
        0,
        12
      );

    const renderer =
      `${identity.renderer.vendor} ${identity.renderer.renderer}`
        .toLowerCase();

    if (
      renderer.includes(
        "nvidia"
      ) ||

      renderer.includes(
        "radeon"
      ) ||

      renderer.includes(
        "geforce"
      )
    ) {
      score += 10;
    }

    if (
      renderer.includes(
        "apple"
      ) ||

      renderer.includes(
        "adreno"
      ) ||

      renderer.includes(
        "mali"
      )
    ) {
      score += 5;
    }

    if (
      renderer.includes(
        "intel"
      ) ||

      renderer.includes(
        "uhd"
      ) ||

      renderer.includes(
        "iris"
      )
    ) {
      score += 2;
    }

    return clamp(
      Math.round(score),
      15,
      95
    );
  }

  function qualityFromPower(
    powerScore
  ) {
    const t =
      clamp(
        (
          powerScore -
          15
        ) /
        80,
        0,
        1
      );

    return {
      powerScore,

      renderScale:
        lerp(
          0.76,
          1.13,
          t
        ),

      fineLineDensity:
        Math.round(
          lerp(
            30,
            56,
            t
          )
        ),

      secondaryLineDensity:
        lerp(
          20,
          38,
          t
        ),

      structuralDensity:
        lerp(
          7,
          14,
          t
        ),

      noiseWeight:
        lerp(
          0.55,
          1,
          t
        ),

      microDetail:
        lerp(
          0.018,
          0.055,
          t
        ),

      arcOpacity:
        lerp(
          0.03,
          0.07,
          t
        )
    };
  }

  function buildGeometryDNA(
    identity
  ) {
    const rng =
      mulberry32(
        identity.hash ^
        0xA511E9B3
      );

    const anchorX =
      between(
        rng,
        -0.50,
        -0.20
      );

    const anchorY =
      between(
        rng,
        -0.12,
        0.10
      );

    const globalAngle =
      between(
        rng,
        -0.80,
        0.80
      );

    const horizontalBias =
      between(
        rng,
        0.72,
        1.45
      );

    const verticalBias =
      between(
        rng,
        0.68,
        1.35
      );

    const masses = [];
    const massMeta = [];

    for (
      let i = 0;
      i < 6;
      i++
    ) {
      const progression =
        i / 5;

      masses.push(
        anchorX +
          between(
            rng,
            -0.42,
            0.54
          ) +
          progression *
          between(
            rng,
            -0.10,
            0.24
          ),

        anchorY +
          between(
            rng,
            -0.40,
            0.40
          ),

        between(
          rng,
          0.16,
          0.66
        ) *
        horizontalBias,

        between(
          rng,
          0.10,
          0.46
        ) *
        verticalBias
      );

      massMeta.push(
        globalAngle +
          between(
            rng,
            -1.05,
            1.05
          ),

        between(
          rng,
          -0.72,
          0.72
        ),

        i === 0
          ?
          between(
            rng,
            0.92,
            1.28
          )
          :
          between(
            rng,
            0.40,
            1.18
          ),

        rng() *
        Math.PI *
        2
      );
    }

    const cavities = [];
    const cavityMeta = [];

    for (
      let i = 0;
      i < 3;
      i++
    ) {
      cavities.push(
        anchorX +
          between(
            rng,
            -0.24,
            0.50
          ),

        anchorY +
          between(
            rng,
            -0.34,
            0.34
          ),

        between(
          rng,
          0.08,
          0.34
        ),

        between(
          rng,
          0.06,
          0.26
        )
      );

      cavityMeta.push(
        globalAngle +
          between(
            rng,
            -1.25,
            1.25
          ),

        between(
          rng,
          0.07,
          0.50
        ),

        rng() *
        Math.PI *
        2,

        0
      );
    }

    return {
      anchorX,
      anchorY,

      globalAngle,

      shear:
        between(
          rng,
          -0.42,
          0.42
        ),

      flowX:
        between(
          rng,
          1.0,
          5.6
        ),

      flowY:
        between(
          rng,
          0.8,
          6.0
        ),

      flowStrength:
        between(
          rng,
          0.025,
          0.20
        ),

      flowDirection:
        rng() > 0.5
          ? 1
          : -1,

      warpA:
        between(
          rng,
          0.018,
          0.14
        ),

      warpB:
        between(
          rng,
          0.012,
          0.12
        ),

      warpScaleA:
        between(
          rng,
          0.9,
          3.1
        ),

      warpScaleB:
        between(
          rng,
          2.0,
          6.3
        ),

      faultAngle:
        between(
          rng,
          -1.55,
          1.55
        ),

      faultOffset:
        between(
          rng,
          -0.22,
          0.22
        ),

      faultStrength:
        between(
          rng,
          0,
          0.20
        ),

      foldFrequencyA:
        between(
          rng,
          1.3,
          6.0
        ),

      foldFrequencyB:
        between(
          rng,
          2.0,
          8.8
        ),

      foldStrengthA:
        between(
          rng,
          0.012,
          0.085
        ),

      foldStrengthB:
        between(
          rng,
          0.005,
          0.055
        ),

      asymmetry:
        between(
          rng,
          0.10,
          0.62
        ),

      rightFadeStart:
        between(
          rng,
          -0.08,
          0.34
        ),

      verticalFade:
        between(
          rng,
          0.46,
          0.74
        ),

      animationSpeed:
        between(
          rng,
          0.58,
          1.24
        ),

      breathing:
        between(
          rng,
          0.006,
          0.048
        ),

      linePhase:
        rng() *
        Math.PI *
        2,

      technicalPhase:
        rng() *
        Math.PI *
        2,

      masses,
      massMeta,

      cavities,
      cavityMeta
    };
  }

  function loadProfile() {
    try {
      const raw =
        localStorage.getItem(
          PROFILE_KEY
        );

      if (!raw) {
        return null;
      }

      const profile =
        JSON.parse(raw);

      if (
        !profile ||

        profile.version !==
        VERSION ||

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

  function saveProfile(
    profile
  ) {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(
          profile
        )
      );
    }

    catch {}
  }

  function createProfile() {
    const cached =
      loadProfile();

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

      geometry:
        buildGeometryDNA(
          identity
        ),

      quality:
        qualityFromPower(
          powerScore
        ),

      powerScore,

      measuredFps:
        null
    };

    saveProfile(
      profile
    );

    return profile;
  }

  function tuneQualityFromRuntime(
    profile,
    fps
  ) {
    if (
      !profile ||
      !Number.isFinite(fps)
    ) {
      return profile;
    }

    let score =
      profile.powerScore;

    if (fps >= 58) {
      score += 7;
    }

    else if (
      fps >= 50
    ) {
      score += 3;
    }

    else if (
      fps < 30
    ) {
      score -= 18;
    }

    else if (
      fps < 42
    ) {
      score -= 9;
    }

    score =
      clamp(
        Math.round(
          score
        ),
        15,
        95
      );

    const updated = {
      ...profile,

      savedAt:
        Date.now(),

      powerScore:
        score,

      measuredFps:
        fps,

      quality:
        qualityFromPower(
          score
        )
    };

    saveProfile(
      updated
    );

    return updated;
  }

  function resetIdentity() {
    try {
      localStorage.removeItem(
        PROFILE_KEY
      );

      localStorage.removeItem(
        TOKEN_KEY
      );
    }

    catch {}
  }

  window.MPAdaptiveArt = {
    createProfile,
    tuneQualityFromRuntime,
    resetIdentity
  };

})();
