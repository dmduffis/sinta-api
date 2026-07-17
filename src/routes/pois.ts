import { Router } from "express";
import { getPoiHandler } from "../controllers/poisController";

export const poisRouter = Router();

poisRouter.get("/:id", getPoiHandler);
