const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('D:/whaticket/backend/whaticket.sqlite');

const extractBaseLid = (val) => {
  if (!val) return '';
  return val.split('@')[0].split(':')[0].replace(/\D/g, '');
};

const isRealPhoneNumber = (num) => {
  if (!num) return false;
  const clean = num.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 13;
};

db.serialize(async () => {
  db.all('SELECT id, name, number, lid, isGroup FROM Contacts ORDER BY id ASC', (err, contacts) => {
    if (err) {
      console.error(err);
      return;
    }

    const lidMap = new Map();

    contacts.forEach(c => {
      const baseFromLid = extractBaseLid(c.lid);
      const baseFromNum = (!isRealPhoneNumber(c.number) && c.number && c.number.length >= 14) ? c.number : '';
      const base = baseFromLid || baseFromNum;

      if (base) {
        if (!lidMap.has(base)) {
          lidMap.set(base, []);
        }
        lidMap.get(base).push(c);
      }
    });

    console.log('LID Groups found:', lidMap.size);

    lidMap.forEach((group, base) => {
      if (group.length > 1) {
        console.log(`\nMerging duplicate contacts for Base LID ${base}:`, group.map(g => `ID ${g.id} (${g.name} - ${g.number})`));

        // Find primary (prefer real phone number, then best name)
        let primary = group.find(g => isRealPhoneNumber(g.number));
        if (!primary) primary = group[0];

        const duplicates = group.filter(g => g.id !== primary.id);

        duplicates.forEach(dup => {
          console.log(`- Moving tickets from Contact ${dup.id} to ${primary.id}...`);
          db.run('UPDATE Tickets SET contactId = ? WHERE contactId = ?', [primary.id, dup.id]);
          db.run('UPDATE Messages SET contactId = ? WHERE contactId = ?', [primary.id, dup.id]);
          console.log(`- Deleting duplicate Contact ${dup.id}...`);
          db.run('DELETE FROM Contacts WHERE id = ?', [dup.id]);
        });

        // Ensure primary has best name and lid
        const bestName = group.map(g => g.name).find(n => n && !/^\d{10,}$/.test(n)) || primary.name;
        const bestLid = group.map(g => g.lid).find(l => l && l.includes('@lid')) || `${base}@lid`;

        db.run('UPDATE Contacts SET name = ?, lid = ? WHERE id = ?', [bestName, bestLid, primary.id]);
      }
    });

    // Clean up single contacts that have LID as number if we can find name in messages
    db.all('SELECT * FROM Contacts ORDER BY id ASC', (err2, finalContacts) => {
      console.log('\n--- Final Contacts Table ---');
      console.table(finalContacts);
      db.close();
    });
  });
});
