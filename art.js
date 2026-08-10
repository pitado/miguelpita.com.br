(() => {
  "use strict";

  const canvas = document.getElementById("webgl");
  const fallback = document.getElementById("fallback");

  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  });

  if (!gl) {
    fallback.hidden = false;
    return;
  }

  const vertexShaderSource = `#version 300 es
    precision highp float;

    layout(location = 0) in vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `#version 300 es
    precision highp float;

    out vec4 outColor;

    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    uniform float u_time;
    uniform float u_motion;

    #define PI 3.141592653589793

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);

      f = f * f * (3.0 - 2.0 * f);

      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.52;

      mat2 rot = mat2(
        0.80, -0.60,
        0.60,  0.80
      );

      for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p = rot * p * 2.02 + 13.7;
        amplitude *= 0.50;
      }

      return value;
    }

    float ridge(float x) {
      return 1.0 - abs(2.0 * x - 1.0);
    }

    float lineBand(float value, float count, float width) {
      float f = fract(value * count);
      float d = abs(f - 0.5);

      return 1.0 - smoothstep(
        width,
        width + 0.024,
        d
      );
    }

    float thinLine(float d, float width) {
      return 1.0 - smoothstep(
        width,
        width + 0.004,
        abs(d)
      );
    }

    float arcStroke(
      vec2 p,
      vec2 center,
      float radius,
      float thickness
    ) {
      return 1.0 - smoothstep(
        thickness,
        thickness + 0.0025,
        abs(length(p - center) - radius)
      );
    }

    void main() {

      vec2 frag = gl_FragCoord.xy;
      vec2 uv = frag / u_resolution;

      vec2 p = uv - 0.5;

      p.x *= u_resolution.x / u_resolution.y;

      vec2 mouse = u_mouse - 0.5;
      mouse.x *= u_resolution.x / u_resolution.y;

      float t = u_time;

      // ===========================
      // CAMPO VIVO
      // ===========================

      vec2 q = p;

      float slowA = sin(t * 0.105);
      float slowB = cos(t * 0.083);

      q.x +=
        0.035 *
        sin(q.y * 2.8 + t * 0.13);

      q.y +=
        0.026 *
        cos(q.x * 3.1 - t * 0.11);

      // ===========================
      // INTERAÇÃO COM MOUSE
      // ===========================

      vec2 toMouse = q - mouse;

      float mouseDist =
        length(toMouse);

      float mouseInfluence =
        exp(
          -mouseDist *
          mouseDist *
          8.0
        ) *
        u_motion;

      q +=
        normalize(
          toMouse + 0.0001
        ) *
        mouseInfluence *
        0.038;

      q +=
        vec2(
          -toMouse.y,
          toMouse.x
        ) *
        mouseInfluence *
        0.024;

      // ===========================
      // FORMA ABSTRATA
      // ===========================

      vec2 warpP =
        q *
        vec2(
          1.34,
          1.02
        );

      vec2 warp = vec2(

        fbm(
          warpP * 1.25 +
          vec2(
            t * 0.035,
            -t * 0.022
          )
        ),

        fbm(
          warpP * 1.18 +
          vec2(
            -t * 0.027,
            t * 0.030
          )
        )

      );

      vec2 warp2 = vec2(

        fbm(
          warpP * 2.10 +
          warp * 1.40 +
          vec2(
            7.0,
            3.0
          )
        ),

        fbm(
          warpP * 1.82 +
          warp.yx * 1.30 +
          vec2(
            2.0,
            8.0
          )
        )

      );

      vec2 fieldP =
        warpP;

      fieldP +=
        (warp - 0.5) *
        0.48;

      fieldP +=
        (warp2 - 0.5) *
        0.18;

      // ===========================
      // MÁSCARA DA "MONTANHA"
      // ===========================

      float mountainMask =

        exp(
          -pow(
            (q.x + 0.46) *
            1.02,
            2.0
          ) *
          2.0
        )

        *

        exp(
          -pow(
            (q.y + 0.03) *
            0.80,
            2.0
          ) *
          1.25
        );

      float trailMask =

        exp(
          -pow(
            (q.x + 0.05) *
            0.70,
            2.0
          ) *
          0.85
        )

        *

        exp(
          -pow(
            (q.y + 0.10) *
            1.18,
            2.0
          ) *
          2.1
        );

      float fadeRight =
        smoothstep(
          1.05,
          -0.56,
          q.x
        );

      // ===========================
      // ALTURA DO CAMPO
      // ===========================

      float height =
        fbm(
          fieldP * 2.10 +
          vec2(
            slowA * 0.12,
            slowB * 0.08
          )
        );

      float detail =
        fbm(
          fieldP * 4.2 +
          vec2(
            3.0,
            9.0
          ) +
          warp2 * 0.34
        );

      height +=
        detail *
        0.17;

      height +=
        sin(
          fieldP.x * 3.0 +
          fieldP.y * 1.2 +
          t * 0.12
        ) *
        0.035;

      float ridged =
        ridge(height);

      height +=
        ridged *
        mountainMask *
        0.085;

      float fieldMask =
        clamp(

          (
            mountainMask *
            1.12 +

            trailMask *
            0.74
          )

          *

          fadeRight,

          0.0,
          1.0
        );

      // ===========================
      // LINHAS TOPOGRÁFICAS
      // ===========================

      float contoursSoft =
        lineBand(
          height,
          43.0,
          0.052
        );

      float contoursMid =
        lineBand(
          height +
          detail *
          0.055,

          31.0,
          0.047
        );

      float contoursDark =
        lineBand(
          height +
          detail *
          0.105,

          18.0,
          0.041
        );

      float depthNoise =
        smoothstep(
          0.43,
          0.82,

          ridged *
          0.72 +

          detail *
          0.28
        );

      float lineAmount =

        contoursSoft *
        0.34

        +

        contoursMid *
        0.30

        +

        contoursDark *
        0.46 *
        depthNoise;

      lineAmount *=
        fieldMask;

      // ===========================
      // LINHAS MAIS ESCURAS
      // ===========================

      float structural =

        lineBand(

          height +
          warp.x *
          0.07,

          10.0,
          0.030

        )

        *

        smoothstep(
          0.34,
          0.84,
          depthNoise
        )

        *

        mountainMask

        *

        0.72;

      // ===========================
      // LINHAS TÉCNICAS EXTERNAS
      // ===========================

      float arcs = 0.0;

      vec2 arcP =
        p;

      arcP +=
        vec2(

          sin(
            t *
            0.035
          ) *
          0.010,

          cos(
            t *
            0.029
          ) *
          0.008

        );

      arcs +=

        arcStroke(
          arcP,
          vec2(
            -0.05,
            -0.03
          ),
          0.48,
          0.0012
        )

        *

        0.32;

      arcs +=

        arcStroke(
          arcP,
          vec2(
            0.05,
            -0.06
          ),
          0.61,
          0.0010
        )

        *

        0.22;

      arcs +=

        arcStroke(
          arcP,
          vec2(
            -0.16,
            0.00
          ),
          0.73,
          0.0009
        )

        *

        0.16;

      float verticalGuide =

        thinLine(

          p.x +
          0.60 +

          sin(
            t *
            0.026
          ) *
          0.008,

          0.0007

        )

        *

        0.18;

      float verticalGuide2 =

        thinLine(

          p.x -
          0.33 +

          cos(
            t *
            0.022
          ) *
          0.008,

          0.00065

        )

        *

        0.13;

      float horizontalGuide =

        thinLine(

          p.y +
          0.28 +

          sin(
            t *
            0.021
          ) *
          0.006,

          0.00065

        )

        *

        0.10;

      float guides =
        arcs +
        verticalGuide +
        verticalGuide2 +
        horizontalGuide;

      // ===========================
      // PEQUENOS PONTOS
      // ===========================

      vec2 grid =
        floor(
          (
            p +
            vec2(
              0.94,
              0.52
            )
          )
          *
          42.0
        );

      float dotsNoise =
        hash21(grid);

      vec2 gridUv =

        fract(

          (
            p +
            vec2(
              0.94,
              0.52
            )
          )

          *

          42.0

        )

        -

        0.5;

      float dots =

        (
          1.0 -
          smoothstep(
            0.032,
            0.060,
            length(gridUv)
          )
        )

        *

        step(
          0.965,
          dotsNoise
        )

        *

        0.10;

      // ===========================
      // FUNDO
      // ===========================

      vec3 bg =
        vec3(
          0.964,
          0.953,
          0.933
        );

      float ambient =

        0.018 *
        sin(
          p.x *
          1.9 +
          t *
          0.018
        )

        +

        0.014 *
        cos(
          p.y *
          2.3 -
          t *
          0.016
        );

      bg += ambient;

      float rightLight =

        exp(

          -dot(

            p -
            vec2(
              0.53,
              0.12
            ),

            p -
            vec2(
              0.53,
              0.12
            )

          )

          *

          1.20

        );

      bg +=
        rightLight *
        0.018;

      // ===========================
      // CORES DAS LINHAS
      // ===========================

      vec3 lineSoft =
        vec3(
          0.62,
          0.62,
          0.63
        );

      vec3 lineMid =
        vec3(
          0.48,
          0.48,
          0.50
        );

      vec3 lineDark =
        vec3(
          0.30,
          0.30,
          0.32
        );

      vec3 color =
        bg;

      color =
        mix(
          color,
          lineSoft,
          clamp(
            lineAmount *
            0.42,
            0.0,
            0.36
          )
        );

      color =
        mix(
          color,
          lineMid,
          clamp(
            lineAmount *
            0.26,
            0.0,
            0.22
          )
        );

      color =
        mix(
          color,
          lineDark,
          clamp(
            structural *
            0.36,
            0.0,
            0.18
          )
        );

      color =
        mix(
          color,
          vec3(0.52),
          clamp(
            guides,
            0.0,
            0.12
          )
        );

      color =
        mix(
          color,
          vec3(0.44),
          clamp(
            dots,
            0.0,
            0.06
          )
        );

      float vignette =
        smoothstep(

          1.18,
          0.18,

          dot(

            p *
            vec2(
              0.68,
              0.92
            ),

            p *
            vec2(
              0.68,
              0.92
            )

          )

        );

      color =
        mix(

          bg,
          color,

          0.88 +
          vignette *
          0.12

        );

      outColor =
        vec4(
          color,
          1.0
        );
    }
  `;

  function createShader(type, source) {

    const shader =
      gl.createShader(type);

    gl.shaderSource(
      shader,
      source
    );

    gl.compileShader(shader);

    if (
      !gl.getShaderParameter(
        shader,
        gl.COMPILE_STATUS
      )
    ) {

      const log =
        gl.getShaderInfoLog(shader);

      gl.deleteShader(shader);

      throw new Error(
        log ||
        "Erro ao compilar shader."
      );
    }

    return shader;
  }

  function createProgram(
    vertexSource,
    fragmentSource
  ) {

    const program =
      gl.createProgram();

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

    gl.attachShader(
      program,
      vertexShader
    );

    gl.attachShader(
      program,
      fragmentShader
    );

    gl.linkProgram(program);

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

      const log =
        gl.getProgramInfoLog(
          program
        );

      gl.deleteProgram(
        program
      );

      throw new Error(
        log ||
        "Erro ao criar programa WebGL."
      );
    }

    return program;
  }

  let program;

  try {

    program =
      createProgram(
        vertexShaderSource,
        fragmentShaderSource
      );

  } catch (error) {

    console.error(error);

    fallback.hidden =
      false;

    fallback.textContent =
      "Falha ao iniciar a arte WebGL.";

    return;
  }

  const positions =
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,

      -1,  1,
       1, -1,
       1,  1
    ]);

  const vao =
    gl.createVertexArray();

  gl.bindVertexArray(vao);

  const buffer =
    gl.createBuffer();

  gl.bindBuffer(
    gl.ARRAY_BUFFER,
    buffer
  );

  gl.bufferData(
    gl.ARRAY_BUFFER,
    positions,
    gl.STATIC_DRAW
  );

  gl.enableVertexAttribArray(0);

  gl.vertexAttribPointer(
    0,
    2,
    gl.FLOAT,
    false,
    0,
    0
  );

  const uniforms = {

    resolution:
      gl.getUniformLocation(
        program,
        "u_resolution"
      ),

    mouse:
      gl.getUniformLocation(
        program,
        "u_mouse"
      ),

    time:
      gl.getUniformLocation(
        program,
        "u_time"
      ),

    motion:
      gl.getUniformLocation(
        program,
        "u_motion"
      )
  };

  const pointer = {

    x: 0.5,
    y: 0.5,

    targetX: 0.5,
    targetY: 0.5,

    motion: 0,
    targetMotion: 0
  };

  window.addEventListener(
    "pointermove",
    (event) => {

      pointer.targetX =
        event.clientX /
        window.innerWidth;

      pointer.targetY =
        1.0 -
        event.clientY /
        window.innerHeight;

      pointer.targetMotion =
        1.0;
    }
  );

  window.addEventListener(
    "pointerleave",
    () => {

      pointer.targetX =
        0.5;

      pointer.targetY =
        0.5;

      pointer.targetMotion =
        0.0;
    }
  );

  function resize() {

    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        1.75
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
      canvas.width !== width ||
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

  const reducedMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

  let start =
    performance.now();

  let last =
    start;

  function render(now) {

    resize();

    const dt =
      Math.min(
        0.05,
        (now - last) /
        1000
      );

    last = now;

    const ease =
      1.0 -
      Math.pow(
        0.001,
        dt
      );

    pointer.x +=
      (
        pointer.targetX -
        pointer.x
      )
      *
      ease;

    pointer.y +=
      (
        pointer.targetY -
        pointer.y
      )
      *
      ease;

    pointer.motion +=
      (
        pointer.targetMotion -
        pointer.motion
      )
      *
      ease
      *
      0.72;

    const elapsed =
      (
        now -
        start
      )
      /
      1000;

    const shaderTime =
      reducedMotion.matches
        ? elapsed * 0.08
        : elapsed;

    gl.useProgram(program);

    gl.bindVertexArray(vao);

    gl.uniform2f(
      uniforms.resolution,
      canvas.width,
      canvas.height
    );

    gl.uniform2f(
      uniforms.mouse,
      pointer.x,
      pointer.y
    );

    gl.uniform1f(
      uniforms.time,
      shaderTime
    );

    gl.uniform1f(
      uniforms.motion,
      reducedMotion.matches
        ? 0.0
        : pointer.motion
    );

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

})();
