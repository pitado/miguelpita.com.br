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
      "adaptive-profile.js não foi carregado."
    );

    return;
  }

  let profile =
    window.MPAdaptiveArt
      .createProfile();

  let ART =
    profile.config;

  console.log(
    "%c MIGUEL PITA · ADAPTIVE GPU V7 ",
    "background:#111;color:#fff;padding:5px 9px;border-radius:5px;font-weight:bold"
  );

  console.log(
    "Perfil inicial:",
    {
      tier:
        profile.tier,

      powerScore:
        profile.powerScore,

      seed:
        profile.identity.seed,

      renderer:
        profile.identity.renderer,

      config:
        ART
    }
  );

  if (signature) {
    signature.textContent =
      `${profile.tier} · ${profile.powerScore} · seed ${profile.identity.hash
        .toString(16)
        .slice(0, 8)}`;
  }

  const gl =
    canvas.getContext(
      "webgl",
      {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference:
          "high-performance"
      }
    )
    ||
    canvas.getContext(
      "experimental-webgl"
    );

  if (!gl) {
    startCanvasFallback();
    return;
  }

  console.log(
    "%c WEBGL 1 ATIVO ",
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


    uniform float u_seed;

    uniform float u_lineDensity;

    uniform float u_structuralDensity;

    uniform float u_warpStrength;

    uniform float u_detailStrength;

    uniform float u_arcOpacity;


    uniform vec2 u_massOffset;

    uniform vec2 u_massScale;


    uniform float u_ridgeLean;

    uniform float u_flowBend;

    uniform float u_asymmetry;

    uniform float u_openSpace;

    uniform float u_phaseA;

    uniform float u_phaseB;

    uniform float u_phaseC;

    uniform float u_flowDirection;


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
          p + 45.32
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


      return mix(

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


      mat2 rotate =
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
          rotate *
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


    float contour(

      float value,

      float density,

      float width

    ) {

      float f =
        fract(
          value *
          density
        );


      float d =
        abs(
          f -
          0.5
        );


      return

        1.0 -

        smoothstep(

          width,

          width +
          0.024,

          d

        );
    }


    float ellipseField(

      vec2 p,

      vec2 center,

      vec2 scale,

      float bend

    ) {

      vec2 q =
        p -
        center;


      q.x +=
        q.y *
        bend;


      q /=
        scale;


      return
        length(q);
    }


    float ringStroke(

      vec2 p,

      vec2 center,

      float radius,

      float width

    ) {

      return

        1.0 -

        smoothstep(

          width,

          width +
          0.0025,

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
        gl_FragCoord.xy /
        u_resolution;


      vec2 p =
        uv -
        0.5;


      float aspect =
        u_resolution.x /
        u_resolution.y;


      p.x *=
        aspect;


      vec2 mouse =
        u_mouse -
        0.5;


      mouse.x *=
        aspect;


      float t =
        u_time;


      /*
      ==============================================
      POSIÇÃO BASE
      ==============================================
      */

      vec2 center =
        u_massOffset;


      center +=

        vec2(

          sin(
            t *
            0.055 +
            u_phaseA
          )
          *
          0.018,

          cos(
            t *
            0.047 +
            u_phaseB
          )
          *
          0.016

        );


      vec2 q =
        p -
        center;


      /*
      ==============================================
      FLUXO LATERAL
      ==============================================
      */

      q.x +=

        q.y *
        u_ridgeLean;


      q.y +=

        sin(

          q.x *
          2.4

          +

          t *
          0.060 *
          u_flowDirection

          +

          u_phaseA

        )

        *

        u_flowBend

        *

        0.080;


      /*
      ==============================================
      MOUSE
      ==============================================
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

          8.0

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

        0.026;


      /*
      ==============================================
      NOISE
      ==============================================
      */

      float n1 =

        fbm(

          q *
          1.70

          +

          vec2(

            t *
            0.030,

            -t *
            0.022

          )

          +

          u_seed *
          7.0

        );


      float n2 =

        fbm(

          q *
          3.30

          +

          vec2(

            -t *
            0.020,

            t *
            0.027

          )

          +

          u_seed *
          13.0

        );


      vec2 warped =
        q;


      warped.x +=

        (
          n1 -
          0.5
        )

        *

        u_warpStrength;


      warped.y +=

        (
          n2 -
          0.5
        )

        *

        u_warpStrength

        *

        0.78;


      /*
      ==============================================
      MASSAS PRINCIPAIS

      Elas criam o formato assimétrico.
      ==============================================
      */

      float m1 =

        ellipseField(

          warped,

          vec2(
            -0.16,
            0.02
          ),

          vec2(

            0.60 *
            u_massScale.x,

            0.42 *
            u_massScale.y

          ),

          0.12

          +

          u_ridgeLean *
          0.35

        );


      float m2 =

        ellipseField(

          warped,

          vec2(

            0.04,

            -0.09

            +

            u_asymmetry *
            0.10

          ),

          vec2(

            0.48 *
            u_massScale.x,

            0.27 *
            u_massScale.y

          ),

          -0.25

          +

          u_asymmetry *
          0.28

        );


      float m3 =

        ellipseField(

          warped,

          vec2(

            -0.30,

            0.18

            -

            u_asymmetry *
            0.12

          ),

          vec2(

            0.38 *
            u_massScale.x,

            0.23 *
            u_massScale.y

          ),

          0.30

          -

          u_ridgeLean *
          0.25

        );


      float m4 =

        ellipseField(

          warped,

          vec2(
            0.16,
            0.18
          ),

          vec2(

            0.30 *
            u_massScale.x,

            0.17 *
            u_massScale.y

          ),

          -0.12

        );


      /*
      ==============================================
      CAMPO
      ==============================================
      */

      float field =

        min(

          min(

            m1,

            m2 +
            0.10

          ),

          min(

            m3 +
            0.15,

            m4 +
            0.22

          )

        );


      /*
      ==============================================
      DOBRAS
      ==============================================
      */

      field +=

        sin(

          warped.x *
          3.4

          +

          warped.y *
          1.55

          +

          u_phaseB

          +

          t *
          0.050

        )

        *

        u_detailStrength;


      field +=

        sin(

          warped.x *
          1.55

          -

          warped.y *
          4.1

          +

          u_phaseC

          -

          t *
          0.037

        )

        *

        u_detailStrength

        *

        0.55;


      field +=

        (
          n1 -
          0.5
        )

        *

        u_detailStrength

        *

        0.90;


      field +=

        (
          n2 -
          0.5
        )

        *

        u_detailStrength

        *

        0.44;


      /*
      ==============================================
      MÁSCARA
      ==============================================
      */

      float massMask =

        1.0 -

        smoothstep(

          0.82,

          1.28,

          field

        );


      float rightEdge =

        mix(

          0.38,

          0.12,

          clamp(

            u_openSpace,

            0.55,

            0.80

          )

        );


      float rightFade =

        1.0 -

        smoothstep(

          rightEdge,

          rightEdge +
          0.55,

          p.x

        );


      float verticalFade =

        1.0 -

        smoothstep(

          0.46,

          0.74,

          abs(
            p.y
          )

        );


      float leftFade =

        smoothstep(

          -1.20,

          -0.94,

          p.x

        );


      float mask =

        massMask

        *

        rightFade

        *

        verticalFade

        *

        leftFade;


      /*
      ==============================================
      LINHAS FINAS
      ==============================================
      */

      float fine1 =

        contour(

          field,

          u_lineDensity,

          0.050

        );


      float fine2 =

        contour(

          field

          +

          n1 *
          0.018,

          u_lineDensity *
          0.76,

          0.042

        );


      float fine3 =

        contour(

          field

          +

          n2 *
          0.012,

          u_lineDensity *
          0.54,

          0.035

        );


      float fineLines =

        (

          fine1 *
          0.45

          +

          fine2 *
          0.28

          +

          fine3 *
          0.18

        )

        *

        mask;


      /*
      ==============================================
      LINHAS ESTRUTURAIS
      ==============================================
      */

      float structural =

        contour(

          field

          +

          n1 *
          0.010,

          u_structuralDensity,

          0.028

        )

        *

        mask;


      /*
      ==============================================
      ARCOS TÉCNICOS
      ==============================================
      */

      vec2 arcP =

        p

        +

        vec2(

          sin(

            t *
            0.025

            +

            u_phaseA

          )

          *

          0.010,


          cos(

            t *
            0.021

            +

            u_phaseB

          )

          *

          0.008

        );


      float technical =
        0.0;


      technical +=

        ringStroke(

          arcP,

          vec2(
            -0.08,
            -0.02
          ),

          0.55,

          0.0007

        )

        *

        u_arcOpacity;


      technical +=

        ringStroke(

          arcP,

          vec2(
            0.08,
            -0.08
          ),

          0.72,

          0.00065

        )

        *

        u_arcOpacity

        *

        0.72;


      technical +=

        ringStroke(

          arcP,

          vec2(
            -0.20,
            0.04
          ),

          0.88,

          0.00060

        )

        *

        u_arcOpacity

        *

        0.48;


      technical *=

        1.0 -

        smoothstep(

          0.42,

          0.92,

          p.x

        );


      /*
      ==============================================
      BACKGROUND
      ==============================================
      */

      vec3 background =

        vec3(

          0.965,

          0.954,

          0.936

        );


      background +=

        sin(

          p.x *
          1.4

          +

          t *
          0.015

          +

          u_phaseA

        )

        *

        0.0022;


      /*
      ==============================================
      CORES
      ==============================================
      */

      vec3 color =
        background;


      color =

        mix(

          color,

          vec3(
            0.50
          ),

          clamp(

            fineLines *
            0.22,

            0.0,

            0.22

          )

        );


      color =

        mix(

          color,

          vec3(
            0.29
          ),

          clamp(

            structural *
            0.15,

            0.0,

            0.15

          )

        );


      color =

        mix(

          color,

          vec3(
            0.48
          ),

          clamp(

            technical,

            0.0,

            0.065

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

    const vertexShader =

      createShader(

        gl.VERTEX_SHADER,

        vertexSource

      );


    const fragmentShader =

      createShader(

        gl.FRAGMENT_SHADER,

        fragmentSource

      );


    const program =
      gl.createProgram();


    gl.attachShader(

      program,

      vertexShader

    );


    gl.attachShader(

      program,

      fragmentShader

    );


    gl.linkProgram(
      program
    );


    gl.deleteShader(
      vertexShader
    );


    gl.deleteShader(
      fragmentShader
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
      "Erro WebGL:",
      error
    );


    startCanvasFallback();


    return;
  }


  /*
  ==============================================
  FULLSCREEN QUAD
  ==============================================
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
  ==============================================
  UNIFORMS
  ==============================================
  */

  const uniformNames = [

    "u_resolution",

    "u_mouse",

    "u_time",

    "u_mouseStrength",

    "u_seed",

    "u_lineDensity",

    "u_structuralDensity",

    "u_warpStrength",

    "u_detailStrength",

    "u_arcOpacity",

    "u_massOffset",

    "u_massScale",

    "u_ridgeLean",

    "u_flowBend",

    "u_asymmetry",

    "u_openSpace",

    "u_phaseA",

    "u_phaseB",

    "u_phaseC",

    "u_flowDirection"

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


  /*
  ==============================================
  MOUSE
  ==============================================
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

        1 -

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
              0.14;

          },

          180

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
  ==============================================
  RESOLUÇÃO ADAPTATIVA
  ==============================================
  */

  function resize() {

    const maxDpr =

      Math.min(

        window.devicePixelRatio || 1,

        1.45

      );


    const dpr =

      Math.max(

        0.72,

        maxDpr *
        ART.renderScale

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

      canvas.width !== width

      ||

      canvas.height !== height

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


  /*
  ==============================================
  BENCHMARK REAL

  Mede a própria arte.
  ==============================================
  */

  let benchmarkDone =
    false;


  let benchmarkStart =
    performance.now();


  let benchmarkFrames =
    0;


  function measureRuntimePerformance(
    now
  ) {

    if (
      benchmarkDone
    ) {
      return;
    }


    benchmarkFrames++;


    const elapsed =

      now -

      benchmarkStart;


    if (
      elapsed <
      2300
    ) {
      return;
    }


    const fps =

      (
        benchmarkFrames /
        elapsed
      )

      *

      1000;


    benchmarkDone =
      true;


    profile =

      window.MPAdaptiveArt
        .tuneProfileFromRuntime(

          profile,

          fps

        );


    ART =
      profile.config;


    console.log(

      "Performance real:",

      `${fps.toFixed(1)} FPS`

    );


    console.log(

      "Perfil ajustado:",

      {

        tier:
          profile.tier,

        powerScore:
          profile.powerScore,

        config:
          ART

      }

    );


    if (
      signature
    ) {

      signature.textContent =

        `${profile.tier} · ${profile.powerScore} · ${fps.toFixed(0)}fps · seed ${profile.identity.hash
          .toString(16)
          .slice(0, 8)}`;

    }
  }


  /*
  ==============================================
  ENVIA CONFIGURAÇÃO PARA GPU
  ==============================================
  */

  function sendAdaptiveUniforms() {

    gl.uniform1f(

      uniforms.u_seed,

      profile.identity.seed

    );


    gl.uniform1f(

      uniforms.u_lineDensity,

      ART.lineDensity

    );


    gl.uniform1f(

      uniforms.u_structuralDensity,

      ART.structuralDensity

    );


    gl.uniform1f(

      uniforms.u_warpStrength,

      ART.warpStrength

    );


    gl.uniform1f(

      uniforms.u_detailStrength,

      ART.detailStrength

    );


    gl.uniform1f(

      uniforms.u_arcOpacity,

      ART.arcOpacity

    );


    gl.uniform2f(

      uniforms.u_massOffset,

      ART.massOffsetX,

      ART.massOffsetY

    );


    gl.uniform2f(

      uniforms.u_massScale,

      ART.massWidth,

      ART.massHeight

    );


    gl.uniform1f(

      uniforms.u_ridgeLean,

      ART.ridgeLean

    );


    gl.uniform1f(

      uniforms.u_flowBend,

      ART.flowBend

    );


    gl.uniform1f(

      uniforms.u_asymmetry,

      ART.asymmetry

    );


    gl.uniform1f(

      uniforms.u_openSpace,

      ART.openSpace

    );


    gl.uniform1f(

      uniforms.u_phaseA,

      ART.phaseA

    );


    gl.uniform1f(

      uniforms.u_phaseB,

      ART.phaseB

    );


    gl.uniform1f(

      uniforms.u_phaseC,

      ART.phaseC

    );


    gl.uniform1f(

      uniforms.u_flowDirection,

      ART.flowDirection

    );
  }


  /*
  ==============================================
  LOOP
  ==============================================
  */

  const startTime =
    performance.now();


  let previousTime =
    startTime;


  function render(
    now
  ) {

    resize();


    measureRuntimePerformance(
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

      1 -

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

      0.56;


    const time =

      (
        (
          now -
          startTime
        )

        /

        1000
      )

      *

      ART.speed;


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


    sendAdaptiveUniforms();


    gl.drawArrays(

      gl.TRIANGLES,

      0,

      6

    );


    requestAnimationFrame(
      render
    );
  }


  requestAnimationFrame(
    render
  );


  /*
  ==============================================
  CANVAS 2D FALLBACK
  ==============================================
  */

  function startCanvasFallback() {

    console.warn(
      "WebGL indisponível. Canvas 2D ativado."
    );


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

      if (
        fallback
      ) {

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

          window.devicePixelRatio || 1,

          profile.tier === "high"

            ? 1.35

            : 1.10

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

      resize2D

    );


    const randomSeed =

      profile.identity.seed

      *

      Math.PI

      *

      2;


    function frame(
      ms
    ) {

      const t =

        ms

        *

        0.00012

        *

        ART.speed;


      ctx.fillStyle =
        "#f6f3ee";


      ctx.fillRect(

        0,

        0,

        width,

        height

      );


      const centerX =

        width

        *

        (
          0.27

          +

          (
            ART.massOffsetX +
            0.39
          )

          *

          0.13
        );


      const centerY =

        height

        *

        (
          0.50

          -

          ART.massOffsetY *
          0.10
        );


      const lineCount =

        Math.max(

          28,

          Math.round(

            ART.lineDensity

            *

            1.15

          )

        );


      for (

        let line = 0;

        line < lineCount;

        line++

      ) {

        ctx.beginPath();


        const points =
          150;


        for (

          let i = 0;

          i <= points;

          i++

        ) {

          const angle =

            (
              i /
              points
            )

            *

            Math.PI

            *

            2;


          const asymmetry =

            1

            +

            Math.sin(

              angle *
              2

              +

              randomSeed

            )

            *

            ART.asymmetry

            *

            0.22;


          const wave =

            Math.sin(

              angle *
              5

              +

              line *
              0.15

              +

              randomSeed

              +

              t

            )

            *

            (
              4

              +

              ART.warpStrength *
              55
            );


          const size =

            28

            +

            line *
            7.2;


          const rx =

            size

            *

            1.48

            *

            ART.massWidth

            *

            asymmetry

            +

            wave;


          const ry =

            size

            *

            0.72

            *

            ART.massHeight

            +

            wave *
            0.38;


          let x =

            centerX

            +

            Math.cos(
              angle
            )

            *

            rx;


          let y =

            centerY

            +

            Math.sin(
              angle
            )

            *

            ry;


          x +=

            (
              y -
              centerY
            )

            *

            ART.ridgeLean

            *

            0.25;


          x +=

            Math.sin(

              (
                y /
                Math.max(
                  1,
                  height
                )
              )

              *

              8

              +

              t

              +

              randomSeed

            )

            *

            ART.flowBend

            *

            18;


          if (
            i === 0
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

            ? "rgba(43,44,47,.15)"

            : "rgba(43,44,47,.075)";


        ctx.lineWidth =

          line % 9 === 0

            ? 0.90

            : 0.55;


        ctx.stroke();
      }


      requestAnimationFrame(
        frame
      );
    }


    requestAnimationFrame(
      frame
    );
  }
})();
