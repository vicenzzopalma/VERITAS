import { Router } from "express";
import isAuth from "../middleware/isAuth";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

whatsappSessionRoutes.post(
  "/whatsappsession/start-all",
  isAuth,
  WhatsAppSessionController.startAll
);

whatsappSessionRoutes.post(
  "/whatsappsession-start-all",
  isAuth,
  WhatsAppSessionController.startAll
);

whatsappSessionRoutes.get(
  "/whatsappsession/:whatsappId/pairing-code",
  isAuth,
  WhatsAppSessionController.showPairingCode
);

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId/pairing-code",
  isAuth,
  WhatsAppSessionController.requestPairingCode
);

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  WhatsAppSessionController.remove
);

export default whatsappSessionRoutes;
