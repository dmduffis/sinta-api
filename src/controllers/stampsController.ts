import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { CreateStampBody } from "../types";

export async function createStampHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CreateStampBody;
    const communityId = body.communityId?.trim();
    if (!communityId) {
      res.status(400).json({ error: "communityId is required" });
      return;
    }

    const userId = (
      body.userId?.trim() || (req as AuthenticatedRequest).userId
    ).trim();

    const [user, community] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.community.findUnique({ where: { id: communityId } }),
    ]);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!community) {
      res.status(404).json({ error: "Community not found" });
      return;
    }

    const stamp = await prisma.stamp.upsert({
      where: {
        userId_communityId: { userId, communityId },
      },
      create: { userId, communityId },
      update: {},
      include: {
        community: {
          select: {
            id: true,
            name: true,
            neighborhood: true,
            city: true,
            description: true,
            heroEmoji: true,
            imageUrl: true,
          },
        },
      },
    });

    res.status(201).json({
      id: stamp.id,
      userId: stamp.userId,
      communityId: stamp.communityId,
      earnedAt: stamp.earnedAt.toISOString(),
      community: stamp.community,
    });
  } catch (err) {
    next(err);
  }
}

export async function listUserStampsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const stamps = await prisma.stamp.findMany({
      where: { userId: id },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            neighborhood: true,
            city: true,
            description: true,
            heroEmoji: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { earnedAt: "desc" },
    });

    res.json(
      stamps.map((s) => ({
        id: s.id,
        userId: s.userId,
        communityId: s.communityId,
        earnedAt: s.earnedAt.toISOString(),
        community: s.community,
      })),
    );
  } catch (err) {
    next(err);
  }
}
