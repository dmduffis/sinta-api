import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { CreateJournalBody } from "../types";

export async function createJournalHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CreateJournalBody;
    const note = body.note?.trim();
    if (!note) {
      res.status(400).json({ error: "note is required" });
      return;
    }

    const userId = (
      body.userId?.trim() || (req as AuthenticatedRequest).userId
    ).trim();
    const communityId = body.communityId ?? null;
    const poiId = body.poiId ?? null;
    const photoUrl = body.photoUrl ?? null;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (communityId) {
      const community = await prisma.community.findUnique({
        where: { id: communityId },
      });
      if (!community) {
        res.status(404).json({ error: "Community not found" });
        return;
      }
    }

    if (poiId) {
      const poi = await prisma.poi.findUnique({ where: { id: poiId } });
      if (!poi) {
        res.status(404).json({ error: "POI not found" });
        return;
      }
    }

    const entry = await prisma.journalEntry.create({
      data: {
        userId,
        note,
        communityId,
        poiId,
        photoUrl,
      },
    });

    res.status(201).json({
      id: entry.id,
      userId: entry.userId,
      communityId: entry.communityId,
      poiId: entry.poiId,
      note: entry.note,
      photoUrl: entry.photoUrl,
      createdAt: entry.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function listUserJournalHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const entries = await prisma.journalEntry.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      entries.map((e) => ({
        id: e.id,
        userId: e.userId,
        communityId: e.communityId,
        poiId: e.poiId,
        note: e.note,
        photoUrl: e.photoUrl,
        createdAt: e.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
}
