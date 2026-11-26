// Confere o "build" do pacote no staging, sem tocar no backend vivo.
// O veritas-backend roda de src com ts-node --transpile-only, então o build é a árvore src:
//  1. cada arquivo do staging tem o sha256 esperado do manifesto (e não há arquivo a mais);
//  2. cada arquivo transpila sem erro de sintaxe (typescript do próprio backend, como o ts-node);
//  3. todo import relativo resolve, no staging ou no src vivo (só leitura).
// Uso: node checa_build.js <staging> <backend>
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const [staging, backend] = process.argv.slice(2);
const ts = require(path.join(backend, "node_modules/typescript"));
const manifesto = fs
  .readFileSync(path.join(staging, "manifesto.tsv"), "utf8")
  .trim()
  .split("\n")
  .map(l => l.split("\t"));
let falhas = 0;
const falha = m => {
  falhas += 1;
  console.log("FALHA", m);
};

const listar = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listar(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
const base = path.join(staging, "backend");
const presentes = listar(base).map(f => path.relative(base, f).split(path.sep).join("/")).sort();
const esperados = manifesto.map(m => m[0]).sort();
if (JSON.stringify(presentes) !== JSON.stringify(esperados)) {
  falha(`arquivos do staging diferem do manifesto: ${JSON.stringify(presentes)}`);
}

const existe = rel =>
  [".ts", ".js", "/index.ts", "/index.js", ""].some(
    ext => fs.existsSync(path.join(base, rel + ext)) || fs.existsSync(path.join(backend, rel + ext))
  );

manifesto.forEach(([rel, novo]) => {
  const arq = path.join(base, rel);
  if (!fs.existsSync(arq)) return falha(`ausente ${rel}`);
  const fonte = fs.readFileSync(arq);
  const sha = crypto.createHash("sha256").update(fonte).digest("hex");
  if (sha !== novo) falha(`sha diferente ${rel}`);
  if (fonte.includes("\r\n")) falha(`CRLF em ${rel}`);
  const out = ts.transpileModule(fonte.toString("utf8"), {
    fileName: rel,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
  });
  (out.diagnostics || []).forEach(d =>
    falha(`transpilação ${rel}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`)
  );
  const re = /(?:from\s+|require\()\s*["'](\.[^"']+)["']/g;
  let m;
  const texto = fonte.toString("utf8");
  while ((m = re.exec(texto))) {
    const alvo = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
    if (!existe(alvo)) falha(`import não resolve em ${rel}: ${m[1]}`);
  }
  console.log("ok", rel);
});

console.log(falhas ? `BUILD COM ${falhas} FALHA(S)` : `BUILD OK: ${manifesto.length} arquivos`);
process.exit(falhas ? 1 : 0);
