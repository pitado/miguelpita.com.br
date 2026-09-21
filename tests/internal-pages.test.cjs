const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("API page documents the production Receitando API", () => {
  const html = read("api/index.html");

  assert.match(html, /https:\/\/api\.receitando\.miguelpita\.com\.br/);
  assert.match(html, /\/api\/health/);
  assert.match(html, /\/api\/ingredients/);
  assert.match(html, /\/api\/recipes/);
  assert.match(html, /\/api\/recipes\/slug\/:slug/);
  assert.match(html, /\/api\/recipes\/match/);
  assert.match(html, /\/api\/auth\/register/);
  assert.match(html, /\/api\/auth\/login/);
  assert.match(html, /\/api\/auth\/me/);
  assert.match(html, /\/api\/auth\/logout/);
});

test("API page links to production app and source", () => {
  const html = read("api/index.html");

  assert.match(html, /https:\/\/receitando\.miguelpita\.com\.br/);
  assert.match(html, /https:\/\/github\.com\/pitado\/receitando/);
});

test("contact page exposes the canonical contact channels", () => {
  const html = read("contact/index.html");

  assert.match(html, /mailto:contato@miguelpita\.com\.br/);
  assert.match(html, /https:\/\/github\.com\/pitado/);
});

test("notes page exposes a DontPad-style editor", () => {
  const html = read("notes/index.html");
  const js = read("notes/notes.js");

  assert.match(html, /id="noteName"/);
  assert.match(html, /id="noteBody"/);
  assert.match(html, /copiar endereço/);
  assert.match(html, /quem tiver o endereço da nota poderá ler e editar/i);
  assert.match(js, /\/api\/notes\//);
  assert.match(js, /\/notes\//);
  assert.match(js, /syncCurrentNote/);
});

test("internal pages reuse the procedural DNA theme", () => {
  for (const file of ["api/index.html", "contact/index.html", "notes/index.html"]) {
    const html = read(file);

    assert.match(html, /adaptive-profile\.js/);
    assert.match(html, /topology-v11\.js/);
    assert.match(html, /presence-v11\.1\.js/);
    assert.match(html, /grammar-v12\.js/);
    assert.match(html, /internal-theme\.js/);
  }
});

test("notes persistence is configured as a Cloudflare Durable Object", () => {
  const worker = read("worker.js");
  const wrangler = read("wrangler.jsonc");
  const ignoredAssets = read(".assetsignore");

  assert.match(worker, /export class NotesStore/);
  assert.match(worker, /state\.storage\.put/);
  assert.match(worker, /idFromName\(slug\)/);
  assert.match(worker, /env\.ASSETS\.fetch/);

  assert.match(wrangler, /"main": "worker\.js"/);
  assert.match(wrangler, /"binding": "ASSETS"/);
  assert.match(wrangler, /"name": "NOTES"/);
  assert.match(wrangler, /"class_name": "NotesStore"/);
  assert.match(wrangler, /"new_sqlite_classes"/);

  assert.match(ignoredAssets, /^worker\.js$/m);
});
