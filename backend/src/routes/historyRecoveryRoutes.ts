import express from "express";

import * as HistoryRecoveryController from "../controllers/HistoryRecoveryController";

// Rota interna de recuperação de histórico. Desligada (503) sem HISTORY_RECOVERY_TOKEN.
const historyRecoveryRoutes = express.Router();

historyRecoveryRoutes.post(
  "/internal/history-recovery/start",
  HistoryRecoveryController.autorizar,
  HistoryRecoveryController.start
);
historyRecoveryRoutes.get(
  "/internal/history-recovery/status",
  HistoryRecoveryController.autorizar,
  HistoryRecoveryController.status
);
historyRecoveryRoutes.post(
  "/internal/history-recovery/cancel",
  HistoryRecoveryController.autorizar,
  HistoryRecoveryController.cancel
);
historyRecoveryRoutes.post(
  "/internal/history-recovery/probe",
  HistoryRecoveryController.autorizar,
  HistoryRecoveryController.probe
);

export default historyRecoveryRoutes;
