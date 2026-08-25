import express from "express";
import isAuth from "../middleware/isAuth";
import * as AuditController from "../controllers/AuditController";

const auditRoutes = express.Router();

auditRoutes.get("/audit/devices", isAuth, AuditController.indexDevices);
auditRoutes.get("/audit/devices/:whatsappId/chats", isAuth, AuditController.listChats);
auditRoutes.get("/audit/messages", isAuth, AuditController.listMessages);
auditRoutes.get("/audit/export", isAuth, AuditController.exportAudit);

export default auditRoutes;
