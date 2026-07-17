import { Router } from "express";
import {
  getRouteHandler,
  listRoutesHandler,
} from "../controllers/routesController";

export const routesRouter = Router();

routesRouter.get("/", listRoutesHandler);
routesRouter.get("/:id", getRouteHandler);
