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

test("internal pages reuse the procedural DNA theme", () => {
  for (const file of ["api/index.html", "contact/index.html"]) {
    const html = read(file);

    assert.match(html, /adaptive-profile\.js/);
    assert.match(html, /topology-v11\.js/);
    assert.match(html, /presence-v11\.1\.js/);
    assert.match(html, /grammar-v12\.js/);
    assert.match(html, /internal-theme\.js/);
  }
});
