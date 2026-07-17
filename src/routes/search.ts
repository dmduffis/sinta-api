import { Router } from "express";
import { searchHandler } from "../controllers/searchController";

export const searchRouter = Router();

searchRouter.get("/", searchHandler);
