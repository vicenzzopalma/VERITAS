import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as SectorController from "../controllers/SectorController";

const sectorRoutes = Router();
sectorRoutes.get("/sectors", isAuth, SectorController.index);
sectorRoutes.post("/sectors", isAuth, SectorController.store);

export default sectorRoutes;
