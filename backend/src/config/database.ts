require("../bootstrap");
const path = require("path");

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
  dialectOptions: {
    busyTimeout: 60000
  },
  pool: {
    max: 10,
    min: 1,
    acquire: 60000,
    idle: 10000
  },
  retry: {
    max: 10,
    match: [
      /SQLITE_BUSY/,
      /database is locked/
    ]
  },
  hooks: {
    afterConnect: (connection, config) => {
      try {
        if (typeof connection.configure === "function") {
          connection.configure("busyTimeout", 60000);
        }
        if (typeof connection.run === "function") {
          connection.run("PRAGMA busy_timeout = 60000;");
          connection.run("PRAGMA journal_mode = WAL;");
          connection.run("PRAGMA synchronous = NORMAL;");
          connection.run("PRAGMA cache_size = -131072;");
          connection.run("PRAGMA temp_store = MEMORY;");
        }
      } catch (e) {}
    }
  }
};


if (config.dialect !== "sqlite") {
  config.timezone = "-03:00";
}

module.exports = config;

