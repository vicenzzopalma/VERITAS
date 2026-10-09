import path from "path";
import fs from "fs";
import { Database } from "sqlite3";
import {
  isWhatsappControlProfile,
  normalizeConnectionSectors,
  isMasterAdmin,
  isAnyAdmin,
  SectorPermissionItem
} from "../WhatsappService/WhatsappAccessPolicy";

interface CrmSyncUserData {
  email: string;
  name: string;
  profile: string;
  connectionSectors?: unknown;
  sectorPermissions?: SectorPermissionItem[];
}

export const syncUserToCrm = async (userData: CrmSyncUserData): Promise<void> => {
  const isMaster = isMasterAdmin(userData as any);
  const isAdmin = isAnyAdmin(userData as any);
  const isManager = isWhatsappControlProfile(userData.profile);

  const possiblePaths = [
    path.resolve(__dirname, "..", "..", "..", "..", "Gestão de celulares", "database.sqlite"),
    path.resolve(__dirname, "..", "..", "..", "Gestão de celulares", "database.sqlite"),
    "/var/www/VERITAS/Gestão de celulares/database.sqlite",
    "d:/VERITAS/Gestão de celulares/database.sqlite"
  ];

  let crmDbPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      crmDbPath = p;
      break;
    }
  }

  if (!crmDbPath) {
    console.warn("[CRM SYNC] database.sqlite do CRM não encontrado.");
    return;
  }

  const email = (userData.email || "").toLowerCase().trim();
  const rawName = (userData.name || "").trim();
  const emailPrefix = email.includes("@") ? email.split("@")[0].trim() : email;
  const sectors = normalizeConnectionSectors(userData.connectionSectors);
  const sectorPermissions = userData.sectorPermissions;

  return new Promise(resolve => {
    const db = new Database(crmDbPath);

    db.serialize(() => {
      db.get(
        "SELECT id, allow_all_tabs, allow_edit_devices FROM users WHERE LOWER(username) = ? OR LOWER(name) = ? LIMIT 1",
        [emailPrefix.toLowerCase(), rawName.toLowerCase()],
        (err: any, existingUser: any) => {
          if (err) {
            console.error("[CRM SYNC] Erro ao buscar usuário no CRM:", err);
            db.close();
            return resolve();
          }

          const allowAllTabs = isMaster ? 1 : (isAdmin ? 1 : 0);
          const allowEdit = 1;
          const allowManage = isMaster ? 1 : (isAdmin ? 1 : 0);
          const isReadonly = 0;

          if (existingUser) {
            const userId = existingUser.id;
            db.run(
              "UPDATE users SET allow_all_tabs = ?, allow_edit_devices = ?, allow_manage_users = ?, is_readonly = ?, atualizado_em = datetime('now') WHERE id = ?",
              [allowAllTabs, allowEdit, allowManage, isReadonly, userId],
              (updateErr: any) => {
                if (updateErr) console.error("[CRM SYNC] Erro ao atualizar usuário no CRM:", updateErr);

                if (Array.isArray(sectorPermissions) && sectorPermissions.length > 0) {
                  db.run("DELETE FROM user_sector_permissions WHERE user_id = ?", [userId], () => {
                    const stmt = db.prepare(
                      "INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, ?, ?, ?)"
                    );
                    for (const sp of sectorPermissions) {
                      stmt.run([userId, sp.sector, sp.canView ? 1 : 0, sp.canConfigure ? 1 : 0]);
                    }
                    stmt.finalize(() => {
                      db.close();
                      resolve();
                    });
                  });
                } else if (isManager) {
                  db.run("DELETE FROM user_sector_permissions WHERE user_id = ?", [userId], () => {
                    const stmt = db.prepare(
                      "INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, ?, 1, 1)"
                    );
                    for (const sector of sectors) {
                      stmt.run([userId, sector]);
                    }
                    stmt.finalize(() => {
                      db.close();
                      resolve();
                    });
                  });
                } else {
                  db.close();
                  resolve();
                }
              }
            );
          } else {
            const bcrypt = require("bcryptjs");
            const newUsername = (emailPrefix || rawName.toLowerCase().replace(/\s+/g, ".")).slice(0, 30);
            bcrypt.hash(Math.random().toString(36), 10, (hashErr: any, hash: string) => {
              if (hashErr || !hash) hash = "$2a$10$defaultHashPlaceholder";
              db.run(
                `INSERT INTO users (username, password_hash, name, is_readonly, allow_all_tabs, allow_edit_devices, allow_manage_users, allow_dashboard, is_active, criado_em)
                 VALUES (?, ?, ?, 0, ?, 1, ?, 1, 1, datetime('now'))`,
                [newUsername, hash, rawName, allowAllTabs, allowManage],
                function (this: any, insertErr: any) {
                  if (insertErr) {
                    console.error("[CRM SYNC] Erro ao inserir usuário no CRM:", insertErr);
                    db.close();
                    return resolve();
                  }

                  const newUserId = this.lastID;
                  if (Array.isArray(sectorPermissions) && sectorPermissions.length > 0 && newUserId) {
                    const stmt = db.prepare(
                      "INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, ?, ?, ?)"
                    );
                    for (const sp of sectorPermissions) {
                      stmt.run([newUserId, sp.sector, sp.canView ? 1 : 0, sp.canConfigure ? 1 : 0]);
                    }
                    stmt.finalize(() => {
                      db.close();
                      resolve();
                    });
                  } else if (isManager && newUserId) {
                    const stmt = db.prepare(
                      "INSERT OR IGNORE INTO user_sector_permissions (user_id, sector, can_view, can_configure) VALUES (?, ?, 1, 1)"
                    );
                    for (const sector of sectors) {
                      stmt.run([newUserId, sector]);
                    }
                    stmt.finalize(() => {
                      db.close();
                      resolve();
                    });
                  } else {
                    db.close();
                    resolve();
                  }
                }
              );
            });
          }
        }
      );
    });
  });
};