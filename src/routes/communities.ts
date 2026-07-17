import { Router } from "express";
import {
  getCommunityHandler,
  listCommunitiesHandler,
  listCommunityDishesHandler,
} from "../controllers/communitiesController";

export const communitiesRouter = Router();

communitiesRouter.get("/", listCommunitiesHandler);
communitiesRouter.get("/:id/dishes", listCommunityDishesHandler);
communitiesRouter.get("/:id", getCommunityHandler);
