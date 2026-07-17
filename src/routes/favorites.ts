import { Router } from "express";
import {
  createFavoriteHandler,
  deleteFavoriteHandler,
  toggleFavoriteHandler,
} from "../controllers/favoritesController";
import { stubAuth } from "../middleware/auth";

export const favoritesRouter = Router();

favoritesRouter.post("/", stubAuth, createFavoriteHandler);
favoritesRouter.post("/toggle", stubAuth, toggleFavoriteHandler);
favoritesRouter.delete("/", stubAuth, deleteFavoriteHandler);
