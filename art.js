(() => {
  "use strict";

  console.log(
    "%c MIGUEL PITA · ART V5 ",
    "background:#111;color:#fff;padding:5px 9px;border-radius:5px;font-weight:bold;"
  );

  const canvas =
    document.getElementById("webgl");

  const fallback =
    document.getElementById("fallback");


  /*
  ========================================================
  VERIFICA CANVAS
  ========================================================
  */

  if (!canvas) {

    console.error(
      "Canvas #webgl não encontrado."
    );

    return;
  }


  /*
  ========================================================
  TENTA WEBGL 1
  ========================================================
  */

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


  /*
  ========================================================
  SE NÃO TIVER WEBGL → CANVAS 2D
  ========================================================
  */

  if (!gl) {

    console.warn(
      "WebGL indisponível. Usando Canvas 2D."
    );

    startCanvas2D();

    return;
  }


  console.log(
    "%c WEBGL 1 FUNCIONANDO ",
    "background:#355c3a;color:white;padding:4px 8px;border-radius:4px;"
  );


  /*
  ========================================================
  VERTEX SHADER
  ========================================================
  */

  const vertexShaderSource = `

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


  /*
  ========================================================
  FRAGMENT SHADER
  ========================================================
  */

  const fragmentShaderSource = `

    #ifdef GL_FRAGMENT_PRECISION_HIGH

      precision highp float;

    #else

      precision mediump float;

    #endif


    uniform vec2 u_resolution;

    uniform vec2 u_mouse;

    uniform float u_time;

    uniform float u_mouseStrength;



    /*
    ----------------------------------------
    RANDOM
    ----------------------------------------
    */

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



    /*
    ----------------------------------------
    NOISE
    ----------------------------------------
    */

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



    /*
    ----------------------------------------
    FBM
    ----------------------------------------
    */

    float fbm(
      vec2 p
    ) {

      float value =
        0.0;

      float amplitude =
        0.55;


      for (
        int i = 0;
        i < 4;
        i++
      ) {

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


        amplitude *=
          0.50;

      }


      return value;

    }



    /*
    ----------------------------------------
    LINHAS TOPOGRÁFICAS
    ----------------------------------------
    */

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

          width +
          0.025,

          d

        );

    }



    /*
    ----------------------------------------
    ARCOS
    ----------------------------------------
    */

    float arc(
      vec2 p,
      vec2 center,
      float radius,
      float width
    ) {

      float d =

        abs(

          length(
            p -
            center
          )

          -

          radius

        );


      return

        1.0 -

        smoothstep(

          width,

          width +
          0.002,

          d

        );

    }



    /*
    ========================================================
    MAIN
    ========================================================
    */

    void main() {


      /*
      ----------------------------------------
      COORDENADAS
      ----------------------------------------
      */

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



      /*
      ========================================================
      CAMPO BASE
      ========================================================
      */

      vec2 q =
        p;



      q.x +=

        0.065 *

        sin(

          q.y *
          3.2

          +

          t *
          0.47

        );



      q.y +=

        0.055 *

        cos(

          q.x *
          3.7

          -

          t *
          0.38

        );



      /*
      ----------------------------------------
      MOVIMENTO GLOBAL
      ----------------------------------------
      */

      q +=

        vec2(

          sin(
            t *
            0.16
          ),

          cos(
            t *
            0.13
          )

        )

        *

        0.022;



      /*
      ========================================================
      INTERAÇÃO DO MOUSE
      ========================================================
      */

      vec2 mouseVector =

        q -

        mouse;



      float mouseDistance =

        length(
          mouseVector
        );



      float influence =

        exp(

          -

          mouseDistance *

          mouseDistance *

          7.0

        )

        *

        u_mouseStrength;



      q +=

        normalize(

          mouseVector +

          0.0001

        )

        *

        influence

        *

        0.050;



      q +=

        vec2(

          -mouseVector.y,

          mouseVector.x

        )

        *

        influence

        *

        0.035;



      /*
      ========================================================
      PRIMEIRO WARP
      ========================================================
      */

      vec2 warp1 =

        vec2(


          fbm(

            q *
            1.50

            +

            vec2(

              t *
              0.14,

              -t *
              0.10

            )

          ),


          fbm(

            q *
            1.42

            +

            vec2(

              -t *
              0.11,

              t *
              0.13

            )

          )


        );



      /*
      ========================================================
      SEGUNDO WARP
      ========================================================
      */

      vec2 warp2 =

        vec2(


          fbm(

            q *
            2.50

            +

            warp1 *
            1.55

            +

            vec2(
              4.0,
              7.0
            )

          ),


          fbm(

            q *
            2.25

            +

            warp1.yx *
            1.40

            +

            vec2(
              7.0,
              2.0
            )

          )


        );



      /*
      ========================================================
      CAMPO DEFORMAÇÃO
      ========================================================
      */

      vec2 field =

        q +

        (
          warp1 -
          0.5
        )

        *

        0.62

        +

        (
          warp2 -
          0.5
        )

        *

        0.25;



      /*
      ========================================================
      FORMA PRINCIPAL
      ========================================================
      */

      float pulse =

        0.5 +

        0.5 *

        sin(
          t *
          0.22
        );



      float pulse2 =

        0.5 +

        0.5 *

        cos(
          t *
          0.29
        );



      float centerX =

        -0.35 +

        sin(
          t *
          0.11
        )

        *

        0.12;



      float centerY =

        -0.02 +

        cos(
          t *
          0.09
        )

        *

        0.08;



      float mountain =


        exp(

          -pow(

            (
              q.x -
              centerX
            )

            *

            (
              1.03 +
              pulse *
              0.18
            ),

            2.0

          )

          *

          1.65

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
              0.83 +
              pulse2 *
              0.16
            ),

            2.0

          )

          *

          1.15

        );



      /*
      ========================================================
      CAUDA
      ========================================================
      */

      float trail =


        exp(

          -pow(

            (
              q.x +
              0.02
            )

            *

            0.69,

            2.0

          )

          *

          0.72

        )


        *


        exp(

          -pow(

            (
              q.y +
              0.10
            )

            *

            1.07,

            2.0

          )

          *

          1.70

        );



      /*
      ========================================================
      ALTURA
      ========================================================
      */

      float height =

        fbm(

          field *
          2.05

          +

          vec2(

            sin(
              t *
              0.13
            )

            *

            0.43,


            cos(
              t *
              0.10
            )

            *

            0.37

          )

        );



      float detail =

        fbm(

          field *
          4.0

          +

          warp2 *
          0.42

          +

          vec2(

            cos(
              t *
              0.16
            )

            *

            0.45,


            sin(
              t *
              0.15
            )

            *

            0.42

          )

        );



      height +=

        detail *

        0.20;



      /*
      ----------------------------------------
      ONDAS EXTRA
      ----------------------------------------
      */

      height +=

        sin(

          field.x *
          4.0

          +

          field.y *
          1.6

          +

          t *
          0.42

        )

        *

        0.045;



      height +=

        cos(

          field.y *
          4.5

          -

          field.x *
          1.4

          -

          t *
          0.32

        )

        *

        0.032;



      /*
      ========================================================
      MÁSCARA
      ========================================================
      */

      float mask =

        clamp(

          mountain *
          1.10

          +

          trail *
          0.62,

          0.0,

          1.0

        );



      /*
      ========================================================
      LINHAS
      ========================================================
      */

      float line1 =

        contour(

          height,

          46.0,

          0.050

        );



      float line2 =

        contour(

          height

          +

          detail *
          0.07,

          33.0,

          0.045

        );



      float line3 =

        contour(

          height

          +

          warp1.x *
          0.08,

          19.0,

          0.038

        );



      float depth =

        smoothstep(

          0.40,

          0.78,

          detail *
          0.58

          +

          height *
          0.42

        );



      float lines =


        (

          line1 *
          0.31

          +

          line2 *
          0.34

          +

          line3 *
          0.47 *
          depth

        )

        *

        mask;



      /*
      ========================================================
      LINHAS MAIS ESCURAS
      ========================================================
      */

      float structure =

        contour(

          height

          +

          warp2.y *
          0.12,

          10.0,

          0.030

        )

        *

        depth

        *

        mountain;



      /*
      ========================================================
      ARCOS EXTERNOS
      ========================================================
      */

      vec2 arcPoint =

        p

        +

        vec2(

          sin(
            t *
            0.10
          )

          *

          0.024,


          cos(
            t *
            0.085
          )

          *

          0.018

        );



      float guides =
        0.0;



      guides +=

        arc(

          arcPoint,

          vec2(
            -0.07,
            -0.02
          ),

          0.48

          +

          sin(
            t *
            0.08
          )

          *

          0.018,

          0.0011

        )

        *

        0.20;



      guides +=

        arc(

          arcPoint,

          vec2(
            0.09,
            -0.05
          ),

          0.61

          +

          cos(
            t *
            0.07
          )

          *

          0.022,

          0.0010

        )

        *

        0.14;



      /*
      ========================================================
      FUNDO
      ========================================================
      */

      vec3 background =

        vec3(

          0.964,

          0.953,

          0.933

        );



      background +=

        sin(

          p.x *
          2.0

          +

          t *
          0.09

        )

        *

        0.007;



      background +=

        cos(

          p.y *
          2.3

          -

          t *
          0.07

        )

        *

        0.006;



      /*
      ========================================================
      CORES
      ========================================================
      */

      vec3 color =
        background;



      /*
      linhas claras
      */

      color =

        mix(

          color,

          vec3(
            0.61
          ),

          clamp(

            lines *
            0.41,

            0.0,

            0.32

          )

        );



      /*
      linhas médias
      */

      color =

        mix(

          color,

          vec3(
            0.44
          ),

          clamp(

            lines *
            0.27,

            0.0,

            0.21

          )

        );



      /*
      profundidade
      */

      color =

        mix(

          color,

          vec3(
            0.25
          ),

          clamp(

            structure *
            0.37,

            0.0,

            0.18

          )

        );



      /*
      linhas externas
      */

      color =

        mix(

          color,

          vec3(
            0.49
          ),

          clamp(

            guides,

            0.0,

            0.09

          )

        );



      gl_FragColor =

        vec4(

          color,

          1.0

        );

    }

  `;


  /*
  ========================================================
  CRIA SHADER
  ========================================================
  */

  function createShader(
    type,
    source
  ) {

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


  /*
  ========================================================
  PROGRAMA
  ========================================================
  */

  let program;


  try {

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


    program =
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

  }

  catch (error) {

    console.error(
      "Erro WebGL:",
      error
    );


    startCanvas2D();


    return;

  }


  /*
  ========================================================
  QUADRADO DE TELA INTEIRA
  ========================================================
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
  ========================================================
  UNIFORMS
  ========================================================
  */

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


  /*
  ========================================================
  MOUSE
  ========================================================
  */

  const pointer = {

    x: 0.5,

    y: 0.5,

    targetX: 0.5,

    targetY: 0.5,

    strength: 0,

    targetStrength: 0

  };


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
  ========================================================
  RESOLUÇÃO
  ========================================================
  */

  function resize() {

    /*
    1.35 deixa bonito mas não pesa
    demais na Intel UHD.
    */

    const dpr =

      Math.min(

        window.devicePixelRatio || 1,

        1.35

      );


    const width =

      Math.floor(

        window.innerWidth *

        dpr

      );


    const height =

      Math.floor(

        window.innerHeight *

        dpr

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
  ========================================================
  VELOCIDADE
  ========================================================

  2.8 = elegante
  3.4 = mais vivo
  4.5 = rápido
  */

  const SPEED =
    3.4;


  const startTime =
    performance.now();


  let previousTime =
    startTime;


  /*
  ========================================================
  LOOP
  ========================================================
  */

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


    /*
    ----------------------------------------
    suavização independente do FPS
    ----------------------------------------
    */

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

      0.65;


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



  /*
  ========================================================
  FALLBACK CANVAS 2D

  Se por algum motivo WebGL falhar,
  o site NÃO mostra tela de erro.
  Ele usa esta animação automaticamente.
  ========================================================
  */

  function startCanvas2D() {

    console.log(
      "Canvas 2D fallback ativo."
    );


    /*
    precisamos pedir outro canvas
    caso WebGL já tenha tentado iniciar
    */

    const replacement =

      canvas.cloneNode();


    canvas.parentNode.replaceChild(

      replacement,

      canvas

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


    let mouseX =
      0.5;

    let mouseY =
      0.5;


    window.addEventListener(

      "pointermove",

      event => {

        mouseX =

          event.clientX /

          window.innerWidth;


        mouseY =

          event.clientY /

          window.innerHeight;

      }

    );


    function resizeCanvas() {

      const dpr =

        Math.min(

          window.devicePixelRatio || 1,

          1.5

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


    resizeCanvas();


    window.addEventListener(

      "resize",

      resizeCanvas

    );


    function animate2D(ms) {

      const t =

        ms *
        0.001 *
        1.25;


      ctx.fillStyle =

        "#f6f3ee";


      ctx.fillRect(

        0,

        0,

        width,

        height

      );


      const lineCount =
        78;


      for (

        let line = 0;

        line < lineCount;

        line++

      ) {


        const n =

          line /

          (
            lineCount -
            1
          );


        ctx.beginPath();


        for (

          let px = -30;

          px <= width + 30;

          px += 6

        ) {


          const xn =

            px /

            width;


          const center =

            width *
            0.31

            +

            Math.sin(

              t *
              0.18

            )

            *

            width *
            0.045;


          const dx =

            (

              px -

              center

            )

            /

            (

              width *
              0.22

            );


          const mountain =

            Math.exp(

              -dx *
              dx

            );


          const wave1 =

            Math.sin(

              xn *
              8

              +

              t *
              0.72

              +

              line *
              0.06

            )

            *

            18;


          const wave2 =

            Math.cos(

              xn *
              15

              -

              t *
              0.48

              +

              line *
              0.04

            )

            *

            7;


          const mouseForce =

            Math.exp(

              -Math.pow(

                xn -

                mouseX,

                2

              )

              *

              28

            )

            *

            Math.sin(

              t +

              line *
              0.09

            )

            *

            9;


          const py =

            height *
            0.54

            +

            (
              n -
              0.5
            )

            *
            250

            -

            mountain *
            210

            +

            wave1

            +

            wave2

            +

            mouseForce;


          if (

            px === -30

          ) {

            ctx.moveTo(

              px,

              py

            );

          }

          else {

            ctx.lineTo(

              px,

              py

            );

          }

        }


        const alpha =

          0.042

          +

          (
            1 -
            n
          )

          *

          0.085;


        ctx.strokeStyle =

          `rgba(43,44,47,${alpha})`;


        ctx.lineWidth =

          line % 10 === 0

            ? 1.15

            : 0.65;


        ctx.stroke();

      }


      requestAnimationFrame(
        animate2D
      );

    }


    requestAnimationFrame(
      animate2D
    );

  }

})();
