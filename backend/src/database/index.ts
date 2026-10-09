import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import QuickAnswer from "../models/QuickAnswer";
import WppKey from "../models/WppKey";
import LidMapping from "../models/LidMapping";
import Sector from "../models/Sector";
import UserSectorPermission from "../models/UserSectorPermission";

// eslint-disable-next-line
const dbConfig = require("../config/database");

const sequelize = new Sequelize(dbConfig);

const models = [
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  QuickAnswer,
  WppKey,
  LidMapping,
  Sector,
  UserSectorPermission
];

sequelize.addModels(models);

if (dbConfig.dialect === "sqlite") {
  sequelize.query("PRAGMA journal_mode = WAL;").catch(() => {});
  sequelize.query("PRAGMA synchronous = NORMAL;").catch(() => {});
  sequelize.query("PRAGMA cache_size = -64000;").catch(() => {});
  sequelize.query("PRAGMA temp_store = MEMORY;").catch(() => {});

  // Resiliência de colunas legadas no SQLite local
  sequelize.query("ALTER TABLE Users ADD COLUMN canAccessConnections BOOLEAN DEFAULT 0;").catch(() => {});
  sequelize.query("ALTER TABLE Users ADD COLUMN connectionSectors TEXT DEFAULT '[]';").catch(() => {});

  // Criação segura e resiliente das tabelas caso não existam
  sequelize.query(`
    CREATE TABLE IF NOT EXISTS Sectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      minimumProfile VARCHAR(255) NOT NULL DEFAULT 'admin_operational',
      active BOOLEAN NOT NULL DEFAULT 1,
      createdAt DATETIME,
      updatedAt DATETIME
    );
  `).then(async () => {
    const defaultSectors = [
      "Junior",
      "Senior",
      "Pesquisa",
      "Comercial",
      "Jurídico",
      "PA FIXA 1",
      "PA FIXA 2"
    ];
    for (const sec of defaultSectors) {
      await sequelize.query(
        "INSERT OR IGNORE INTO Sectors (name, minimumProfile, active, createdAt, updatedAt) VALUES (?, 'admin_operational', 1, datetime('now'), datetime('now'))",
        { replacements: [sec] }
      ).catch(() => {});
    }
  }).catch(() => {});

  sequelize.query(`
    CREATE TABLE IF NOT EXISTS UserSectorPermissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      sector VARCHAR(255) NOT NULL,
      canView BOOLEAN NOT NULL DEFAULT 1,
      canConfigure BOOLEAN NOT NULL DEFAULT 0,
      createdAt DATETIME,
      updatedAt DATETIME,
      UNIQUE(userId, sector)
    );
  `).catch(() => {});
}

export default sequelize;
