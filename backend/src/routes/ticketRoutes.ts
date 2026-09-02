import express from "express";
import isAuth from "../middleware/isAuth";

import * as TicketController from "../controllers/TicketController";
import * as AuditController from "../controllers/AuditController";

const ticketRoutes = express.Router();

ticketRoutes.get("/tickets", isAuth, TicketController.index);

// Rota de busca global da Auditoria (DEVE vir antes de /tickets/:ticketId)
ticketRoutes.get("/tickets/search-all", isAuth, AuditController.searchGlobal);
ticketRoutes.get("/tickets/search-global", isAuth, AuditController.searchGlobal);

ticketRoutes.get("/tickets/:ticketId", isAuth, TicketController.show);

ticketRoutes.post("/tickets", isAuth, TicketController.store);
ticketRoutes.put("/tickets/:ticketId", isAuth, TicketController.update);
ticketRoutes.delete("/tickets/:ticketId", isAuth, TicketController.remove);

export default ticketRoutes;
