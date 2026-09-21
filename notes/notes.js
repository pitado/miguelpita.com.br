(() => {
  "use strict";

  const LOCAL_PREFIX = "mp-note-fallback-v1:";
  const INDEX_KEY = "mp-notes-index-v1";
  const DEFAULT_NOTE = "rascunho";
  const MAX_LENGTH = 100000;

  const routeForm = document.getElementById("noteRouteForm");
  const noteName = document.getElementById("noteName");
  const noteBody = document.getElementById("noteBody");
  const noteHistory = document.getElementById("noteHistory");
  const saveStatus = document.getElementById("saveStatus");
  const saveState = document.getElementById("saveState");
  const characterCount = document.getElementById("characterCount");
  const storageMode = document.getElementById("storageMode");
  const newNote = document.getElementById("newNote");
  const copyAddress = document.getElementById("copyAddress");
  const clearNote = document.getElementById("clearNote");

  if (!routeForm || !noteName || !noteBody) return;

  let saveTimer = 0;
  let mode = "cloud";

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || DEFAULT_NOTE;
  }

  function activeSlug() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return slugify(parts[0] === "notes" ? parts[1] : DEFAULT_NOTE);
  }

  function canonicalPath(slug) {
    return "/notes/" + encodeURIComponent(slug);
  }

  function apiPath(slug) {
    return "/api/notes/" + encodeURIComponent(slug);
  }

  function localKey(slug) {
    return LOCAL_PREFIX + slug;
  }

  function setStatus(text, state = "saved") {
    if (saveStatus) saveStatus.textContent = text;
    if (saveState) saveState.dataset.state = state;
  }

  function setMode(nextMode) {
    mode = nextMode;
    if (storageMode) {
      storageMode.textContent =
        nextMode === "cloud" ? "Cloudflare KV" : "fallback local";
    }
  }

  function updateCount() {
    const size = noteBody.value.length;
    if (characterCount) {
      characterCount.textContent =
        size === 1 ? "1 caractere" : `${size} caracteres`;
    }
  }

  function readIndex() {
    try {
      const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    }
    catch {
      return [];
    }
  }

  function remember(slug) {
    try {
      const now = Date.now();
      const next = [
        { slug, updatedAt: now },
        ...readIndex().filter(item => item?.slug !== slug)
      ].slice(0, 18);

      localStorage.setItem(INDEX_KEY, JSON.stringify(next));
      renderHistory(next);
    }
    catch {
      // histórico local é opcional
    }
  }

  function renderHistory(index = readIndex()) {
    if (!noteHistory) return;
    noteHistory.replaceChildren();

    index.forEach(item => {
      if (!item?.slug) return;
      const option = document.createElement("option");
      option.value = item.slug;
      noteHistory.appendChild(option);
    });
  }

  async function loadCloud(slug) {
    const response = await fetch(apiPath(slug), {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store"
    });

    if (response.status === 404) {
      return { content: "", isNew: true };
    }

    if (!response.ok) {
      const error = new Error("cloud unavailable");
      error.status = response.status;
      throw error;
    }

    const payload = await response.json();
    return {
      content: typeof payload.content === "string" ? payload.content : "",
      isNew: false
    };
  }

  function loadLocal(slug) {
    try {
      return localStorage.getItem(localKey(slug)) || "";
    }
    catch {
      return "";
    }
  }

  async function loadNote() {
    const slug = activeSlug();

    if (window.location.pathname !== canonicalPath(slug)) {
      window.history.replaceState(null, "", canonicalPath(slug));
    }

    noteName.value = slug;
    renderHistory();
    setStatus("carregando", "loading");
    noteBody.disabled = true;

    try {
      const note = await loadCloud(slug);
      noteBody.value = note.content;
      setMode("cloud");
      setStatus(note.isNew ? "nova nota" : "salvo");
    }
    catch {
      noteBody.value = loadLocal(slug);
      setMode("local");
      setStatus("modo local", "local");
    }

    noteBody.disabled = false;
    remember(slug);
    updateCount();
    document.title = `${slug} · Notes · Miguel Pita`;

    window.requestAnimationFrame(() => {
      if (!noteBody.value) noteBody.focus();
    });
  }

  async function saveCloud(slug, content) {
    const response = await fetch(apiPath(slug), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const error = new Error("cloud save failed");
      error.status = response.status;
      throw error;
    }
  }

  function saveLocal(slug, content) {
    try {
      localStorage.setItem(localKey(slug), content);
      return true;
    }
    catch {
      return false;
    }
  }

  async function saveNow() {
    const slug = activeSlug();
    const content = noteBody.value.slice(0, MAX_LENGTH);

    if (content !== noteBody.value) {
      noteBody.value = content;
      updateCount();
    }

    try {
      await saveCloud(slug, content);
      setMode("cloud");
      setStatus("salvo");
      remember(slug);
      return;
    }
    catch {
      if (saveLocal(slug, content)) {
        setMode("local");
        setStatus("salvo local", "local");
        remember(slug);
        return;
      }
    }

    setStatus("erro ao salvar", "error");
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    setStatus("salvando", "saving");
    saveTimer = window.setTimeout(saveNow, 380);
  }

  async function openNamedNote(rawName) {
    window.clearTimeout(saveTimer);
    await saveNow();
    const slug = slugify(rawName);
    window.location.assign(canonicalPath(slug));
  }

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

  routeForm.addEventListener("submit", event => {
    event.preventDefault();
    openNamedNote(noteName.value);
  });

  noteBody.addEventListener("input", () => {
    updateCount();
    scheduleSave();
  });

  noteBody.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      window.clearTimeout(saveTimer);
      saveNow();
    }
  });

  newNote?.addEventListener("click", () => {
    const stamp = new Date()
      .toISOString()
      .slice(0, 16)
      .replace("T", "-")
      .replace(":", "");

    openNamedNote(`nota-${stamp}`);
  });

  copyAddress?.addEventListener("click", async () => {
    const original = copyAddress.textContent;

    try {
      await copyText(window.location.href);
      copyAddress.textContent = "copiado";
    }
    catch {
      copyAddress.textContent = "erro";
    }

    window.setTimeout(() => {
      copyAddress.textContent = original;
    }, 1400);
  });

  clearNote?.addEventListener("click", () => {
    if (!noteBody.value) return;

    const confirmed = window.confirm("Limpar todo o conteúdo desta nota?");
    if (!confirmed) return;

    noteBody.value = "";
    updateCount();
    saveNow();
    noteBody.focus();
  });

  loadNote();
})();
