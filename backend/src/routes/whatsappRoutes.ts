import express from "express";
import isAuth from "../middleware/isAuth";
import isAdmin from "../middleware/isAdmin";
import canAccessAudit from "../middleware/canAccessAudit";

import * as WhatsAppController from "../controllers/WhatsAppController";

const whatsappRoutes = express.Router();

whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);

whatsappRoutes.post("/whatsapp/", isAuth, WhatsAppController.store);

whatsappRoutes.get("/whatsapp/crm-chips", isAuth, WhatsAppController.getCrmChips);
whatsappRoutes.post("/whatsapp/start-all", isAuth, WhatsAppController.startAllSessions);

whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, WhatsAppController.show);

whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, WhatsAppController.update);

whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  WhatsAppController.remove
);

whatsappRoutes.post("/whatsapp/:whatsappId/sync-audit", isAuth, canAccessAudit, WhatsAppController.syncAudit);
whatsappRoutes.post("/whatsapp-sync-all-audit", isAuth, isAdmin, WhatsAppController.syncAllAudit);
whatsappRoutes.post("/whatsapp-check-liveness", isAuth, WhatsAppController.checkLiveness);
whatsappRoutes.get("/whatsapp-check-liveness", isAuth, WhatsAppController.checkLiveness);

export default whatsappRoutes;
