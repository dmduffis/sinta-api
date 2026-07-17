import { Router } from "express";
import {
  syncAllYelpHandler,
  syncCommunityYelpHandler,
} from "../controllers/yelpSyncController";

export const adminRouter = Router();

adminRouter.post("/sync/yelp", syncAllYelpHandler);
adminRouter.post("/sync/yelp/:id", syncCommunityYelpHandler);
