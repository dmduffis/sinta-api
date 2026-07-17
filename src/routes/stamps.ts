import { Router } from "express";
import { createStampHandler } from "../controllers/stampsController";
import { stubAuth } from "../middleware/auth";

export const stampsRouter = Router();

stampsRouter.post("/", stubAuth, createStampHandler);
