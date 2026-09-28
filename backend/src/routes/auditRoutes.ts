import express from "express";
import isAuth from "../middleware/isAuth";
import canAccessAudit from "../middleware/canAccessAudit";
import * as AuditController from "../controllers/AuditController";

const auditRoutes = express.Router();

auditRoutes.get("/audit/search-all", isAuth, canAccessAudit, AuditController.searchGlobal);
auditRoutes.get("/audit/search-global", isAuth, canAccessAudit, AuditController.searchGlobal);
auditRoutes.get("/audit/search", isAuth, canAccessAudit, AuditController.searchGlobal);
auditRoutes.get("/audit/devices", isAuth, canAccessAudit, AuditController.indexDevices);
auditRoutes.get("/audit/devices/:whatsappId/chats", isAuth, canAccessAudit, AuditController.listChats);
auditRoutes.get("/audit/messages", isAuth, canAccessAudit, AuditController.listMessages);
auditRoutes.get("/audit/export", isAuth, canAccessAudit, AuditController.exportAudit);

export default auditRoutes;
