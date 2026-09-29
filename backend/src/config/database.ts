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
  logging: false
};

if (config.dialect !== "sqlite") {
  config.timezone = "-03:00";
}

module.exports = config;
