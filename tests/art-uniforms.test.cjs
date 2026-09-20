/*
  Encanamento das uniforms do shader.

  Este arquivo existe por causa de um bug real que foi para produção.

  O campo estendido (u_fieldReach / u_fieldFill / u_fieldFloor) foi
  implementado, revisado, testado por 56 testes verdes, empacotado
  num PR com medições, mergeado e publicado — e nunca funcionou. As
  três uniforms estavam declaradas no fragment shader, usadas na
  máscara e enviadas por gl.uniform1f, mas nenhuma delas entrou na
  lista `uniformNames`, que é de onde saem os gl.getUniformLocation.

  Resultado: uniforms.u_fieldFloor era undefined,
  gl.uniform1f(undefined, valor) não lança nem avisa, o shader leu
  zero, e o recurso inteiro virou código morto invisível. Nenhum
  teste de geometria pegava isso, porque do lado do JS o DNA estava
  perfeitamente correto.

  A causa raiz foi ainda mais boba: a edição que deveria inserir os
  nomes na lista procurou por uma linha com 6 espaços de indentação
  e a lista usa 4. O replace não casou, não deu erro, e seguiu.

  Este teste lê o código-fonte do shader, extrai toda uniform
  declarada e exige que cada uma seja realmente buscada e enviada.
*/

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.join(__dirname, "..", "art.js"),
  "utf8"
);

function declaredUniforms() {
  const scalars = [];
  const arrays = [];
  const pattern = /uniform\s+(?:float|vec2|vec3|vec4|int|bool)\s+(u_[A-Za-z0-9_]+)\s*(\[\s*\$\{[^}]+\}\s*\]|\[\s*\d+\s*\])?\s*;/g;

  let match;
  while ((match = pattern.exec(source)) !== null) {
    (match[2] ? arrays : scalars).push(match[1]);
  }

  return { scalars, arrays };
}

test("the shader declares at least the uniforms we expect", () => {
  const { scalars, arrays } = declaredUniforms();

  assert.ok(scalars.length >= 30, `uniforms escalares encontradas: ${scalars.length}`);
  assert.deepEqual(
    arrays.sort(),
    ["u_cavityData", "u_cavityMeta", "u_massData", "u_massMeta"]
  );
});

test("every scalar uniform is looked up through uniformNames", () => {
  const { scalars } = declaredUniforms();

  const block = source.slice(
    source.indexOf("const uniformNames = ["),
    source.indexOf("];", source.indexOf("const uniformNames = ["))
  );

  assert.ok(block.length > 0, "lista uniformNames não encontrada");

  const listed = new Set(
    [...block.matchAll(/"(u_[A-Za-z0-9_]+)"/g)].map(m => m[1])
  );

  const missing = scalars.filter(name => !listed.has(name));

  assert.deepEqual(
    missing,
    [],
    `uniform declarada no shader mas ausente de uniformNames, ` +
      `o que faz gl.uniform1f receber undefined e falhar em ` +
      `silêncio: ${missing.join(", ")}`
  );
});

test("every array uniform is looked up by its [0] location", () => {
  const { arrays } = declaredUniforms();

  for (const name of arrays) {
    assert.ok(
      source.includes(`"${name}[0]"`),
      `${name} precisa de getUniformLocation em "${name}[0]"`
    );
  }
});

test("every declared uniform is actually sent to the GPU", () => {
  const { scalars, arrays } = declaredUniforms();
  const neverSent = [];

  for (const name of [...scalars, ...arrays]) {
    // gl.uniform1f(uniforms.u_x, ...) ou gl.uniform3fv(uniforms.u_x, ...)
    const sent = new RegExp(
      `uniforms\\.${name}\\b`
    ).test(source);

    if (!sent) neverSent.push(name);
  }

  assert.deepEqual(
    neverSent,
    [],
    `uniform declarada e nunca enviada: ${neverSent.join(", ")}`
  );
});

test("the extended field uniforms are wired end to end", () => {
  // O caso específico que quebrou. Vale um teste com nome próprio.
  for (const name of ["u_fieldReach", "u_fieldFill", "u_fieldFloor"]) {
    assert.match(source, new RegExp(`uniform float ${name};`), `${name} não declarada`);
    assert.match(source, new RegExp(`"${name}"`), `${name} fora de uniformNames`);
    assert.match(source, new RegExp(`uniforms\\.${name}`), `${name} nunca enviada`);
  }

  // E o DNA precisa fornecer os três valores.
  const dna = fs.readFileSync(
    path.join(__dirname, "..", "adaptive-profile.js"),
    "utf8"
  );

  for (const key of ["fieldReach", "fieldFill", "fieldFloor"]) {
    assert.match(dna, new RegExp(`${key}:`), `DNA não define ${key}`);
  }
});
