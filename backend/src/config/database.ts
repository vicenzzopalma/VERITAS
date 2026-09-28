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
  transactionType: "IMMEDIATE",
  pool: {
    max: 20,
    min: 2,
    acquire: 60000,
    idle: 10000
  },
  retry: {
    max: 5,
    timeout: 3000
  }
};

if (config.dialect !== "sqlite") {
  config.timezone = "-03:00";
}

module.exports = config;

