import { Router } from "express";
import { getPoiHandler, listPoisHandler } from "../controllers/poisController";

export const poisRouter = Router();

poisRouter.get("/", listPoisHandler);
poisRouter.get("/:id", getPoiHandler);
