(() => {
  "use strict";

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  document.querySelectorAll("[data-copy]").forEach(button => {
    button.addEventListener("click", async () => {
      const target = document.querySelector(button.dataset.copy);
      if (!target) return;

      const original = button.textContent;

      try {
        await copyText(target.textContent.trim());
        button.textContent = "copiado";
      }
      catch {
        button.textContent = "erro";
      }

      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    });
  });
})();
