const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../../whaticket.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("1. Criando índices de alta performance...");
  db.run("CREATE INDEX IF NOT EXISTS idx_contacts_number ON Contacts(number);");
  db.run("CREATE INDEX IF NOT EXISTS idx_contacts_lid ON Contacts(lid);");
  db.run("CREATE INDEX IF NOT EXISTS idx_tickets_contactId ON Tickets(contactId);");
  db.run("CREATE INDEX IF NOT EXISTS idx_messages_contactId ON Messages(contactId);");

  console.log("2. Executando unificação direta com LidMappings...");

  // Busca todos os mapeamentos
  db.all("SELECT lid, phoneNumber FROM LidMappings", (err, mappings) => {
    if (err) {
      console.error("Erro ao ler mappings:", err);
      return;
    }

    console.log(`Carregados ${mappings.length} mapeamentos da tabela LidMappings.`);
    db.run("BEGIN TRANSACTION;");

    let mergedCount = 0;
    let updatedCount = 0;
    let pending = mappings.length;

    if (pending === 0) {
      db.run("COMMIT;");
      console.log("Nenhum mapeamento.");
      return;
    }

    mappings.forEach(({ lid, phoneNumber }) => {
      // 1. Acha se existe contato com o número real
      db.get("SELECT id FROM Contacts WHERE number = ? AND isGroup = 0", [phoneNumber], (err, realContact) => {
        // 2. Acha se existe contato com o LID gravado no number
        db.get("SELECT id FROM Contacts WHERE number = ? AND isGroup = 0", [lid], (err, lidContact) => {
          if (lidContact && realContact && lidContact.id !== realContact.id) {
            // Merge
            db.run("UPDATE Tickets SET contactId = ? WHERE contactId = ?", [realContact.id, lidContact.id]);
            db.run("UPDATE Messages SET contactId = ? WHERE contactId = ?", [realContact.id, lidContact.id]);
            db.run("UPDATE Contacts SET lid = ? WHERE id = ? AND (lid IS NULL OR lid = '')", [lid + "@lid", realContact.id]);
            db.run("DELETE FROM Contacts WHERE id = ?", [lidContact.id]);
            mergedCount++;
          } else if (lidContact && !realContact) {
            // Update
            db.run("UPDATE Contacts SET number = ?, lid = ? WHERE id = ?", [phoneNumber, lid + "@lid", lidContact.id]);
            updatedCount++;
          }

          pending--;
          if (pending === 0) {
            db.run("COMMIT;", (err) => {
              console.log(`Unificação concluída com sucesso! Merge: ${mergedCount}, Atualizados: ${updatedCount}`);
              
              // Verifica quantos tickets ainda apontam para contato com 14+ dígitos
              db.get(`
                SELECT COUNT(t.id) as remaining
                FROM Tickets t
                JOIN Contacts c ON t.contactId = c.id
                WHERE LENGTH(c.number) >= 14 AND c.isGroup = 0
              `, (err, row) => {
                console.log(`Tickets ativos restantes com LID no contato: ${row ? row.remaining : err}`);
                process.exit(0);
              });
            });
          }
        });
      });
    });
  });
});
