import { Router } from "express";
import {
  syncAllYelpHandler,
  syncCommunityYelpHandler,
  syncMetroYelpHandler,
} from "../controllers/yelpSyncController";

export const adminRouter = Router();

adminRouter.post("/sync/yelp", syncAllYelpHandler);
adminRouter.post("/sync/yelp/metro/:metroId", syncMetroYelpHandler);
adminRouter.post("/sync/yelp/:id", syncCommunityYelpHandler);
