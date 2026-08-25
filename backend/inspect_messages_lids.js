const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('D:/whaticket/backend/whaticket.sqlite');

db.all(`
  SELECT m.id, m.body, m.ticketId, m.contactId, m.fromMe, t.whatsappId, c.name, c.number, c.lid 
  FROM Messages m 
  JOIN Tickets t ON m.ticketId = t.id 
  JOIN Contacts c ON t.contactId = c.id 
  WHERE LENGTH(c.number) >= 14
  ORDER BY m.createdAt DESC 
  LIMIT 25
`, (err, rows) => {
  if (err) console.error(err);
  console.log('Messages with 14+ digit numbers:');
  console.table(rows);
  db.close();
});
