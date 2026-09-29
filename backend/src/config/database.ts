require("../bootstrap");
const path = require("path");

const isSqlite = (process.env.DB_DIALECT || "sqlite") === "sqlite";

const config = {
  define: {
    charset: "utf8mb4",
    collate: "utf8mb4_bin"
  },
  dialect: process.env.DB_DIALECT || "sqlite",
  storage: process.env.DB_STORAGE || path.resolve(__dirname, "../../whaticket.sqlite"),
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false,
  transactionType: "IMMEDIATE",
  dialectOptions: isSqlite
    ? {
        busyTimeout: 5000
      }
    : {},
  pool: isSqlite
    ? {
        max: 1,
        min: 1,
        acquire: 20000,
        idle: 10000
      }
    : {
        max: 20,
        min: 2,
        acquire: 30000,
        idle: 10000
      },
  retry: {
    max: 3,
    match: [
      /SQLITE_BUSY/,
      /database is locked/
    ]
  },
  hooks: {
    afterConnect: (connection, config) => {
      try {
        if (typeof connection.configure === "function") {
          connection.configure("busyTimeout", 5000);
        }
        if (typeof connection.run === "function") {
          connection.run("PRAGMA busy_timeout = 5000;");
          connection.run("PRAGMA journal_mode = WAL;");
          connection.run("PRAGMA synchronous = NORMAL;");
          connection.run("PRAGMA temp_store = MEMORY;");
        }
      } catch (e) {}
    }
  }
};

if (!isSqlite) {
  config.timezone = "-03:00";
}

module.exports = config;
