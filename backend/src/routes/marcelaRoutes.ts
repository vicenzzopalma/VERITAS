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

export default marcelaRoutes;
