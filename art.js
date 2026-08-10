(() => {
  "use strict";

  console.log(
    "%c MIGUEL PITA · TOPOGRAPHY V6 ",
    "background:#111;color:#fff;padding:5px 9px;border-radius:5px;font-weight:bold"
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
    startCanvasFallback();
    return;
  }

  console.log(
    "%c WEBGL 1 ATIVO ",
    "background:#315c39;color:#fff;padding:4px 8px;border-radius:4px"
  );

  /* =========================================================
     VERTEX SHADER
  ========================================================= */

  const vertexSource = `
    attribute vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  /* =========================================================
     FRAGMENT SHADER
  ========================================================= */

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


    float hash(vec2 p) {

      p = fract(
        p * vec2(
          123.34,
          456.21
        )
      );

      p += dot(
        p,
        p + 45.32
      );

      return fract(
        p.x * p.y
      );
    }


    float noise(vec2 p) {

      vec2 i = floor(p);
      vec2 f = fract(p);

      f =
        f *
        f *
        (
          3.0 -
          2.0 * f
        );

      float a = hash(i);

      float b =
        hash(
          i +
          vec2(1.0, 0.0)
        );

      float c =
        hash(
          i +
          vec2(0.0, 1.0)
        );

      float d =
        hash(
          i +
          vec2(1.0, 1.0)
        );

      return mix(
        mix(a, b, f.x),
        mix(c, d, f.x),
        f.y
      );
    }


    float fbm(vec2 p) {

      float value = 0.0;
      float amplitude = 0.52;

      for(int i = 0; i < 4; i++) {

        value +=
          noise(p) *
          amplitude;

        p =
          p *
          2.03 +
          vec2(
            7.13,
            3.71
          );

        amplitude *= 0.5;
      }

      return value;
    }


    float contour(
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


    float ring(
      vec2 p,
      vec2 center,
      float radius,
      float width
    ) {

      float d =
        abs(
          length(
            p - center
          )
          -
          radius
        );

      return
        1.0 -
        smoothstep(
          width,
          width + 0.002,
          d
        );
    }


    void main() {

      /* ===============================================
         COORDENADAS
      =============================================== */

      vec2 uv =
        gl_FragCoord.xy /
        u_resolution;

      vec2 p =
        uv -
        0.5;

      float aspect =
        u_resolution.x /
        u_resolution.y;

      p.x *= aspect;


      vec2 mouse =
        u_mouse -
        0.5;

      mouse.x *= aspect;


      float t =
        u_time;


      /* ===============================================
         CENTRO DA MASSA

         negativo no X = esquerda da tela
      =============================================== */

      vec2 center =
        vec2(
          -0.36,
          -0.015
        );


      /* movimento extremamente suave */

      center.x +=
        sin(
          t * 0.055
        )
        *
        0.022;

      center.y +=
        cos(
          t * 0.047
        )
        *
        0.018;


      vec2 local =
        p -
        center;


      /* ===============================================
         MOUSE
      =============================================== */

      vec2 mouseVector =
        local -
        (
          mouse -
          center
        );

      float mouseDistance =
        length(
          p -
          mouse
        );

      float mouseInfluence =
        exp(
          -mouseDistance *
          mouseDistance *
          8.0
        )
        *
        u_mouseStrength;


      local +=
        vec2(
          -mouseVector.y,
           mouseVector.x
        )
        *
        mouseInfluence
        *
        0.025;


      /* ===============================================
         DEFORMAÇÃO LENTA
      =============================================== */

      vec2 drift =
        vec2(
          t * 0.035,
          -t * 0.028
        );


      float n1 =
        fbm(
          local *
          2.10 +
          drift
        );


      float n2 =
        fbm(
          local *
          4.20 +
          vec2(
            -t * 0.025,
             t * 0.031
          )
        );


      vec2 warped =
        local;


      warped.x +=
        (
          n1 -
          0.5
        )
        *
        0.16;


      warped.y +=
        (
          n2 -
          0.5
        )
        *
        0.105;


      /* ===============================================
         FORMATO PRINCIPAL

         Mais largo horizontalmente e compacto.
      =============================================== */

      vec2 shaped =
        warped *
        vec2(
          0.88,
          1.20
        );


      float radius =
        length(
          shaped
        );


      /* pequenas deformações nas bordas */

      radius +=
        (
          n1 -
          0.5
        )
        *
        0.18;


      radius +=
        (
          n2 -
          0.5
        )
        *
        0.065;


      radius +=
        sin(
          warped.x *
          4.1 +
          warped.y *
          1.8 +
          t * 0.11
        )
        *
        0.025;


      /* ===============================================
         MÁSCARA

         Aqui está a correção principal.
         Fora dessa área não existem curvas.
      =============================================== */

      float massMask =
        1.0 -
        smoothstep(
          0.48,
          0.77,
          radius
        );


      /* desaparece gradualmente para direita */

      float rightFade =
        1.0 -
        smoothstep(
          0.05,
          0.67,
          p.x
        );


      /* deixa o canto esquerdo respirar */

      float leftFade =
        smoothstep(
          -1.12,
          -0.91,
          p.x
        );


      /* fade superior/inferior */

      float verticalFade =
        1.0 -
        smoothstep(
          0.44,
          0.72,
          abs(p.y)
        );


      float mask =
        massMask *
        rightFade *
        leftFade *
        verticalFade;


      /* ===============================================
         CAMPO TOPOGRÁFICO
      =============================================== */

      float field =
        radius;


      field +=
        n1 *
        0.095;


      field +=
        n2 *
        0.037;


      field +=
        sin(
          warped.x *
          3.0 -
          warped.y *
          2.2 +
          t * 0.075
        )
        *
        0.018;


      /* ===============================================
         CURVAS FINAS
      =============================================== */

      float fine1 =
        contour(
          field,
          48.0,
          0.055
        );


      float fine2 =
        contour(
          field +
          n2 * 0.025,
          37.0,
          0.045
        );


      float fine3 =
        contour(
          field +
          n1 * 0.018,
          27.0,
          0.038
        );


      float fineLines =
        (
          fine1 * 0.40 +
          fine2 * 0.29 +
          fine3 * 0.19
        )
        *
        mask;


      /* ===============================================
         CURVAS ESTRUTURAIS MAIS ESCURAS
      =============================================== */

      float structural =
        contour(
          field +
          n1 * 0.02,
          11.0,
          0.030
        );


      structural *=
        mask;


      /* deixa linhas estruturais mais fortes
         perto do centro */

      float innerDepth =
        1.0 -
        smoothstep(
          0.18,
          0.64,
          radius
        );


      structural *=
        0.45 +
        innerDepth *
        0.55;


      /* ===============================================
         ARCOS TÉCNICOS EXTERNOS
      =============================================== */

      vec2 arcPosition =
        p;


      arcPosition +=
        vec2(
          sin(
            t * 0.035
          ) * 0.012,

          cos(
            t * 0.030
          ) * 0.010
        );


      float technical =
        0.0;


      technical +=
        ring(
          arcPosition,
          vec2(-0.10, -0.02),
          0.56,
          0.0008
        )
        *
        0.22;


      technical +=
        ring(
          arcPosition,
          vec2(0.02, -0.06),
          0.71,
          0.0007
        )
        *
        0.16;


      technical +=
        ring(
          arcPosition,
          vec2(-0.18, 0.01),
          0.86,
          0.00065
        )
        *
        0.10;


      /* arcos também desaparecem à direita */

      technical *=
        1.0 -
        smoothstep(
          0.43,
          0.90,
          p.x
        );


      /* ===============================================
         FUNDO
      =============================================== */

      vec3 background =
        vec3(
          0.965,
          0.954,
          0.936
        );


      /* variação extremamente leve */

      background +=
        sin(
          p.x *
          1.5 +
          t *
          0.018
        )
        *
        0.0025;


      /* ===============================================
         CORES
      =============================================== */

      vec3 color =
        background;


      /* curvas finas */

      color =
        mix(
          color,
          vec3(0.49),
          clamp(
            fineLines *
            0.23,
            0.0,
            0.23
          )
        );


      /* curvas de profundidade */

      color =
        mix(
          color,
          vec3(0.29),
          clamp(
            structural *
            0.16,
            0.0,
            0.16
          )
        );


      /* linhas técnicas */

      color =
        mix(
          color,
          vec3(0.48),
          clamp(
            technical *
            0.12,
            0.0,
            0.07
          )
        );


      gl_FragColor =
        vec4(
          color,
          1.0
        );
    }
  `;


  /* =========================================================
     COMPILAR
  ========================================================= */

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

      const error =
        gl.getShaderInfoLog(
          shader
        );

      console.error(
        "Erro no shader:",
        error
      );

      gl.deleteShader(
        shader
      );

      throw new Error(
        error
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

  } catch (error) {

    console.error(
      "Não foi possível iniciar o shader:",
      error
    );

    startCanvasFallback();

    return;
  }


  /* =========================================================
     FULLSCREEN QUAD
  ========================================================= */

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


  /* =========================================================
     UNIFORMS
  ========================================================= */

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


  const mouseStrengthLocation =
    gl.getUniformLocation(
      program,
      "u_mouseStrength"
    );


  /* =========================================================
     MOUSE
  ========================================================= */

  const pointer = {

    x: 0.5,
    y: 0.5,

    targetX: 0.5,
    targetY: 0.5,

    strength: 0,
    targetStrength: 0
  };


  let mouseTimer = null;


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
        mouseTimer
      );


      mouseTimer =
        setTimeout(
          () => {

            pointer.targetStrength =
              0.18;

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


  /* =========================================================
     RESOLUÇÃO
  ========================================================= */

  function resize() {

    /*
      Mantém boa nitidez sem destruir FPS.
    */

    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        1.25
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


  /* =========================================================
     VELOCIDADE

     Mais baixa agora porque queremos
     movimento ambiente, não "água fervendo".
  ========================================================= */

  const SPEED = 1.15;


  const startTime =
    performance.now();


  let previousTime =
    startTime;


  /* =========================================================
     LOOP
  ========================================================= */

  function render(now) {

    resize();


    const delta =
      Math.min(
        0.05,
        (
          now -
          previousTime
        ) /
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
      0.55;


    const time =
      (
        (
          now -
          startTime
        ) /
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
      mouseStrengthLocation,
      pointer.strength
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


  /* =========================================================
     FALLBACK 2D
  ========================================================= */

  function startCanvasFallback() {

    console.warn(
      "Usando Canvas 2D."
    );


    const oldCanvas =
      document.getElementById(
        "webgl"
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


    oldCanvas.replaceWith(
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


    let width;
    let height;


    function resize2D() {

      const dpr =
        Math.min(
          window.devicePixelRatio || 1,
          1.25
        );


      width =
        window.innerWidth;


      height =
        window.innerHeight;


      replacement.width =
        width *
        dpr;


      replacement.height =
        height *
        dpr;


      replacement.style.width =
        width +
        "px";


      replacement.style.height =
        height +
        "px";


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


    function frame(ms) {

      const t =
        ms *
        0.00018;


      ctx.fillStyle =
        "#f6f3ee";


      ctx.fillRect(
        0,
        0,
        width,
        height
      );


      const centerX =
        width *
        0.30;


      const centerY =
        height *
        0.51;


      for(
        let i = 0;
        i < 58;
        i++
      ) {

        const size =
          20 +
          i *
          7;


        ctx.beginPath();


        const points =
          180;


        for(
          let j = 0;
          j <= points;
          j++
        ) {

          const angle =
            (
              j /
              points
            )
            *
            Math.PI *
            2;


          const noise =
            Math.sin(
              angle *
              5 +
              i *
              0.12 +
              t
            )
            *
            8

            +

            Math.sin(
              angle *
              9 -
              t *
              0.7
            )
            *
            3;


          const rx =
            size *
            1.42 +
            noise;


          const ry =
            size *
            0.92 +
            noise *
            0.5;


          const x =
            centerX +
            Math.cos(
              angle
            )
            *
            rx;


          const y =
            centerY +
            Math.sin(
              angle
            )
            *
            ry;


          if(j === 0) {

            ctx.moveTo(
              x,
              y
            );

          } else {

            ctx.lineTo(
              x,
              y
            );
          }
        }


        ctx.strokeStyle =
          i % 9 === 0
            ? "rgba(43,44,47,.17)"
            : "rgba(43,44,47,.095)";


        ctx.lineWidth =
          i % 9 === 0
            ? 0.9
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
