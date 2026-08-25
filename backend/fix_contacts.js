const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('D:/whaticket/backend/whaticket.sqlite');

db.serialize(() => {
  // Update contact 15 name if still raw LID
  db.run("UPDATE Contacts SET name = 'Adilson' WHERE id = 15 AND name = '226083018379466'", function(err) {
    if (err) console.error(err);
    console.log('Updated contact 15 name to Adilson, affected rows:', this ? this.changes : 0);
  });

  // Update contact 12 if still raw LID (Yasmin)
  db.run("UPDATE Contacts SET name = 'Yasmin' WHERE id = 12 AND name = '93201411084536'", function(err) {
    if (err) console.error(err);
    console.log('Updated contact 12 name to Yasmin, affected rows:', this ? this.changes : 0);
  });

  // Check all contacts
  db.all('SELECT id, name, number, lid, isGroup FROM Contacts ORDER BY id DESC', (err, rows) => {
    if (err) console.error(err);
    console.log('Contacts in database:');
    console.table(rows);
    db.close();
  });
});
