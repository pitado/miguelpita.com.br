(() => {
  "use strict";

  const canvas =
    document.getElementById(
      "webgl"
    );

  const fallback =
    document.getElementById(
      "fallback"
    );

  const signature =
    document.getElementById(
      "deviceSignature"
    );

  if (!canvas) {
    console.error(
      "Canvas #webgl não encontrado."
    );

    return;
  }

  if (!window.MPAdaptiveArt) {
    console.error(
      "adaptive-profile.js V10 não carregou."
    );

    return;
  }

  let profile =
    window.MPAdaptiveArt
      .createProfile();

  let QUALITY =
    profile.quality;

  const DNA =
    profile.geometry;

  const REDUCED_MOTION =
    window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches || false;

  const artTimeValue =
    Number.parseFloat(
      new URLSearchParams(
        window.location.search
      ).get("artTime")
    );

  const ART_TIME_OVERRIDE =
    Number.isFinite(artTimeValue)
      ? artTimeValue
      : null;

  const STATIC_FRAME =
    REDUCED_MOTION ||
    ART_TIME_OVERRIDE !== null;

  const FORCE_2D =
    new URLSearchParams(
      window.location.search
    ).get("artFallback") === "1";

  console.log(
    "%c MIGUEL PITA · GPU DNA V10 ",
    "background:#111;color:#fff;padding:5px 9px;border-radius:5px;font-weight:bold"
  );

  console.log(
    "DNA do dispositivo:",
    {
      seed:
        profile.identity.seed,

      id:
        profile.identity.hash
          .toString(16)
          .padStart(
            8,
            "0"
          ),

      renderer:
        profile.identity.renderer,

      geometry:
        DNA,

      family:
        DNA.family,

      gpuSpecies:
        DNA.species,

      gpuHash:
        profile.identity.gpuHash
    }
  );

  console.log(
    "Qualidade inicial:",
    QUALITY
  );

  if (signature) {
    signature.textContent =
      `GPU ${DNA.species} · ${profile.identity.gpuHash
        .toString(16)
        .padStart(8, "0")
        .slice(0, 8)} · ${DNA.family}`;
  }

  const gl =

    FORCE_2D

    ?

    null

    :

    canvas.getContext(
      "webgl",
      {
        alpha:
          false,

        antialias:
          false,

        depth:
          false,

        stencil:
          false,

        premultipliedAlpha:
          false,

        preserveDrawingBuffer:
          false,

        powerPreference:
          "high-performance"
      }
    )

    ||

    canvas.getContext(
      "experimental-webgl"
    );

  if (!gl) {
    console.warn(
      "WebGL indisponível. Usando fallback 2D."
    );

    startCanvasFallback();

    return;
  }

  console.log(
    "%c WEBGL 1 ATIVO · DNA NA GPU ",
    "background:#315c39;color:#fff;padding:4px 8px;border-radius:4px"
  );

  const vertexSource = `

    attribute vec2 a_position;

    void main() {

      gl_Position =
        vec4(
          a_position,
          0.0,
          1.0
        );

    }

  `;

  const fragmentSource = `

    #ifdef GL_FRAGMENT_PRECISION_HIGH

      precision highp float;

    #else

      precision mediump float;

    #endif


    uniform vec2 u_resolution;

    uniform vec2 u_mouse;


    uniform float u_time;

    uniform float u_mouseStrength;

    uniform vec2 u_seed;

    uniform float u_renderMode;

    uniform vec3 u_backgroundColor;

    uniform vec3 u_lineColor;

    uniform vec3 u_accentColor;


    uniform float u_fineDensity;

    uniform float u_secondaryDensity;

    uniform float u_structuralDensity;

    uniform float u_microDetail;

    uniform float u_noiseWeight;

    uniform float u_arcOpacity;


    uniform float u_globalAngle;

    uniform float u_shear;


    uniform float u_flowX;

    uniform float u_flowY;

    uniform float u_flowStrength;

    uniform float u_flowDirection;


    uniform float u_warpA;

    uniform float u_warpB;

    uniform float u_warpScaleA;

    uniform float u_warpScaleB;


    uniform float u_faultAngle;

    uniform float u_faultOffset;

    uniform float u_faultStrength;


    uniform float u_foldFrequencyA;

    uniform float u_foldFrequencyB;

    uniform float u_foldStrengthA;

    uniform float u_foldStrengthB;


    uniform float u_asymmetry;

    uniform float u_rightFadeStart;

    uniform float u_fadeWidth;

    uniform float u_fadeStrength;

    uniform float u_fadeDirection;

    uniform float u_verticalFade;


    uniform float u_breathing;

    uniform float u_linePhase;

    uniform float u_technicalPhase;


    uniform vec4 u_massData[6];

    uniform vec4 u_massMeta[6];


    uniform vec4 u_cavityData[3];

    uniform vec4 u_cavityMeta[3];


    float hash21(
      vec2 p
    ) {

      p =
        fract(

          p *

          vec2(
            123.34,
            456.21
          )

        );


      p +=
        dot(
          p,
          p +
          45.32
        );


      return
        fract(
          p.x *
          p.y
        );

    }


    float noise(
      vec2 p
    ) {

      vec2 i =
        floor(p);


      vec2 f =
        fract(p);


      f =
        f *
        f *
        (
          3.0 -
          2.0 *
          f
        );


      float a =
        hash21(i);


      float b =
        hash21(

          i +

          vec2(
            1.0,
            0.0
          )

        );


      float c =
        hash21(

          i +

          vec2(
            0.0,
            1.0
          )

        );


      float d =
        hash21(

          i +

          vec2(
            1.0,
            1.0
          )

        );


      return

        mix(

          mix(
            a,
            b,
            f.x
          ),

          mix(
            c,
            d,
            f.x
          ),

          f.y

        );

    }


    float fbm(
      vec2 p
    ) {

      float value =
        0.0;


      float amplitude =
        0.55;


      mat2 rot =
        mat2(

          0.80,
          -0.60,

          0.60,
          0.80

        );


      for (
        int i = 0;
        i < 4;
        i++
      ) {

        value +=
          amplitude *
          noise(p);


        p =
          rot *
          p *
          2.03

          +

          vec2(
            7.13,
            3.71
          );


        amplitude *=
          0.50;

      }


      return value;

    }


    vec2 rotate2D(
      vec2 p,
      float angle
    ) {

      float c =
        cos(angle);


      float s =
        sin(angle);


      return

        mat2(

          c,
          -s,

          s,
          c

        )

        *

        p;

    }


    float ellipseDistance(

      vec2 p,

      vec4 data,

      vec4 meta

    ) {

      vec2 q =
        p -
        data.xy;


      q =
        rotate2D(
          q,
          meta.x
        );


      q.x +=
        q.y *
        meta.y;


      q /=
        max(
          data.zw,
          vec2(0.02)
        );


      float breathing =

        sin(

          u_time *
          0.075

          +

          meta.w

        )

        *

        u_breathing;


      return

        length(q)

        +

        breathing;

    }


    float contour(

      float value,

      float density,

      float width

    ) {

      float f =

        fract(

          value *
          density

          +

          u_linePhase *
          0.03

        );


      float d =
        abs(
          f -
          0.5
        );


      return

        1.0

        -

        smoothstep(

          width,

          width +
          0.024,

          d

        );

    }


    float ringStroke(

      vec2 p,

      vec2 center,

      float radius,

      float width

    ) {

      return

        1.0

        -

        smoothstep(

          width,

          width +
          0.0023,

          abs(

            length(
              p -
              center
            )

            -

            radius

          )

        );

    }


    void main() {

      vec2 uv =

        gl_FragCoord.xy

        /

        u_resolution;


      vec2 p =
        uv -
        0.5;


      float aspect =

        u_resolution.x

        /

        u_resolution.y;


      p.x *=
        aspect;


      float portraitScale =

        mix(

          1.0,

          1.34,

          1.0 -
          smoothstep(
            0.56,
            0.92,
            aspect
          )

        );


      p *=
        portraitScale;


      vec2 mouse =
        u_mouse -
        0.5;


      mouse.x *=
        aspect;


      mouse *=
        portraitScale;


      /*
      =========================================
      DNA GLOBAL
      =========================================
      */

      vec2 q =

        rotate2D(

          p,

          u_globalAngle

        );


      q.x +=

        q.y *

        u_shear;


      /*
      =========================================
      FLUXO
      =========================================
      */

      q.x +=

        sin(

          q.y *
          u_flowY

          +

          u_time *
          0.045 *
          u_flowDirection

          +

          u_seed.x *
          9.0

        )

        *

        u_flowStrength;


      q.y +=

        cos(

          q.x *
          u_flowX

          -

          u_time *
          0.037 *
          u_flowDirection

          +

          u_seed.y *
          13.0

        )

        *

        u_flowStrength

        *

        0.72;


      /*
      =========================================
      MOUSE
      =========================================
      */

      vec2 mouseDelta =

        p -
        mouse;


      float mouseInfluence =

        exp(

          -dot(
            mouseDelta,
            mouseDelta
          )

          *

          7.0

        )

        *

        u_mouseStrength;


      q +=

        vec2(

          -mouseDelta.y,

          mouseDelta.x

        )

        *

        mouseInfluence

        *

        0.030;


      /*
      =========================================
      FALHA GEOLÓGICA
      =========================================
      */

      vec2 faultNormal =

        vec2(

          cos(
            u_faultAngle
          ),

          sin(
            u_faultAngle
          )

        );


      float faultSide =

        dot(

          q,

          faultNormal

        )

        -

        u_faultOffset;


      q +=

        faultNormal.yx

        *

        vec2(
          1.0,
          -1.0
        )

        *

        sign(
          faultSide
        )

        *

        u_faultStrength

        *

        smoothstep(

          0.0,

          0.18,

          abs(
            faultSide
          )

        );


      /*
      =========================================
      WARP
      =========================================
      */

      float n1 =

        fbm(

          q *
          u_warpScaleA

          +

          vec2(

            u_time *
            0.022,

            -u_time *
            0.018

          )

          +

          u_seed *
          vec2(
            37.0,
            91.0
          )

        );


      float n2 =

        fbm(

          q *
          u_warpScaleB

          +

          vec2(

            -u_time *
            0.017,

            u_time *
            0.021

          )

          +

          u_seed.yx *
          vec2(
            113.0,
            47.0
          )

        );


      vec2 warped =
        q;


      warped.x +=

        (
          n1 -
          0.5
        )

        *

        u_warpA;


      warped.y +=

        (
          n2 -
          0.5
        )

        *

        u_warpB;


      /*
      =========================================
      MASSAS DO DNA
      =========================================
      */

      float combined =
        100.0;


      float softPresence =
        0.0;


      for (

        int i = 0;

        i < 6;

        i++

      ) {

        float d =

          ellipseDistance(

            warped,

            u_massData[i],

            u_massMeta[i]

          );


        float weighted =

          d

          /

          max(

            0.25,

            u_massMeta[i].z

          );


        combined =

          min(

            combined,

            weighted

          );


        softPresence +=

          exp(

            -weighted *

            weighted *

            2.1

          )

          *

          u_massMeta[i].z;

      }


      /*
      =========================================
      CAVIDADES
      =========================================
      */

      float cavityForce =
        0.0;


      float cavityCutout =
        0.0;


      for (

        int i = 0;

        i < 3;

        i++

      ) {

        vec2 c =

          warped

          -

          u_cavityData[i].xy;


        c =

          rotate2D(

            c,

            u_cavityMeta[i].x

          );


        c /=

          max(

            u_cavityData[i].zw,

            vec2(
              0.02
            )

          );


        float cd =
          length(c);


        float cavityPresence =

          exp(

            -cd *
            cd *
            2.4

          );


        cavityForce +=

          cavityPresence

          *

          u_cavityMeta[i].y

          *

          (

            0.80

            +

            0.20

            *

            sin(

              u_time *
              0.055

              +

              u_cavityMeta[i].z

            )

          );


        cavityCutout +=

          cavityPresence

          *

          u_cavityMeta[i].w;

      }


      /*
      =========================================
      DOBRAS
      =========================================
      */

      float foldA =

        sin(

          warped.x *
          u_foldFrequencyA

          +

          warped.y *
          (
            0.7 +
            u_asymmetry *
            2.0
          )

          +

          u_linePhase

          +

          u_time *
          0.034

        )

        *

        u_foldStrengthA;


      float foldB =

        cos(

          warped.y *
          u_foldFrequencyB

          -

          warped.x *
          (
            0.9 +
            u_asymmetry *
            1.5
          )

          +

          u_technicalPhase

          -

          u_time *
          0.027

        )

        *

        u_foldStrengthB;


      /*
      =========================================
      CAMPO FINAL
      =========================================
      */

      float field =
        combined;


      field +=
        foldA +
        foldB;


      field +=

        (
          n1 -
          0.5
        )

        *

        u_microDetail

        *

        u_noiseWeight;


      field +=

        (
          n2 -
          0.5
        )

        *

        u_microDetail

        *

        0.55

        *

        u_noiseWeight;


      field +=

        cavityForce *

        0.22;


      /*
      =========================================
      MÁSCARA
      =========================================
      */

      float presenceMask =

        smoothstep(

          0.10,

          1.15,

          softPresence

        );


      float shapeMask =

        1.0

        -

        smoothstep(

          0.78,

          1.32,

          combined

        );


      float rightFade =

        mix(

          1.0,

          1.0 -
          smoothstep(

            u_rightFadeStart,

            u_rightFadeStart +
            u_fadeWidth,

            q.x *
            u_fadeDirection

          ),

          u_fadeStrength

        );


      float verticalFade =

        1.0

        -

        smoothstep(

          u_verticalFade,

          u_verticalFade +
          0.18,

          abs(
            p.y
          )

        );


      float leftFade =

        smoothstep(

          -1.24,

          -0.96,

          p.x

        );


      float mask =

        max(

          shapeMask,

          presenceMask *
          0.52

        )

        *

        rightFade

        *

        verticalFade

        *

        leftFade

        *

        (
          1.0 -
          clamp(
            cavityCutout,
            0.0,
            0.82
          )
        );


      /*
      =========================================
      LINHAS
      =========================================
      */

      vec2 modeP =
        warped -
        u_massData[0].xy;


      float mode =
        floor(
          u_renderMode +
          0.5
        );


      float lineField =
        field;


      float densityScale =
        1.0;


      float technicalScale =
        1.0;


      if (
        mode > 0.5 &&
        mode < 1.5
      ) {

        vec2 crystalP =
          rotate2D(
            modeP,
            0.785398 +
            u_globalAngle *
            0.35
          );


        lineField =
          combined *
          0.34 +
          abs(crystalP.x) *
          1.55 +
          abs(crystalP.y) *
          0.82 +
          floor(
            abs(crystalP.x + crystalP.y) *
            7.0
          ) *
          0.045;


        densityScale =
          0.72;


        technicalScale =
          0.28;

      }
      else if (
        mode > 1.5 &&
        mode < 2.5
      ) {

        float polarAngle =
          atan(
            modeP.y,
            modeP.x
          );


        lineField =
          length(modeP) *
          2.35 +
          combined *
          0.15 +
          sin(
            polarAngle *
            (3.0 + floor(u_seed.x * 5.0)) +
            u_time *
            0.035
          ) *
          0.075;


        densityScale =
          0.58;


        technicalScale =
          2.15;

      }
      else if (
        mode > 2.5 &&
        mode < 3.5
      ) {

        lineField =
          modeP.y *
          2.8 +
          sin(
            modeP.x *
            (9.0 + u_flowX) +
            n1 *
            3.2 +
            u_time *
            0.08
          ) *
          0.19 +
          combined *
          0.09;


        densityScale =
          0.48;


        technicalScale =
          0.18;

      }
      else if (
        mode > 3.5 &&
        mode < 4.5
      ) {

        vec2 cell =
          abs(
            fract(
              modeP *
              (5.0 + floor(u_seed.y * 4.0)) +
              u_seed *
              3.0
            ) -
            0.5
          );


        lineField =
          max(cell.x, cell.y) +
          combined *
          0.055 +
          n2 *
          0.035;


        densityScale =
          1.85;


        technicalScale =
          0.10;

      }
      else if (
        mode > 4.5
      ) {

        lineField =
          combined *
          0.32 +
          abs(
            cavityForce -
            0.28
          ) *
          1.75 +
          n1 *
          0.12;


        densityScale =
          0.36;


        technicalScale =
          0.62;

      }

      float fineA =

        contour(

          lineField,

          u_fineDensity *
          densityScale,

          0.050

        );


      float fineB =

        contour(

          lineField

          +

          n1 *
          0.015,

          u_secondaryDensity,

          0.041

        );


      float fineC =

        contour(

          lineField

          +

          n2 *
          0.010,

          u_secondaryDensity *
          0.67,

          0.034

        );


      float fineLines =

        (

          fineA *
          0.46

          +

          fineB *
          0.27

          +

          fineC *
          0.16

        )

        *

        mask;


      float structural =

        contour(

          lineField

          +

          foldA *
          0.25,

          u_structuralDensity,

          0.027

        )

        *

        mask;


      /*
      =========================================
      ARCOS TÉCNICOS
      =========================================
      */

      vec2 technicalCenter =

        rotate2D(

          u_massData[0].xy,

          -u_globalAngle

        )

        +

        vec2(

          sin(
            u_technicalPhase
          )

          *

          0.10,

          cos(
            u_technicalPhase
          )

          *

          0.07

        );


      float technical =
        0.0;


      technical +=

        ringStroke(

          p,

          technicalCenter,

          0.48

          +

          fract(

            u_seed.x *
            9.13

          )

          *

          0.12,

          0.00075

        )

        *

        u_arcOpacity;


      technical +=

        ringStroke(

          p,

          technicalCenter

          +

          vec2(
            0.16,
            -0.08
          ),

          0.67

          +

          fract(

            u_seed.y *
            17.71

          )

          *

          0.14,

          0.00065

        )

        *

        u_arcOpacity

        *

        0.62;


      technical *=

        1.0

        -

        smoothstep(

          0.40,

          0.90,

          p.x

        ) *
        technicalScale;


      /*
      =========================================
      FUNDO
      =========================================
      */

      vec3 background =

        u_backgroundColor;


      background +=

        sin(

          p.x *
          1.2

          +

          u_time *
          0.012

          +

          dot(
            u_seed,
            vec2(
              8.0,
              13.0
            )
          )

        )

        *

        0.0020;


      /*
      =========================================
      COR
      =========================================
      */

      vec3 color =
        background;


      color =

        mix(

          color,

          u_lineColor,

          clamp(

            fineLines *
            0.225,

            0.0,

            0.225

          )

        );


      color =

        mix(

          color,

          u_accentColor,

          clamp(

            structural *
            0.155,

            0.0,

            0.155

          )

        );


      color =

        mix(

          color,

          mix(
            u_lineColor,
            u_accentColor,
            0.45
          ),

          clamp(

            technical,

            0.0,

            0.060

          )

        );


      gl_FragColor =

        vec4(

          color,

          1.0

        );

    }

  `;


  function createShader(
    type,
    source
  ) {

    const shader =
      gl.createShader(
        type
      );


    gl.shaderSource(
      shader,
      source
    );


    gl.compileShader(
      shader
    );


    if (
      !gl.getShaderParameter(
        shader,
        gl.COMPILE_STATUS
      )
    ) {

      const error =
        gl.getShaderInfoLog(
          shader
        );


      gl.deleteShader(
        shader
      );


      throw new Error(
        error ||
        "Erro ao compilar shader."
      );
    }


    return shader;
  }


  function createProgram() {

    const vs =
      createShader(
        gl.VERTEX_SHADER,
        vertexSource
      );


    const fs =
      createShader(
        gl.FRAGMENT_SHADER,
        fragmentSource
      );


    const program =
      gl.createProgram();


    gl.attachShader(
      program,
      vs
    );


    gl.attachShader(
      program,
      fs
    );


    gl.linkProgram(
      program
    );


    gl.deleteShader(
      vs
    );


    gl.deleteShader(
      fs
    );


    if (
      !gl.getProgramParameter(
        program,
        gl.LINK_STATUS
      )
    ) {

      throw new Error(

        gl.getProgramInfoLog(
          program
        )

      );
    }


    return program;
  }


  let program;


  try {

    program =
      createProgram();

  }

  catch (error) {

    console.error(
      "Erro no shader V9:",
      error
    );


    startCanvasFallback();


    return;
  }


  /*
  =========================================
  QUAD
  =========================================
  */

  const vertices =

    new Float32Array([

      -1, -1,

       1, -1,

      -1,  1,


      -1,  1,

       1, -1,

       1,  1

    ]);


  const buffer =
    gl.createBuffer();


  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    buffer
  );


  gl.bufferData(
    gl.ARRAY_BUFFER,
    vertices,
    gl.STATIC_DRAW
  );


  const positionLocation =

    gl.getAttribLocation(
      program,
      "a_position"
    );


  gl.enableVertexAttribArray(
    positionLocation
  );


  gl.vertexAttribPointer(

    positionLocation,

    2,

    gl.FLOAT,

    false,

    0,

    0

  );


  /*
  =========================================
  UNIFORMS
  =========================================
  */

  const uniformNames = [

    "u_resolution",

    "u_mouse",

    "u_time",

    "u_mouseStrength",

    "u_seed",

    "u_renderMode",

    "u_backgroundColor",

    "u_lineColor",

    "u_accentColor",

    "u_fineDensity",

    "u_secondaryDensity",

    "u_structuralDensity",

    "u_microDetail",

    "u_noiseWeight",

    "u_arcOpacity",

    "u_globalAngle",

    "u_shear",

    "u_flowX",

    "u_flowY",

    "u_flowStrength",

    "u_flowDirection",

    "u_warpA",

    "u_warpB",

    "u_warpScaleA",

    "u_warpScaleB",

    "u_faultAngle",

    "u_faultOffset",

    "u_faultStrength",

    "u_foldFrequencyA",

    "u_foldFrequencyB",

    "u_foldStrengthA",

    "u_foldStrengthB",

    "u_asymmetry",

    "u_rightFadeStart",

    "u_fadeWidth",

    "u_fadeStrength",

    "u_fadeDirection",

    "u_verticalFade",

    "u_breathing",

    "u_linePhase",

    "u_technicalPhase"

  ];


  const uniforms = {};


  uniformNames.forEach(
    name => {

      uniforms[name] =

        gl.getUniformLocation(

          program,

          name

        );

    }
  );


  uniforms.u_massData =

    gl.getUniformLocation(

      program,

      "u_massData[0]"

    );


  uniforms.u_massMeta =

    gl.getUniformLocation(

      program,

      "u_massMeta[0]"

    );


  uniforms.u_cavityData =

    gl.getUniformLocation(

      program,

      "u_cavityData[0]"

    );


  uniforms.u_cavityMeta =

    gl.getUniformLocation(

      program,

      "u_cavityMeta[0]"

    );


  /*
  =========================================
  MOUSE
  =========================================
  */

  const pointer = {

    x: 0.5,

    y: 0.5,

    targetX: 0.5,

    targetY: 0.5,

    strength: 0,

    targetStrength: 0

  };


  let pointerTimer =
    null;


  window.addEventListener(

    "pointermove",

    event => {

      pointer.targetX =

        event.clientX /

        window.innerWidth;


      pointer.targetY =

        1

        -

        event.clientY /

        window.innerHeight;


      pointer.targetStrength =
        1;


      clearTimeout(
        pointerTimer
      );


      pointerTimer =

        setTimeout(

          () => {

            pointer.targetStrength =
              0.12;

          },

          170

        );

    }
  );


  window.addEventListener(

    "pointerleave",

    () => {

      pointer.targetX =
        0.5;


      pointer.targetY =
        0.5;


      pointer.targetStrength =
        0;

    }
  );


  /*
  =========================================
  RESOLUÇÃO
  =========================================
  */

  function resize() {

    const deviceDpr =

      Math.min(

        window.devicePixelRatio ||
        1,

        1.50

      );


    const dpr =

      Math.min(

        deviceDpr *
        QUALITY.renderScale,

        Math.sqrt(

          QUALITY.pixelBudget

          /

          Math.max(
            1,
            window.innerWidth *
            window.innerHeight
          )

        )

      );


    const width =

      Math.max(

        1,

        Math.floor(

          window.innerWidth *

          dpr

        )

      );


    const height =

      Math.max(

        1,

        Math.floor(

          window.innerHeight *

          dpr

        )

      );


    if (

      canvas.width !==
      width

      ||

      canvas.height !==
      height

    ) {

      canvas.width =
        width;


      canvas.height =
        height;


      gl.viewport(

        0,

        0,

        width,

        height

      );

    }
  }


  const massData =

    new Float32Array(
      DNA.masses
    );


  const massMeta =

    new Float32Array(
      DNA.massMeta
    );


  const cavityData =

    new Float32Array(
      DNA.cavities
    );


  const cavityMeta =

    new Float32Array(
      DNA.cavityMeta
    );


  /*
  =========================================
  ENVIA DNA PARA GPU
  =========================================
  */

  function sendDNAUniforms() {

    gl.uniform2f(
      uniforms.u_seed,
      profile.identity.seedA,
      profile.identity.seedB
    );


    gl.uniform1f(
      uniforms.u_globalAngle,
      DNA.globalAngle
    );


    gl.uniform1f(
      uniforms.u_shear,
      DNA.shear
    );


    gl.uniform1f(
      uniforms.u_flowX,
      DNA.flowX
    );


    gl.uniform1f(
      uniforms.u_flowY,
      DNA.flowY
    );


    gl.uniform1f(
      uniforms.u_flowStrength,
      DNA.flowStrength
    );


    gl.uniform1f(
      uniforms.u_flowDirection,
      DNA.flowDirection
    );


    gl.uniform1f(
      uniforms.u_warpA,
      DNA.warpA
    );


    gl.uniform1f(
      uniforms.u_warpB,
      DNA.warpB
    );


    gl.uniform1f(
      uniforms.u_warpScaleA,
      DNA.warpScaleA
    );


    gl.uniform1f(
      uniforms.u_warpScaleB,
      DNA.warpScaleB
    );


    gl.uniform1f(
      uniforms.u_faultAngle,
      DNA.faultAngle
    );


    gl.uniform1f(
      uniforms.u_faultOffset,
      DNA.faultOffset
    );


    gl.uniform1f(
      uniforms.u_faultStrength,
      DNA.faultStrength
    );


    gl.uniform1f(
      uniforms.u_foldFrequencyA,
      DNA.foldFrequencyA
    );


    gl.uniform1f(
      uniforms.u_foldFrequencyB,
      DNA.foldFrequencyB
    );


    gl.uniform1f(
      uniforms.u_foldStrengthA,
      DNA.foldStrengthA
    );


    gl.uniform1f(
      uniforms.u_foldStrengthB,
      DNA.foldStrengthB
    );


    gl.uniform1f(
      uniforms.u_asymmetry,
      DNA.asymmetry
    );


    gl.uniform1f(
      uniforms.u_rightFadeStart,
      DNA.rightFadeStart
    );


    gl.uniform1f(
      uniforms.u_renderMode,
      DNA.renderMode
    );


    gl.uniform3fv(
      uniforms.u_backgroundColor,
      DNA.backgroundColor
    );


    gl.uniform3fv(
      uniforms.u_lineColor,
      DNA.lineColor
    );


    gl.uniform3fv(
      uniforms.u_accentColor,
      DNA.accentColor
    );


    gl.uniform1f(
      uniforms.u_fadeWidth,
      DNA.fadeWidth
    );


    gl.uniform1f(
      uniforms.u_fadeStrength,
      DNA.fadeStrength
    );


    gl.uniform1f(
      uniforms.u_fadeDirection,
      DNA.fadeDirection
    );


    gl.uniform1f(
      uniforms.u_verticalFade,
      DNA.verticalFade
    );


    gl.uniform1f(
      uniforms.u_breathing,
      DNA.breathing
    );


    gl.uniform1f(
      uniforms.u_linePhase,
      DNA.linePhase
    );


    gl.uniform1f(
      uniforms.u_technicalPhase,
      DNA.technicalPhase
    );


    gl.uniform4fv(
      uniforms.u_massData,
      massData
    );


    gl.uniform4fv(
      uniforms.u_massMeta,
      massMeta
    );


    gl.uniform4fv(
      uniforms.u_cavityData,
      cavityData
    );


    gl.uniform4fv(
      uniforms.u_cavityMeta,
      cavityMeta
    );

  }


  /*
  =========================================
  QUALIDADE
  =========================================
  */

  function sendQualityUniforms() {

    gl.uniform1f(
      uniforms.u_fineDensity,
      QUALITY.fineLineDensity
    );


    gl.uniform1f(
      uniforms.u_secondaryDensity,
      QUALITY.secondaryLineDensity
    );


    gl.uniform1f(
      uniforms.u_structuralDensity,
      QUALITY.structuralDensity
    );


    gl.uniform1f(
      uniforms.u_microDetail,
      QUALITY.microDetail
    );


    gl.uniform1f(
      uniforms.u_noiseWeight,
      QUALITY.noiseWeight
    );


    gl.uniform1f(
      uniforms.u_arcOpacity,
      QUALITY.arcOpacity
    );

  }


  gl.useProgram(
    program
  );


  sendDNAUniforms();


  sendQualityUniforms();


  /*
  =========================================
  BENCHMARK
  =========================================
  */

  let benchmarkDone =
    STATIC_FRAME;


  let benchmarkStart =
    performance.now();


  let benchmarkFrames =
    0;


  function measurePerformance(
    now
  ) {

    if (
      benchmarkDone
    ) {
      return;
    }


    const pageIsActive =
      !document.hidden

      &&

      (
        typeof document.hasFocus !==
          "function"

        ||

        document.hasFocus()
      );


    if (
      !pageIsActive
    ) {

      benchmarkStart =
        now;


      benchmarkFrames =
        0;


      return;

    }


    benchmarkFrames++;


    const elapsed =

      now -

      benchmarkStart;


    if (
      elapsed <
      2400
    ) {
      return;
    }


    if (
      benchmarkFrames <
      45
    ) {

      if (
        elapsed >=
        6000
      ) {

        benchmarkDone =
          true;

      }


      return;

    }


    const fps =

      benchmarkFrames

      /

      elapsed

      *

      1000;


    benchmarkDone =
      true;


    profile =

      window.MPAdaptiveArt
        .tuneQualityFromRuntime(

          profile,

          fps

        );


    QUALITY =
      profile.quality;


    sendQualityUniforms();


    resize();


    console.log(

      `Performance real: ${fps.toFixed(1)} FPS`

    );


    console.log(

      "Qualidade ajustada (DNA preservado):",

      QUALITY

    );


    if (signature) {

      signature.textContent =

        `DNA ${profile.identity.hash
          .toString(16)
          .padStart(8, "0")
          .slice(0, 8)} · ${DNA.species} · ${fps.toFixed(0)}fps`;

    }

  }


  /*
  =========================================
  LOOP
  =========================================
  */

  const startTime =
    performance.now();


  let previousTime =
    startTime;


  document.addEventListener(

    "visibilitychange",

    () => {

      previousTime =
        performance.now();


      if (
        !benchmarkDone
      ) {

        benchmarkStart =
          previousTime;


        benchmarkFrames =
          0;

      }


      if (
        !document.hidden &&
        STATIC_FRAME
      ) {

        requestAnimationFrame(
          render
        );

      }

    }

  );


  function render(
    now
  ) {

    if (
      document.hidden
    ) {

      previousTime =
        now;


      if (
        !benchmarkDone
      ) {

        benchmarkStart =
          now;


        benchmarkFrames =
          0;

      }


      if (
        !STATIC_FRAME
      ) {

        requestAnimationFrame(
          render
        );

      }


      return;

    }

    resize();


    measurePerformance(
      now
    );


    const delta =

      Math.min(

        0.05,

        (
          now -
          previousTime
        )

        /

        1000

      );


    previousTime =
      now;


    const smoothing =

      1

      -

      Math.pow(

        0.001,

        delta

      );


    pointer.x +=

      (
        pointer.targetX -
        pointer.x
      )

      *

      smoothing;


    pointer.y +=

      (
        pointer.targetY -
        pointer.y
      )

      *

      smoothing;


    pointer.strength +=

      (
        pointer.targetStrength -
        pointer.strength
      )

      *

      smoothing

      *

      0.55;


    const time =

      ART_TIME_OVERRIDE

      ??

      (

        REDUCED_MOTION

        ?

        0

        :

        (

          (
            now -
            startTime
          )

          /

          1000
        )

        *

        DNA.animationSpeed

      );


    gl.useProgram(
      program
    );


    gl.uniform2f(

      uniforms.u_resolution,

      canvas.width,

      canvas.height

    );


    gl.uniform2f(

      uniforms.u_mouse,

      pointer.x,

      pointer.y

    );


    gl.uniform1f(

      uniforms.u_time,

      time

    );


    gl.uniform1f(

      uniforms.u_mouseStrength,

      pointer.strength

    );


    gl.drawArrays(

      gl.TRIANGLES,

      0,

      6

    );


    if (
      !STATIC_FRAME
    ) {

      requestAnimationFrame(
        render
      );

    }

  }


  requestAnimationFrame(
    render
  );


  if (
    STATIC_FRAME
  ) {

    window.addEventListener(

      "resize",

      () =>
        requestAnimationFrame(
          render
        ),

      {
        passive: true
      }

    );

  }


  /*
  =========================================
  FALLBACK 2D
  =========================================
  */

  function startCanvasFallback() {

    const replacement =

      document.createElement(
        "canvas"
      );


    replacement.id =
      "webgl";


    replacement.setAttribute(

      "aria-hidden",

      "true"

    );


    canvas.replaceWith(
      replacement
    );


    const ctx =

      replacement.getContext(
        "2d"
      );


    if (!ctx) {

      if (fallback) {

        fallback.hidden =
          false;

      }

      return;
    }


    let width =
      0;


    let height =
      0;


    function resize2D() {

      const dpr =

        Math.min(

          window.devicePixelRatio ||
          1,

          1.2,

          Math.sqrt(

            QUALITY.pixelBudget

            /

            Math.max(
              1,
              window.innerWidth *
              window.innerHeight
            )

          )

        );


      width =
        window.innerWidth;


      height =
        window.innerHeight;


      replacement.width =

        Math.floor(

          width *
          dpr

        );


      replacement.height =

        Math.floor(

          height *
          dpr

        );


      replacement.style.width =

        `${width}px`;


      replacement.style.height =

        `${height}px`;


      ctx.setTransform(

        dpr,

        0,

        0,

        dpr,

        0,

        0

      );

    }


    resize2D();


    window.addEventListener(

      "resize",

      () => {

        resize2D();


        if (
          STATIC_FRAME
        ) {

          requestAnimationFrame(
            frame
          );

        }

      }

    );


    document.addEventListener(

      "visibilitychange",

      () => {

        if (
          !document.hidden &&
          STATIC_FRAME
        ) {

          requestAnimationFrame(
            frame
          );

        }

      }

    );


    const seed =

      profile.identity.seed

      *

      Math.PI

      *

      2;


    function drawGeneratedFallback(
      time
    ) {

      const cssColor =
        (color, alpha = 1) =>
          `rgba(${color.map(value => Math.round(value * 255)).join(",")},${alpha})`;


      const lineColor =
        DNA.lineColor ||
        [0.24, 0.24, 0.25];


      const accentColor =
        DNA.accentColor ||
        [0.14, 0.14, 0.15];

      const activeMasses =
        DNA.activeMasses ||
        6;


      const activeCavities =
        DNA.activeCavities ||
        3;


      const portraitProgress =
        Math.min(
          1,
          Math.max(
            0,
            (
              width /
              height -
              0.56
            ) /
            0.36
          )
        );


      const portraitSmooth =
        portraitProgress *
        portraitProgress *
        (
          3 -
          2 *
          portraitProgress
        );


      const portraitScale =
        1 +
        (
          1 -
          portraitSmooth
        ) *
        0.34;


      const geometryScale =
        height /
        portraitScale;


      const rotation =
        -DNA.globalAngle;


      const rotationCos =
        Math.cos(rotation);


      const rotationSin =
        Math.sin(rotation);


      const toCanvasPoint =
        (x, y) => {

          const rotatedX =
            x * rotationCos -
            y * rotationSin;


          const rotatedY =
            x * rotationSin +
            y * rotationCos;


          return [
            width * 0.5 +
              rotatedX *
              geometryScale,

            height * 0.5 -
              rotatedY *
              geometryScale
          ];

        };


      const ringCount =
        Math.max(
          5,
          Math.round(
            QUALITY.fineLineDensity /
            6
          )
        );


      ctx.save();


      ctx.lineCap =
        "round";


      for (
        let massIndex = 0;
        massIndex < activeMasses;
        massIndex++
      ) {

        const offset =
          massIndex * 4;


        const center =
          toCanvasPoint(
            DNA.masses[offset],
            DNA.masses[offset + 1]
          );


        const radiusX =
          DNA.masses[offset + 2] *
          geometryScale;


        const radiusY =
          DNA.masses[offset + 3] *
          geometryScale;


        const weight =
          DNA.massMeta[offset + 2];


        const phase =
          DNA.massMeta[offset + 3];


        const angle =
          -(
            DNA.globalAngle +
            DNA.massMeta[offset]
          );


        const breathing =
          1 +
          Math.sin(
            time * 0.75 +
            phase
          ) *
          DNA.breathing;


        for (
          let ring = 0;
          ring < ringCount;
          ring++
        ) {

          const level =
            (ring + 1) /
            (ringCount + 1);


          const scale =
            (0.34 + level * 0.74) *
            weight *
            breathing;


          const scaledX =
            Math.max(1, radiusX * scale);


          const scaledY =
            Math.max(1, radiusY * scale);


          ctx.beginPath();


          if (
            DNA.renderMode === 1 ||
            DNA.renderMode === 4
          ) {

            const sides =
              DNA.renderMode === 1
                ? 4
                : 6;


            for (
              let side = 0;
              side <= sides;
              side++
            ) {

              const theta =
                angle +
                side / sides *
                Math.PI * 2;


              const x =
                center[0] +
                Math.cos(theta) *
                scaledX;


              const y =
                center[1] +
                Math.sin(theta) *
                scaledY;


              if (side === 0) {
                ctx.moveTo(x, y);
              }
              else {
                ctx.lineTo(x, y);
              }

            }

          }
          else {

            ctx.ellipse(
              center[0],
              center[1],
              scaledX,
              scaledY,
              angle,
              0,
              Math.PI * 2
            );

          }


          ctx.strokeStyle =
            ring % 4 === 0
              ? cssColor(accentColor, 0.15)
              : cssColor(lineColor, 0.085);


          ctx.lineWidth =
            ring % 4 === 0
              ? 0.9
              : 0.55;


          ctx.stroke();

        }

      }


      for (
        let cavityIndex = 0;
        cavityIndex < activeCavities;
        cavityIndex++
      ) {

        const offset =
          cavityIndex * 4;


        const center =
          toCanvasPoint(
            DNA.cavities[offset],
            DNA.cavities[offset + 1]
          );


        const cutout =
          DNA.cavityMeta[offset + 3];


        const radiusScale =
          0.72 +
          cutout * 0.34;


        ctx.beginPath();


        ctx.ellipse(
          center[0],
          center[1],
          Math.max(
            1,
            DNA.cavities[offset + 2] *
              geometryScale *
              radiusScale
          ),
          Math.max(
            1,
            DNA.cavities[offset + 3] *
              geometryScale *
              radiusScale
          ),
          -(
            DNA.globalAngle +
            DNA.cavityMeta[offset]
          ),
          0,
          Math.PI * 2
        );


        ctx.fillStyle =
          cssColor(
            DNA.backgroundColor ||
            [0.965, 0.954, 0.936]
          );


        ctx.fill();


        ctx.strokeStyle =
          cssColor(lineColor, 0.075);


        ctx.lineWidth =
          0.6;


        ctx.stroke();

      }


      const technicalCenter =
        toCanvasPoint(
          DNA.masses[0],
          DNA.masses[1]
        );


      ctx.strokeStyle =
        cssColor(
          lineColor,
          DNA.renderMode === 2
            ? 0.12
            : 0.045
        );


      ctx.lineWidth =
        0.6;


      ctx.beginPath();


      ctx.arc(
        technicalCenter[0],
        technicalCenter[1],
        geometryScale *
          (
            0.46 +
            profile.identity.seedA *
            0.10
          ),
        0,
        Math.PI * 2
      );


      ctx.stroke();


      if (
        DNA.renderMode === 3
      ) {

        ctx.strokeStyle =
          cssColor(lineColor, 0.10);


        ctx.lineWidth =
          0.65;


        for (
          let strand = -8;
          strand <= 8;
          strand++
        ) {

          const y =
            height * 0.5 +
            strand *
            height *
            0.032;


          ctx.beginPath();


          ctx.moveTo(
            0,
            y
          );


          ctx.bezierCurveTo(
            width * 0.28,
            y + Math.sin(seed + strand) * 38,
            width * 0.68,
            y - Math.cos(seed * 0.7 + strand) * 46,
            width,
            y + Math.sin(seed * 1.3 + strand) * 24
          );


          ctx.stroke();

        }

      }


      ctx.restore();

    }


    function frame(
      ms
    ) {

      ctx.fillStyle =
        (() => {
          const color =
            DNA.backgroundColor ||
            [0.965, 0.954, 0.936];

          return `rgb(${color.map(value => Math.round(value * 255)).join(",")})`;
        })();


      ctx.fillRect(

        0,

        0,

        width,

        height

      );


      const t =

        ART_TIME_OVERRIDE

        ??

        (

          REDUCED_MOTION

          ?

          0

          :

          ms *
          0.00013 *
          DNA.animationSpeed

        );


      if (
        DNA.family
      ) {

        drawGeneratedFallback(
          t
        );


        if (
          !STATIC_FRAME
        ) {

          requestAnimationFrame(
            frame
          );

        }


        return;

      }


      const count =

        Math.max(

          26,

          Math.round(

            QUALITY.fineLineDensity

          )

        );


      for (

        let line = 0;

        line < count;

        line++

      ) {

        ctx.beginPath();


        const level =

          line

          /

          Math.max(

            1,

            count - 1

          );


        for (

          let x = -30;

          x <=
          width + 30;

          x += 5

        ) {

          const nx =
            x /
            width;


          let y =

            height

            *

            (
              0.48

              +

              DNA.anchorY *
              0.12
            );


          y +=

            (
              level -
              0.5
            )

            *

            height

            *

            0.70;


          y +=

            Math.sin(

              nx *
              DNA.flowX *
              3

              +

              seed

              +

              t

            )

            *

            30

            *

            DNA.flowStrength

            *

            5;


          y +=

            Math.sin(

              nx *
              DNA.foldFrequencyA *
              2

              +

              line *
              0.09

              +

              seed

            )

            *

            14;


          const envelope =

            Math.exp(

              -Math.pow(

                (

                  nx

                  -

                  (
                    0.31

                    +

                    DNA.anchorX *
                    0.08
                  )

                )

                /

                0.34,

                2

              )

            );


          y -=

            envelope

            *

            height

            *

            0.18

            *

            Math.sin(

              level *
              Math.PI

            );


          if (
            x === -30
          ) {

            ctx.moveTo(
              x,
              y
            );

          }

          else {

            ctx.lineTo(
              x,
              y
            );

          }

        }


        ctx.strokeStyle =

          line % 9 === 0

            ?

            "rgba(43,44,47,.15)"

            :

            "rgba(43,44,47,.075)";


        ctx.lineWidth =

          line % 9 === 0

            ?

            0.9

            :

            0.55;


        ctx.stroke();

      }


      if (
        !STATIC_FRAME
      ) {

        requestAnimationFrame(
          frame
        );

      }

    }


    requestAnimationFrame(
      frame
    );

  }

})();
