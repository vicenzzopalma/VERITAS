import express from "express";

import * as MarcelaController from "../controllers/MarcelaController";
import isMarcelaInternal from "../middleware/isMarcelaInternal";

// Rota interna do robô da Marcela. Fica desligada (503) sem MARCELA_INTERNAL_TOKEN.
const marcelaRoutes = express.Router();

marcelaRoutes.post(
  "/internal/marcela/send",
  isMarcelaInternal,
  MarcelaController.send
);

// Item #21 (24/11): retrato inteiro das conversas arquivadas (snapshot regular_low) de uma conexão.
marcelaRoutes.post(
  "/internal/marcela/resync-arquivadas",
  isMarcelaInternal,
  MarcelaController.resyncArquivadas
);

export default marcelaRoutes;
