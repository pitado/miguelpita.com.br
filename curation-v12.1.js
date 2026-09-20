(() => {
  "use strict";

  if (!window.MPAdaptiveArt) {
    console.error("V12 precisa carregar antes de curation-v12.1.js.");
    return;
  }

  /* =========================================================
     CURADORIA POR REJEIÇÃO (V13)

     A V12.1 era uma curadoria de REPARO. Ela pontuava a peça e,
     se a nota fosse baixa, aplicava correção proporcional a um
     repairStrength de até 1.0: recentralizava, expandia até o
     viewport, forçava uma massa protagonista, puxava as massas
     soltas para perto, domava cavidades e achatava a cor. A nota
     mediana subia de 78 para 85.

     Esse é exatamente o mecanismo errado. Um score alto não
     descrevia "peça boa", descrevia UMA peça: larga, centrada,
     contínua, densa. Toda peça que fugisse disso era empurrada de
     volta para lá. A curadoria não estava cortando o ruim, estava
     comprimindo o meio — era a etapa que mais ativamente produzia
     a monotonia que ela deveria evitar.

     Agora ela só REJEITA. A peça quebrada é descartada e o
     gerador avança para sortear outra. A peça que apenas é
     diferente do ideal antigo passa intacta.

     E o critério mudou de natureza junto: não mede mais distância
     de um ideal estético (largura, centralidade, continuidade,
     densidade), mede QUEBRA — não há nada visível, o fade apagou
     tudo, uma cavidade engoliu a peça, a geometria degenerou. Uma
     peça íntima, esparsa e periférica é uma escolha legítima do
     DNA, não um defeito a corrigir.
  ========================================================= */

  const VERSION = "mp-art-v12.1";
  const CURATION_VERSION = "v13";

  // Abaixo disto a peça está quebrada, não apenas diferente.
  const REJECTION_THRESHOLD = 45;

  // Teto de tentativas. Determinístico: o mesmo token percorre a
  // mesma sequência de candidatas e para na mesma.
  const MAX_ATTEMPTS = 12;

  const baseApi = window.MPAdaptiveArt;
  const baseCreateProfile = baseApi.createProfile.bind(baseApi);
  const baseTuneQuality = baseApi.tuneQualityFromRuntime.bind(baseApi);
  const baseResetIdentity = baseApi.resetIdentity.bind(baseApi);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const LIMITS = baseApi.LIMITS || { maxMasses: 14, maxCavities: 6 };

  function channelLuminance(channel) {
    const value = clamp(channel || 0, 0, 1);
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function relativeLuminance(color) {
    return (
      0.2126 * channelLuminance(color?.[0]) +
      0.7152 * channelLuminance(color?.[1]) +
      0.0722 * channelLuminance(color?.[2])
    );
  }

  function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  function activeMassCount(geometry) {
    return clamp(Math.round(geometry.activeMasses || 6), 1, LIMITS.maxMasses);
  }

  function activeCavityCount(geometry) {
    return clamp(Math.round(geometry.activeCavities || 0), 0, LIMITS.maxCavities);
  }

  function rotate(x, y, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [x * c - y * s, x * s + y * c];
  }

  function getExtent(geometry) {
    const count = activeMassCount(geometry);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      const x = geometry.masses[offset];
      const y = geometry.masses[offset + 1];
      const rx = Math.max(0.025, geometry.masses[offset + 2]);
      const ry = Math.max(0.025, geometry.masses[offset + 3]);

      minX = Math.min(minX, x - rx);
      maxX = Math.max(maxX, x + rx);
      minY = Math.min(minY, y - ry);
      maxY = Math.max(maxY, y + ry);
    }

    return {
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /* ---------------------------------------------------------
     COBERTURA

     Em vez de inferir "presença" a partir de largura e
     centralidade, amostra-se uma grade no mesmo espaço
     normalizado que o shader usa e replica-se o que ele faz:
     a máscara das massas, o recorte das cavidades e os dois
     fades de enquadramento. O que sai é a fração da tela em que
     realmente existe arte desenhada.

     Mede o NUCLEO da composicao, de proposito: o campo
     estendido (u_fieldFloor) desenha textura na tela toda, e
     incluir isso aqui faria toda peca medir cobertura ~1.

     É a única medida que importa para "está quebrada?", e é
     indiferente ao estilo: uma peça íntima e uma transbordante
     podem ter a mesma cobertura por caminhos diferentes.
  --------------------------------------------------------- */
  function coverage(geometry) {
    const massCount = activeMassCount(geometry);
    const cavityCount = activeCavityCount(geometry);
    const globalAngle = geometry.globalAngle || 0;
    const fadeStart = geometry.rightFadeStart ?? 0.86;
    const fadeWidth = Math.max(0.02, geometry.fadeWidth ?? 0.76);
    const fadeStrength = clamp(geometry.fadeStrength ?? 0.15, 0, 1);
    const fadeDirection = geometry.fadeDirection || 1;
    const verticalFade = geometry.verticalFade ?? 0.96;

    const COLS = 41;
    const ROWS = 23;
    const ASPECT = 1.6;

    let visible = 0;
    let total = 0;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const px = ((col + 0.5) / COLS - 0.5) * ASPECT;
        const py = (row + 0.5) / ROWS - 0.5;

        total++;

        const [qx, qy] = rotate(px, py, globalAngle);

        let nearest = Infinity;

        for (let index = 0; index < massCount; index++) {
          const offset = index * 4;
          const dx = qx - geometry.masses[offset];
          const dy = qy - geometry.masses[offset + 1];
          const angle = geometry.massMeta[offset] || 0;
          const [rxq, ryq] = rotate(dx, dy, angle);
          const rx = Math.max(0.02, geometry.masses[offset + 2]);
          const ry = Math.max(0.02, geometry.masses[offset + 3]);
          const weight = Math.max(0.25, geometry.massMeta[offset + 2] || 1);
          const distance =
            Math.sqrt((rxq * rxq) / (rx * rx) + (ryq * ryq) / (ry * ry)) /
            weight;

          nearest = Math.min(nearest, distance);
        }

        // mesma janela de 0.78 a 1.32 do shapeMask do shader
        let presence = 1 - clamp((nearest - 0.78) / 0.54, 0, 1);

        for (let index = 0; index < cavityCount; index++) {
          const offset = index * 4;
          const dx = qx - geometry.cavities[offset];
          const dy = qy - geometry.cavities[offset + 1];
          const angle = geometry.cavityMeta[offset] || 0;
          const [rxq, ryq] = rotate(dx, dy, angle);
          const rx = Math.max(0.02, geometry.cavities[offset + 2]);
          const ry = Math.max(0.02, geometry.cavities[offset + 3]);
          const cutout = clamp(geometry.cavityMeta[offset + 3] || 0, 0, 1);
          const distance = Math.sqrt(
            (rxq * rxq) / (rx * rx) + (ryq * ryq) / (ry * ry)
          );

          presence *= 1 - cutout * Math.exp(-distance * distance * 2.4);
        }

        const horizontal =
          1 -
          clamp((qx * fadeDirection - fadeStart) / fadeWidth, 0, 1) *
            fadeStrength;
        const vertical =
          1 - clamp((Math.abs(py) - verticalFade) / 0.18, 0, 1);

        if (presence * horizontal * vertical > 0.10) {
          visible++;
        }
      }
    }

    return visible / total;
  }

  /* ---------------------------------------------------------
     DIAGNÓSTICO

     100 é uma peça sã. Cada penalidade descreve uma forma
     concreta de estar quebrada. Nada aqui pontua estilo: não há
     prêmio por ser larga, centrada, contínua ou densa, porque foi
     isso que comprimiu a população na V12.
  --------------------------------------------------------- */
  function diagnose(geometry, quality) {
    const filled = coverage(geometry);
    const extent = getExtent(geometry);
    const lineContrast = contrastRatio(
      geometry.lineColor,
      geometry.backgroundColor
    );

    const faults = [];
    let score = 100;

    /* Os limiares abaixo são medidos, não estimados. Uma peça
       deliberadamente íntima (duas massas pequenas, deslocadas para
       a periferia, com vinheta fechada) cobre cerca de 5% da tela —
       o que num monitor comum são dezenas de milhares de pixels de
       contorno desenhado, ou seja, arte perfeitamente visível.

       Na primeira versão deste arquivo o corte de "vazio" estava em
       5% e essa peça era rejeitada: eu tinha reconstruído, com outro
       nome, o mesmo viés da V12. Vazio de verdade é a peça cujas
       massas não chegaram ao viewport, e aí a cobertura é ~0,000. */
    if (filled < 0.006) {
      score -= 70;
      faults.push("vazio");
    }
    else if (filled < 0.15) {
      /* DIRECAO DE ARTE, nao defeito tecnico.

         O piso acima e o unico criterio aqui que julga forma em vez
         de quebra, e ele existe a pedido explicito do dono da obra:
         as formas devem pegar a tela. Sem ele, o campo estendido
         preenche o fundo de textura e uma composicao minuscula num
         canto passa como se estivesse cheia.

         Custo assumido: peças de composicao muito pequena somem da
         populacao, o que reduz a variedade de escala. E uma troca
         consciente, e o teste de variedade cobre o que sobrou. */
      score -= 60;
      faults.push("sem-composicao");
    }

    /* Não há penalidade por cobertura ALTA. Uma peça que preenche a
       tela inteira não é um campo chapado: o que o shader desenha
       são as linhas de contorno dentro da máscara, não um
       preenchimento. Penalizar isso seria gosto, não quebra. */

    // Geometria colapsada num ponto. A cobertura já pegaria o caso,
    // mas aqui o diagnóstico sai com nome próprio.
    if (extent.width < 0.03 && extent.height < 0.03) {
      score -= 55;
      faults.push("degenerado");
    }

    // Rede de segurança do piso de contraste, que a paleta já
    // garante na origem. Se cair aqui, algo a montante regrediu.
    if (lineContrast < 2.5) {
      score -= 45;
      faults.push("contraste");
    }

    // Densidade de linha tão baixa que não sobra desenho.
    if ((quality?.fineLineDensity || 0) < 12) {
      score -= 30;
      faults.push("sem-linha");
    }

    return {
      score: Math.round(clamp(score, 0, 100)),
      coverage: Number(filled.toFixed(4)),
      lineContrast: Number(lineContrast.toFixed(2)),
      faults
    };
  }

  // Mantido no nome antigo porque é API pública da camada.
  function scoreComposition(geometry, quality) {
    return diagnose(geometry, quality).score;
  }

  function applyCuration(profile) {
    if (!profile?.geometry || !profile?.quality) return profile;

    let best = profile;
    let bestReport = diagnose(profile.geometry, profile.quality);
    let attempts = 1;
    const rejected = [];

    // Re-sorteia avançando o gerador. Como o xoshiro é compartilhado
    // e tem estado, cada baseCreateProfile() devolve uma peça nova, e
    // a sequência de tentativas é a mesma para o mesmo token.
    while (bestReport.score < REJECTION_THRESHOLD && attempts < MAX_ATTEMPTS) {
      rejected.push({
        score: bestReport.score,
        faults: bestReport.faults.slice()
      });

      const candidate = baseCreateProfile();

      if (!candidate?.geometry || !candidate?.quality) break;

      const report = diagnose(candidate.geometry, candidate.quality);
      attempts++;

      if (report.score > bestReport.score) {
        best = candidate;
        bestReport = report;
      }
    }

    const geometry = {
      ...best.geometry,
      curation: {
        version: CURATION_VERSION,
        score: bestReport.score,
        coverage: bestReport.coverage,
        lineContrast: bestReport.lineContrast,
        faults: bestReport.faults,
        attempts,
        rejected,
        accepted: bestReport.score >= REJECTION_THRESHOLD
      }
    };

    return {
      ...best,
      version: VERSION,
      geometry
    };
  }

  function createProfile() {
    return applyCuration(baseCreateProfile());
  }

  function tuneQualityFromRuntime(profile, fps) {
    const tuned = baseTuneQuality(profile, fps);

    // Ajuste de qualidade não re-sorteia a peça: a curadoria já
    // decidiu, e re-rodar aqui trocaria a arte no meio da visita.
    if (profile?.geometry?.curation) {
      return {
        ...tuned,
        version: VERSION,
        geometry: profile.geometry
      };
    }

    return applyCuration(tuned);
  }

  window.MPAdaptiveArt = {
    ...baseApi,
    version: VERSION,
    createProfile,
    tuneQualityFromRuntime,
    resetIdentity: baseResetIdentity,
    scoreComposition,
    diagnose,
    coverage,
    REJECTION_THRESHOLD
  };
})();
