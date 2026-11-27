// Retrato só leitura do status de cada conexão (Whatsapps): "id<TAB>status" por linha.
// Abre o SQLite em OPEN_READONLY; não grava nada. Uso: node retrato.js <backend>
const path = require("path");

const backend = process.argv[2];
const sqlite3 = require(path.join(backend, "node_modules/sqlite3"));
const db = new sqlite3.Database(path.join(backend, "whaticket.sqlite"), sqlite3.OPEN_READONLY);
db.configure("busyTimeout", 5000);
db.all("SELECT id, status FROM Whatsapps ORDER BY id", (err, linhas) => {
  if (err) {
    console.error("ERRO", err.message);
    process.exitCode = 1;
  } else {
    linhas.forEach(l => console.log(`${l.id}\t${l.status}`));
  }
  db.close();
});
