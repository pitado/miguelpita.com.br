const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("home loads motion after the curated shader stack", () => {
  const html = read("index.html");

  const curation = html.indexOf("curation-v12.1.js");
  const art = html.indexOf("art.js?v=10");
  const motion = html.indexOf("motion-v12.2.js");

  assert.ok(curation >= 0);
  assert.ok(art > curation);
  assert.ok(motion > art);
  assert.match(html, /motion-v12\.2\.css/);
  assert.match(html, /class="stage motion-enabled"/);
  assert.doesNotMatch(html, /art-reveal-trace/);
});

test("initial reveal was fully removed", () => {
  const js = read("motion-v12.2.js");
  const css = read("motion-v12.2.css");

  assert.doesNotMatch(js, /revealDuration|revealDelay|revealRaw|motion-revealed/);
  assert.doesNotMatch(css, /reveal-edge|reveal-glow|mask-image|art-reveal-trace/);
});

test("motion layer respects reduced-motion preferences", () => {
  const js = read("motion-v12.2.js");
  const css = read("motion-v12.2.css");

  assert.match(js, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("motion is tied to the procedural DNA and grammar", () => {
  const js = read("motion-v12.2.js");

  assert.match(js, /MPAdaptiveArt\?\.createProfile/);
  assert.match(js, /identity\?\.detailHash/);
  assert.match(js, /geometry\.grammar/);
  assert.match(js, /grammarMotion/);
});

test("continuous motion stays subtle and uses requestAnimationFrame", () => {
  const js = read("motion-v12.2.js");

  assert.match(js, /requestAnimationFrame\(render\)/);
  assert.match(js, /pointermove/);
  assert.match(js, /finePointer/);
  assert.match(js, /breatheAmount/);
  assert.match(js, /idleAmplitudeX/);
  assert.match(js, /idleAmplitudeY/);
});
