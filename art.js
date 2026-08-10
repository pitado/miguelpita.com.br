(() => {
  "use strict";

  console.log(
    "%cWEBGL1 ART V4 CARREGADO",
    "background:#111;color:#fff;padding:5px 8px;border-radius:5px;font-weight:bold"
  );

  const canvas = document.getElementById("webgl");
  const fallback = document.getElementById("fallback");

  if (!canvas) {
    console.error("Canvas #webgl não encontrado.");
    return;
  }

  const gl =
    canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance"
    }) ||
    canvas.getContext("experimental-webgl");

  if (!gl) {
    console.error("WebGL não disponível.");

    if (fallback) {
      fallback.hidden = false;
    }

    return;
  }

  const vertexShaderSource = `

    precision highp float;

    attribute vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `

    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif

    uniform vec2 u_resolution;
    uniform vec2 u_mouse;

    uniform float u_time;
    uniform float u_motion;

    float hash21(vec2 p) {
      p = fract(
        p *
        vec2(
          123.34,
          456.21
        )
      );

      p += dot(
        p,
        p + 45.32
      );

      return fract(
        p.x *
        p.y
      );
    }

    float noise(vec2 p) {
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

    float fbm(vec2 p) {
      float value =
        0.0;

      float amplitude =
        0.54;

      mat2 rot =
        mat2(
          0.80,
          -0.60,

          0.60,
          0.80
        );

      for (
        int i = 0;
        i < 5;
        i++
      ) {
        value +=
          amplitude *
          noise(p);

        p =
          rot *
          p *
          2.03 +
          9.7;

        amplitude *=
          0.50;
      }

      return value;
    }

    float lineBand(
      float value,
      float count,
      float width
    ) {
      float f =
        fract(
          value *
          count
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
          width + 0.025,
          d
        );
    }

    float thinLine(
      float d,
      float width
    ) {
      return
        1.0 -
        smoothstep(
          width,
          width + 0.004,
          abs(d)
        );
    }

    float arcStroke(
      vec2 p,
      vec2 center,
      float radius,
      float width
    ) {
      return
        1.0 -
        smoothstep(
          width,
          width + 0.0025,

          abs(
            length(
              p -
              center
            ) -
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

      p.x *=
        u_resolution.x /
        u_resolution.y;

      vec2 mouse =
        u_mouse -
        0.5;

      mouse.x *=
        u_resolution.x /
        u_resolution.y;

      float t =
        u_time;

      vec2 q =
        p;

      q.x +=
        0.070 *
        sin(
          q.y *
          3.2 +
          t *
          0.40
        );

      q.y +=
        0.058 *
        cos(
          q.x *
          3.6 -
          t *
          0.33
        );

      q +=
        vec2(
          sin(
            t *
            0.17
          ),

          cos(
            t *
            0.14
          )
        )
        *
        0.020;

      vec2 toMouse =
        q -
        mouse;

      float mouseDistance =
        length(
          toMouse
        );

      float mouseInfluence =
        exp(
          -mouseDistance *
          mouseDistance *
          7.0
        )
        *
        u_motion;

      q +=
        normalize(
          toMouse +
          0.0001
        )
        *
        mouseInfluence
        *
        0.050;

      q +=
        vec2(
          -toMouse.y,
          toMouse.x
        )
        *
        mouseInfluence
        *
        0.036;

      vec2 warpPoint =
        q *
        vec2(
          1.25,
          1.00
        );

      vec2 warp1 =
        vec2(

          fbm(
            warpPoint *
            1.35 +
            vec2(
              t *
              0.125,

              -t *
              0.095
            )
          ),

          fbm(
            warpPoint *
            1.27 +
            vec2(
              -t *
              0.105,

              t *
              0.115
            )
          )

        );

      vec2 warp2 =
        vec2(

          fbm(
            warpPoint *
            2.25 +

            warp1 *
            1.60 +

            vec2(
              5.0,
              2.0
            ) +

            vec2(
              sin(
                t *
                0.21
              ),

              cos(
                t *
                0.17
              )
            )
            *
            0.40
          ),

          fbm(
            warpPoint *
            2.05 +

            warp1.yx *
            1.50 +

            vec2(
              3.0,
              7.0
            ) +

            vec2(
              cos(
                t *
                0.18
              ),

              sin(
                t *
                0.23
              )
            )
            *
            0.35
          )

        );

      vec2 field =
        warpPoint;

      field +=
        (
          warp1 -
          0.5
        )
        *
        0.66;

      field +=
        (
          warp2 -
          0.5
        )
        *
        0.28;

      float pulse =
        0.5 +
        0.5 *
        sin(
          t *
          0.24
        );

      float pulse2 =
        0.5 +
        0.5 *
        cos(
          t *
          0.31
        );

      float centerX =
        -0.38 +
        sin(
          t *
          0.13
        )
        *
        0.11;

      float centerY =
        -0.02 +
        cos(
          t *
          0.11
        )
        *
        0.08;

      float mountainMask =

        exp(
          -pow(
            (
              q.x -
              centerX
            )
            *
            (
              1.05 +
              pulse *
              0.18
            ),

            2.0
          )
          *
          1.75
        )

        *

        exp(
          -pow(
            (
              q.y -
              centerY
            )
            *
            (
              0.82 +
              pulse2 *
              0.16
            ),

            2.0
          )
          *
          1.18
        );

      float trailMask =

        exp(
          -pow(
            (
              q.x +
              0.02
            )
            *
            (
              0.66 +
              pulse *
              0.14
            ),

            2.0
          )
          *
          0.78
        )

        *

        exp(
          -pow(
            (
              q.y +
              0.10
            )
            *
            (
              1.10 +
              pulse2 *
              0.12
            ),

            2.0
          )
          *
          1.85
        );

      float height =
        fbm(
          field *
          2.10 +

          vec2(
            sin(
              t *
              0.12
            )
            *
            0.45,

            cos(
              t *
              0.10
            )
            *
            0.38
          )
        );

      float detail =
        fbm(
          field *
          4.40 +

          warp2 *
          0.48 +

          vec2(
            cos(
              t *
              0.18
            )
            *
            0.50,

            sin(
              t *
              0.16
            )
            *
            0.46
          )
        );

      height +=
        detail *
        0.22;

      height +=
        sin(
          field.x *
          3.8 +

          field.y *
          1.5 +

          t *
          0.42
        )
        *
        0.050;

      height +=
        cos(
          field.y *
          4.6 -

          field.x *
          1.3 -

          t *
          0.34
        )
        *
        0.035;

      float fieldMask =
        clamp(
          mountainMask *
          1.10 +

          trailMask *
          0.68,

          0.0,
          1.0
        );

      float contour1 =
        lineBand(
          height,
          48.0,
          0.050
        );

      float contour2 =
        lineBand(
          height +
          detail *
          0.07,

          35.0,
          0.045
        );

      float contour3 =
        lineBand(
          height +
          warp1.x *
          0.08,

          20.0,
          0.038
        );

      float depth =
        smoothstep(
          0.42,
          0.78,

          detail *
          0.55 +

          height *
          0.45
        );

      float lineAmount =
        (
          contour1 *
          0.34 +

          contour2 *
          0.34 +

          contour3 *
          0.44 *
          depth
        )
        *
        fieldMask;

      float structural =
        lineBand(
          height +
          warp2.y *
          0.12,

          11.0,
          0.029
        )
        *
        depth
        *
        mountainMask;

      vec2 arcPoint =
        p;

      arcPoint +=
        vec2(
          sin(
            t *
            0.14
          )
          *
          0.028,

          cos(
            t *
            0.12
          )
          *
          0.020
        );

      float arcs =
        0.0;

      arcs +=
        arcStroke(
          arcPoint,

          vec2(
            -0.06,
            -0.02
          ),

          0.48 +
          sin(
            t *
            0.10
          )
          *
          0.018,

          0.0011
        )
        *
        0.26;

      arcs +=
        arcStroke(
          arcPoint,

          vec2(
            0.08,
            -0.05
          ),

          0.61 +
          cos(
            t *
            0.085
          )
          *
          0.022,

          0.0010
        )
        *
        0.20;

      arcs +=
        arcStroke(
          arcPoint,

          vec2(
            -0.13,
            0.01
          ),

          0.73 +
          sin(
            t *
            0.07
          )
          *
          0.025,

          0.0009
        )
        *
        0.14;

      float guides =
        arcs +

        thinLine(
          p.x +
          0.61 +

          sin(
            t *
            0.10
          )
          *
          0.018,

          0.0007
        )
        *
        0.16 +

        thinLine(
          p.x -
          0.34 +

          cos(
            t *
            0.09
          )
          *
          0.014,

          0.00065
        )
        *
        0.12 +

        thinLine(
          p.y +
          0.28 +

          sin(
            t *
            0.08
          )
          *
          0.012,

          0.00065
        )
        *
        0.09;

      vec3 background =
        vec3(
          0.964,
          0.953,
          0.933
        );

      background +=
        0.010 *
        sin(
          p.x *
          2.0 +
          t *
          0.10
        );

      background +=
        0.008 *
        cos(
          p.y *
          2.4 -
          t *
          0.08
        );

      vec3 soft =
        vec3(
          0.62
        );

      vec3 middle =
        vec3(
          0.45
        );

      vec3 dark =
        vec3(
          0.25
        );

      vec3 color =
        background;

      color =
        mix(
          color,
          soft,

          clamp(
            lineAmount *
            0.42,

            0.0,
            0.34
          )
        );

      color =
        mix(
          color,
          middle,

          clamp(
            lineAmount *
            0.28,

            0.0,
            0.24
          )
        );

      color =
        mix(
          color,
          dark,

          clamp(
            structural *
            0.34,

            0.0,
            0.18
          )
        );

      color =
        mix(
          color,
          vec3(
            0.50
          ),

          clamp(
            guides,
            0.0,
            0.10
          )
        );

      gl_FragColor =
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

    gl.compileShader(
      shader
    );

    if (
      !gl.getShaderParameter(
        shader,
        gl.COMPILE_STATUS
      )
    ) {
      const message =
        gl.getShaderInfoLog(
          shader
        );

      gl.deleteShader(
        shader
      );

      throw new Error(
        message ||
        "Erro ao compilar shader."
      );
    }

    return shader;
  }

  function createProgram() {
    const vertexShader =
      createShader(
        gl.VERTEX_SHADER,
        vertexShaderSource
      );

    const fragmentShader =
      createShader(
        gl.FRAGMENT_SHADER,
        fragmentShaderSource
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
      const message =
        gl.getProgramInfoLog(
          program
        );

      gl.deleteProgram(
        program
      );

      throw new Error(
        message ||
        "Erro ao linkar programa WebGL."
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
      error
    );

    if (fallback) {
      fallback.hidden =
        false;

      fallback.textContent =
        "Erro ao carregar a arte WebGL. Abra o console para ver o erro.";
    }

    return;
  }

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

  const resolutionLocation =
    gl.getUniformLocation(
      program,
      "u_resolution"
    );

  const mouseLocation =
    gl.getUniformLocation(
      program,
      "u_mouse"
    );

  const timeLocation =
    gl.getUniformLocation(
      program,
      "u_time"
    );

  const motionLocation =
    gl.getUniformLocation(
      program,
      "u_motion"
    );

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
        1.50
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

  // velocidade geral
  const SPEED =
    3.2;

  let startTime =
    performance.now();

  let previousTime =
    startTime;

  function render(now) {
    resize();

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
      1.0 -
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

    pointer.motion +=
      (
        pointer.targetMotion -
        pointer.motion
      )
      *
      smoothing
      *
      0.70;

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
      SPEED;

    gl.useProgram(
      program
    );

    gl.uniform2f(
      resolutionLocation,
      canvas.width,
      canvas.height
    );

    gl.uniform2f(
      mouseLocation,
      pointer.x,
      pointer.y
    );

    gl.uniform1f(
      timeLocation,
      time
    );

    gl.uniform1f(
      motionLocation,
      pointer.motion
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

  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();

      console.warn(
        "Contexto WebGL perdido. Recarregue a página."
      );
    },
    false
  );

  requestAnimationFrame(
    render
  );

})();
