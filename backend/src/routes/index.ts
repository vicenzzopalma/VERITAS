import { Router } from "express";

import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import ticketRoutes from "./ticketRoutes";
import whatsappRoutes from "./whatsappRoutes";
import messageRoutes from "./messageRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";
import queueRoutes from "./queueRoutes";
import quickAnswerRoutes from "./quickAnswerRoutes";
import apiRoutes from "./apiRoutes";
import marcelaRoutes from "./marcelaRoutes";
import retornoIaRoutes from "./retornoIaRoutes";
import auditRoutes from "./auditRoutes";
import dashboardRoutes from "./dashboardRoutes";
import sectorRoutes from "./sectorRoutes";

const routes = Router();

routes.use(auditRoutes);
routes.use(dashboardRoutes);
routes.use(userRoutes);
routes.use(sectorRoutes);
routes.use("/auth", authRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(quickAnswerRoutes);
routes.use("/api/messages", apiRoutes);
routes.use(marcelaRoutes);
routes.use(retornoIaRoutes);

export default routes;