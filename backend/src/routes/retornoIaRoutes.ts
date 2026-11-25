import express from "express";

import * as RetornoIaController from "../controllers/RetornoIaController";

// Rota interna do retorno_ia (PA FIXA). Fica desligada (503) sem RETORNO_IA_INTERNAL_TOKEN.
const retornoIaRoutes = express.Router();

retornoIaRoutes.post(
  "/internal/retorno-ia/send",
  RetornoIaController.autorizar,
  RetornoIaController.send
);

export default retornoIaRoutes;
