const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");

const db = new sqlite3.Database("D:/whaticket/backend/whaticket.sqlite");
const hash = bcrypt.hashSync("Ope@2025", 8);
const now = new Date().toISOString();

const users = [
    { name: "Yasmin", email: "yasmin", profile: "admin" },
    { name: "Yasmin", email: "yasmin@whaticket.com", profile: "admin" }
];

db.serialize(() => {
    users.forEach(u => {
        db.run(
            "INSERT INTO Users (name, email, passwordHash, profile, tokenVersion, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)",
            [u.name, u.email, hash, u.profile, now, now],
            function(err) {
                if (err) {
                    db.run(
                        "UPDATE Users SET passwordHash = ?, profile = 'admin', updatedAt = ? WHERE email = ?",
                        [hash, now, u.email],
                        (updateErr) => {
                            if (updateErr) console.error("Erro update:", updateErr);
                            else console.log("Usuario atualizado com sucesso:", u.email);
                        }
                    );
                } else {
                    console.log("Usuario criado com sucesso:", u.email);
                }
            }
        );
    });
});

db.close();
