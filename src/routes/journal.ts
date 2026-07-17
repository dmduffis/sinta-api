import { Router } from "express";
import { createJournalHandler } from "../controllers/journalController";
import { stubAuth } from "../middleware/auth";

export const journalRouter = Router();

journalRouter.post("/", stubAuth, createJournalHandler);
