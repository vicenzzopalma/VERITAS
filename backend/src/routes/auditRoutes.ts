import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import * as AuditController from "../controllers/AuditController";

const auditRoutes = express.Router();

auditRoutes.get("/audit/search-all", isAuth, isAdmin, AuditController.searchGlobal);
auditRoutes.get("/audit/search-global", isAuth, isAdmin, AuditController.searchGlobal);
auditRoutes.get("/audit/search", isAuth, isAdmin, AuditController.searchGlobal);
auditRoutes.get("/audit/devices", isAuth, isAdmin, AuditController.indexDevices);
auditRoutes.get("/audit/devices/:whatsappId/chats", isAuth, isAdmin, AuditController.listChats);
auditRoutes.get("/audit/messages", isAuth, isAdmin, AuditController.listMessages);
auditRoutes.get("/audit/export", isAuth, isAdmin, AuditController.exportAudit);

export default auditRoutes;
