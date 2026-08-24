(() => {
  "use strict";

  const root = document.documentElement;

  function toCss(rgb, fallback) {
    if (!Array.isArray(rgb) || rgb.length < 3) return fallback;
    const values = rgb.slice(0, 3).map(value =>
      Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 255)
    );
    return `rgb(${values[0]} ${values[1]} ${values[2]})`;
  }

  try {
    if (!window.MPAdaptiveArt?.createProfile) {
      root.dataset.themeReady = "true";
      return;
    }

    const profile = window.MPAdaptiveArt.createProfile();
    const geometry = profile?.geometry || {};

    root.style.setProperty(
      "--page-bg",
      toCss(geometry.backgroundColor, "#f6f3ee")
    );
    root.style.setProperty(
      "--page-line",
      toCss(geometry.lineColor, "#74867b")
    );
    root.style.setProperty(
      "--page-accent",
      toCss(geometry.accentColor, "#21362c")
    );

    root.dataset.themeReady = "true";

    const grammarNode = document.querySelector("[data-grammar]");
    if (grammarNode && geometry.grammar) {
      grammarNode.textContent = geometry.grammar;
    }
  }
  catch (error) {
    console.warn("Tema procedural interno indisponível:", error);
    root.dataset.themeReady = "true";
  }
})();
