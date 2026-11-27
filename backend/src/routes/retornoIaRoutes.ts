import express from "express";

import * as RetornoIaController from "../controllers/RetornoIaController";

// Rota interna do retorno_ia (PA FIXA). Fica desligada (503) sem RETORNO_IA_INTERNAL_TOKEN.
const retornoIaRoutes = express.Router();

retornoIaRoutes.post(
  "/internal/retorno-ia/send",
  RetornoIaController.autorizar,
  RetornoIaController.send
);

// Fase 0a do negociador: fonte de arquivadas por conexão (só leitura), mesmo token e IPs.
retornoIaRoutes.get(
  "/internal/retorno-ia/arquivadas",
  RetornoIaController.autorizar,
  RetornoIaController.arquivadas
);

// Fase 0a do negociador (FMEA): LID → telefone e estado da sessão, só leitura.
retornoIaRoutes.get(
  "/internal/retorno-ia/lids",
  RetornoIaController.autorizar,
  RetornoIaController.lids
);

retornoIaRoutes.get(
  "/internal/retorno-ia/sessoes",
  RetornoIaController.autorizar,
  RetornoIaController.sessoes
);

export default retornoIaRoutes;
