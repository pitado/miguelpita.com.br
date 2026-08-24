(() => {
  "use strict";

  if (!window.MPAdaptiveArt) {
    console.error("V12 precisa carregar antes de curation-v12.1.js.");
    return;
  }

  const VERSION = "mp-art-v12.1";
  const baseApi = window.MPAdaptiveArt;
  const baseCreateProfile = baseApi.createProfile.bind(baseApi);
  const baseTuneQuality = baseApi.tuneQualityFromRuntime.bind(baseApi);
  const baseResetIdentity = baseApi.resetIdentity.bind(baseApi);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;

  function cloneGeometry(geometry) {
    return {
      ...geometry,
      masses: [...geometry.masses],
      massMeta: [...geometry.massMeta],
      cavities: [...geometry.cavities],
      cavityMeta: [...geometry.cavityMeta],
      backgroundColor: [...geometry.backgroundColor],
      lineColor: [...geometry.lineColor],
      accentColor: [...geometry.accentColor]
    };
  }

  function luminance(color) {
    return (
      (color?.[0] || 0) * 0.2126 +
      (color?.[1] || 0) * 0.7152 +
      (color?.[2] || 0) * 0.0722
    );
  }

  function darkenToGap(color, background, minimumGap) {
    const result = [...color];
    const backgroundLum = luminance(background);
    let guard = 0;

    while (backgroundLum - luminance(result) < minimumGap && guard < 20) {
      for (let i = 0; i < 3; i++) {
        result[i] = clamp(result[i] * 0.91, 0, 1);
      }
      guard++;
    }

    return result;
  }

  function activeMassCount(geometry) {
    return clamp(Math.round(geometry.activeMasses || 6), 1, 6);
  }

  function activeCavityCount(geometry) {
    return clamp(Math.round(geometry.activeCavities || 0), 0, 3);
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
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) * 0.5,
      centerY: (minY + maxY) * 0.5
    };
  }

  function getCentroid(geometry) {
    const count = activeMassCount(geometry);
    let x = 0;
    let y = 0;
    let totalWeight = 0;

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      const rx = Math.max(0.025, geometry.masses[offset + 2]);
      const ry = Math.max(0.025, geometry.masses[offset + 3]);
      const weight = Math.max(0.02, rx * ry);

      x += geometry.masses[offset] * weight;
      y += geometry.masses[offset + 1] * weight;
      totalWeight += weight;
    }

    return {
      x: x / Math.max(0.001, totalWeight),
      y: y / Math.max(0.001, totalWeight)
    };
  }

  function centerPresence(geometry) {
    const count = activeMassCount(geometry);
    let best = 0;

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      const x = geometry.masses[offset];
      const y = geometry.masses[offset + 1];
      const rx = Math.max(0.05, geometry.masses[offset + 2]);
      const ry = Math.max(0.05, geometry.masses[offset + 3]);
      const distance = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry));
      best = Math.max(best, Math.exp(-distance * 0.72));
    }

    return best;
  }

  function continuityScore(geometry) {
    const count = activeMassCount(geometry);
    if (count <= 1) return 1;

    let connected = 0;

    for (let index = 0; index < count; index++) {
      const a = index * 4;
      const ax = geometry.masses[a];
      const ay = geometry.masses[a + 1];
      const arx = Math.max(0.05, geometry.masses[a + 2]);
      const ary = Math.max(0.05, geometry.masses[a + 3]);
      let nearest = Infinity;

      for (let other = 0; other < count; other++) {
        if (other === index) continue;
        const b = other * 4;
        const bx = geometry.masses[b];
        const by = geometry.masses[b + 1];
        const brx = Math.max(0.05, geometry.masses[b + 2]);
        const bry = Math.max(0.05, geometry.masses[b + 3]);
        const dx = (ax - bx) / Math.max(0.12, arx + brx);
        const dy = (ay - by) / Math.max(0.10, ary + bry);
        nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy));
      }

      if (nearest <= 1.65) connected++;
    }

    return connected / count;
  }

  function centralCutoutRisk(geometry) {
    const count = activeCavityCount(geometry);
    let risk = 0;

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      const x = geometry.cavities[offset];
      const y = geometry.cavities[offset + 1];
      const rx = Math.max(0.025, geometry.cavities[offset + 2]);
      const ry = Math.max(0.025, geometry.cavities[offset + 3]);
      const cutout = clamp(geometry.cavityMeta[offset + 3] || 0, 0, 1);
      const distance = Math.sqrt(x * x + y * y);
      const area = rx * ry;
      const centrality = 1 - clamp(distance / 0.46, 0, 1);
      risk = Math.max(risk, centrality * cutout * clamp(area / 0.055, 0, 1));
    }

    return risk;
  }

  function scoreComposition(geometry, quality) {
    const extent = getExtent(geometry);
    const centroid = getCentroid(geometry);
    const center = centerPresence(geometry);
    const continuity = continuityScore(geometry);
    const cavityRisk = centralCutoutRisk(geometry);
    const bgLum = luminance(geometry.backgroundColor);
    const lineGap = bgLum - luminance(geometry.lineColor);
    const accentGap = bgLum - luminance(geometry.accentColor);

    const widthScore = clamp((extent.width - 1.05) / 0.62, 0, 1);
    const heightScore = clamp((extent.height - 0.68) / 0.28, 0, 1);
    const centroidScore = 1 - clamp(
      Math.sqrt((centroid.x / 0.48) ** 2 + (centroid.y / 0.30) ** 2),
      0,
      1
    );
    const contrastScore = (
      clamp(lineGap / 0.18, 0, 1) * 0.45 +
      clamp(accentGap / 0.28, 0, 1) * 0.55
    );
    const densityScore = clamp(((quality?.fineLineDensity || 0) - 18) / 18, 0, 1);

    return Math.round(
      100 * (
        widthScore * 0.16 +
        heightScore * 0.14 +
        centroidScore * 0.12 +
        center * 0.16 +
        continuity * 0.17 +
        contrastScore * 0.16 +
        densityScore * 0.09
      ) -
      cavityRisk * 16
    );
  }

  function recenter(geometry, strength) {
    const centroid = getCentroid(geometry);
    const count = activeMassCount(geometry);
    const shiftX = clamp(centroid.x, -0.42, 0.42) * strength;
    const shiftY = clamp(centroid.y, -0.28, 0.28) * strength;

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      geometry.masses[offset] -= shiftX;
      geometry.masses[offset + 1] -= shiftY;
    }

    const cavityCount = activeCavityCount(geometry);
    for (let index = 0; index < cavityCount; index++) {
      const offset = index * 4;
      geometry.cavities[offset] -= shiftX;
      geometry.cavities[offset + 1] -= shiftY;
    }
  }

  function expandToViewport(geometry, targetWidth, targetHeight) {
    const extent = getExtent(geometry);
    const scaleX = clamp(targetWidth / Math.max(0.35, extent.width), 1, 1.42);
    const scaleY = clamp(targetHeight / Math.max(0.28, extent.height), 1, 1.34);
    const count = activeMassCount(geometry);

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      geometry.masses[offset] *= scaleX;
      geometry.masses[offset + 1] *= scaleY;
      geometry.masses[offset + 2] *= Math.sqrt(scaleX);
      geometry.masses[offset + 3] *= Math.sqrt(scaleY);
    }

    const cavityCount = activeCavityCount(geometry);
    for (let index = 0; index < cavityCount; index++) {
      const offset = index * 4;
      geometry.cavities[offset] *= scaleX;
      geometry.cavities[offset + 1] *= scaleY;
      geometry.cavities[offset + 2] *= Math.sqrt(scaleX);
      geometry.cavities[offset + 3] *= Math.sqrt(scaleY);
    }
  }

  function ensureHeroMass(geometry, strength) {
    const count = activeMassCount(geometry);
    let bestIndex = 0;
    let bestArea = -Infinity;

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      const area = geometry.masses[offset + 2] * geometry.masses[offset + 3];
      if (area > bestArea) {
        bestArea = area;
        bestIndex = index;
      }
    }

    const offset = bestIndex * 4;
    geometry.masses[offset] = lerp(geometry.masses[offset], 0, 0.34 * strength);
    geometry.masses[offset + 1] = lerp(geometry.masses[offset + 1], 0, 0.42 * strength);
    geometry.masses[offset + 2] = Math.max(geometry.masses[offset + 2], lerp(0.28, 0.38, strength));
    geometry.masses[offset + 3] = Math.max(geometry.masses[offset + 3], lerp(0.16, 0.24, strength));
    geometry.massMeta[offset + 2] = Math.max(geometry.massMeta[offset + 2] || 0.8, 0.92);

    geometry.heroMass = bestIndex;
    geometry.anchorX = geometry.masses[offset];
    geometry.anchorY = geometry.masses[offset + 1];
  }

  function repairContinuity(geometry, strength) {
    const count = activeMassCount(geometry);
    const hero = clamp(geometry.heroMass || 0, 0, count - 1);
    const heroOffset = hero * 4;
    const hx = geometry.masses[heroOffset];
    const hy = geometry.masses[heroOffset + 1];

    for (let index = 0; index < count; index++) {
      if (index === hero) continue;
      const offset = index * 4;
      const x = geometry.masses[offset];
      const y = geometry.masses[offset + 1];
      const distance = Math.sqrt((x - hx) ** 2 + (y - hy) ** 2);

      if (distance > 0.74) {
        const pull = clamp((distance - 0.72) / 0.75, 0, 1) * 0.30 * strength;
        geometry.masses[offset] = lerp(x, hx, pull);
        geometry.masses[offset + 1] = lerp(y, hy, pull);
        geometry.masses[offset + 2] *= 1 + 0.14 * strength;
        geometry.masses[offset + 3] *= 1 + 0.12 * strength;
      }
    }
  }

  function tameCavities(geometry, strength) {
    const count = activeCavityCount(geometry);

    for (let index = 0; index < count; index++) {
      const offset = index * 4;
      const distance = Math.sqrt(geometry.cavities[offset] ** 2 + geometry.cavities[offset + 1] ** 2);
      const centrality = 1 - clamp(distance / 0.48, 0, 1);
      const cutoutLimit = lerp(0.66, 0.42, centrality * strength);

      geometry.cavityMeta[offset + 3] = Math.min(geometry.cavityMeta[offset + 3] || 0, cutoutLimit);

      if (centrality > 0.5) {
        geometry.cavities[offset + 2] *= lerp(1, 0.82, strength);
        geometry.cavities[offset + 3] *= lerp(1, 0.84, strength);
      }
    }
  }

  function stabilizeStyle(geometry, quality, strength) {
    geometry.lineColor = darkenToGap(
      geometry.lineColor,
      geometry.backgroundColor,
      lerp(0.16, 0.21, strength)
    );
    geometry.accentColor = darkenToGap(
      geometry.accentColor,
      geometry.backgroundColor,
      lerp(0.25, 0.31, strength)
    );

    geometry.fadeStrength = Math.min(geometry.fadeStrength ?? 0.15, 0.16);
    geometry.rightFadeStart = Math.max(geometry.rightFadeStart || 0, 0.86);
    geometry.fadeWidth = Math.max(geometry.fadeWidth || 0, 0.76);
    geometry.verticalFade = Math.max(geometry.verticalFade || 0, 0.96);

    geometry.asymmetry = Math.min(geometry.asymmetry ?? 0.5, lerp(0.90, 0.78, strength));
    geometry.faultStrength = Math.min(geometry.faultStrength ?? 0.05, lerp(0.19, 0.145, strength));
    geometry.warpA = Math.min(geometry.warpA ?? 0.06, lerp(0.17, 0.135, strength));
    geometry.warpB = Math.min(geometry.warpB ?? 0.05, lerp(0.15, 0.12, strength));

    if (strength >= 0.72 && (geometry.renderMode === 1 || geometry.renderMode === 4)) {
      geometry.renderMode = 0;
      geometry.renderModeFallback = "topographic";
    }

    quality.fineLineDensity = Math.max(quality.fineLineDensity || 0, 30);
    quality.secondaryLineDensity = Math.max(quality.secondaryLineDensity || 0, 20);
    quality.structuralDensity = Math.max(quality.structuralDensity || 0, 7);
    quality.noiseWeight = clamp(quality.noiseWeight ?? 0.8, 0.42, 1.24);
    quality.microDetail = clamp(quality.microDetail ?? 0.04, 0.018, 0.075);
    quality.arcOpacity = clamp(quality.arcOpacity ?? 0.06, 0.012, 0.15);
  }

  function applyCuration(profile) {
    if (!profile?.geometry || !profile?.quality) return profile;

    const geometry = cloneGeometry(profile.geometry);
    const quality = { ...profile.quality };
    const scoreBefore = scoreComposition(geometry, quality);

    let repairStrength = 0.18;
    if (scoreBefore < 58) repairStrength = 1.0;
    else if (scoreBefore < 70) repairStrength = 0.78;
    else if (scoreBefore < 80) repairStrength = 0.48;

    recenter(geometry, lerp(0.24, 0.82, repairStrength));
    expandToViewport(
      geometry,
      lerp(1.54, 1.72, repairStrength),
      lerp(0.88, 1.00, repairStrength)
    );
    ensureHeroMass(geometry, repairStrength);
    repairContinuity(geometry, repairStrength);
    tameCavities(geometry, repairStrength);
    stabilizeStyle(geometry, quality, repairStrength);

    const scoreAfter = scoreComposition(geometry, quality);

    geometry.curation = {
      version: "v12.1",
      scoreBefore,
      scoreAfter,
      repaired: repairStrength >= 0.48,
      repairStrength: Number(repairStrength.toFixed(2))
    };

    return {
      ...profile,
      version: VERSION,
      geometry,
      quality
    };
  }

  function createProfile() {
    return applyCuration(baseCreateProfile());
  }

  function tuneQualityFromRuntime(profile, fps) {
    const tuned = baseTuneQuality(profile, fps);
    const curated = applyCuration(tuned);

    if (profile?.geometry?.curation) {
      return {
        ...curated,
        geometry: profile.geometry
      };
    }

    return curated;
  }

  window.MPAdaptiveArt = {
    ...baseApi,
    version: VERSION,
    createProfile,
    tuneQualityFromRuntime,
    resetIdentity: baseResetIdentity,
    scoreComposition
  };
})();
