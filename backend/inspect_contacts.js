const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('D:/whaticket/backend/whaticket.sqlite');

db.all('SELECT id, name, number, lid, isGroup FROM Contacts ORDER BY id ASC', (err, rows) => {
  if (err) console.error(err);
  console.log('ALL Contacts:');
  console.table(rows);
  db.close();
});
