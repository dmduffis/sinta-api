import type { Request, Response, NextFunction } from "express";
import { FavoriteType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth";

function parseFavoriteType(value: unknown): FavoriteType | null {
  if (value === "community" || value === "restaurant" || value === "dish") {
    return value;
  }
  return null;
}

async function resolveFavoriteTarget(
  type: FavoriteType,
  targetId: string,
): Promise<{
  ok: boolean;
  title?: string;
  subtitle?: string;
  communityId?: string;
  emoji?: string;
  restaurantId?: string;
}> {
  if (type === "community") {
    const community = await prisma.community.findUnique({
      where: { id: targetId },
    });
    if (!community) return { ok: false };
    return {
      ok: true,
      title: community.name,
      subtitle: community.neighborhood,
      communityId: community.id,
      emoji: community.heroEmoji ?? "📍",
    };
  }

  if (type === "restaurant") {
    const poi = await prisma.poi.findUnique({
      where: { id: targetId },
      include: { community: { select: { id: true, name: true } } },
    });
    if (!poi) return { ok: false };
    return {
      ok: true,
      title: poi.name,
      subtitle: `${poi.community.name} · Restaurant`,
      communityId: poi.communityId,
      restaurantId: poi.id,
      emoji: "🍽️",
    };
  }

  const dish = await prisma.dish.findUnique({
    where: { id: targetId },
    include: {
      poi: {
        select: {
          id: true,
          name: true,
          communityId: true,
          community: { select: { name: true } },
        },
      },
    },
  });
  if (!dish) return { ok: false };
  return {
    ok: true,
    title: dish.name,
    subtitle: `${dish.poi.name} · Dish`,
    communityId: dish.poi.communityId,
    restaurantId: dish.poi.id,
    emoji: "🥢",
  };
}

export async function listUserFavoritesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const favorites = await prisma.favorite.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });

    const items = await Promise.all(
      favorites.map(async (fav) => {
        const resolved = await resolveFavoriteTarget(fav.type, fav.targetId);
        if (!resolved.ok) return null;
        return {
          id: fav.id,
          type: fav.type,
          targetId: fav.targetId,
          title: resolved.title,
          subtitle: resolved.subtitle,
          communityId: resolved.communityId,
          restaurantId: resolved.restaurantId ?? null,
          emoji: resolved.emoji,
          savedAt: fav.createdAt.toISOString(),
        };
      }),
    );

    res.json(items.filter(Boolean));
  } catch (err) {
    next(err);
  }
}

/** POST body: { type, targetId } — creates favorite if missing (idempotent). */
export async function createFavoriteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const type = parseFavoriteType(req.body?.type);
    const targetId =
      typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
    if (!type || !targetId) {
      res.status(400).json({ error: "type and targetId are required" });
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const resolved = await resolveFavoriteTarget(type, targetId);
    if (!resolved.ok) {
      res.status(404).json({ error: "Favorite target not found" });
      return;
    }

    const favorite = await prisma.favorite.upsert({
      where: {
        userId_type_targetId: { userId, type, targetId },
      },
      create: { userId, type, targetId },
      update: {},
    });

    res.status(201).json({
      id: favorite.id,
      type: favorite.type,
      targetId: favorite.targetId,
      title: resolved.title,
      subtitle: resolved.subtitle,
      communityId: resolved.communityId,
      restaurantId: resolved.restaurantId ?? null,
      emoji: resolved.emoji,
      savedAt: favorite.createdAt.toISOString(),
      favorited: true,
    });
  } catch (err) {
    next(err);
  }
}

/** DELETE body/query: type + targetId — removes favorite. */
export async function deleteFavoriteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const type = parseFavoriteType(req.body?.type ?? req.query.type);
    const targetId = String(
      req.body?.targetId ?? req.query.targetId ?? "",
    ).trim();
    if (!type || !targetId) {
      res.status(400).json({ error: "type and targetId are required" });
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    await prisma.favorite.deleteMany({
      where: { userId, type, targetId },
    });

    res.json({ favorited: false, type, targetId });
  } catch (err) {
    next(err);
  }
}

/** POST /favorites/toggle — add or remove. */
export async function toggleFavoriteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const type = parseFavoriteType(req.body?.type);
    const targetId =
      typeof req.body?.targetId === "string" ? req.body.targetId.trim() : "";
    if (!type || !targetId) {
      res.status(400).json({ error: "type and targetId are required" });
      return;
    }

    const userId = (req as AuthenticatedRequest).userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const resolved = await resolveFavoriteTarget(type, targetId);
    if (!resolved.ok) {
      res.status(404).json({ error: "Favorite target not found" });
      return;
    }

    const existing = await prisma.favorite.findUnique({
      where: {
        userId_type_targetId: { userId, type, targetId },
      },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      res.json({
        favorited: false,
        type,
        targetId,
        title: resolved.title,
        subtitle: resolved.subtitle,
        communityId: resolved.communityId,
        restaurantId: resolved.restaurantId ?? null,
        emoji: resolved.emoji,
      });
      return;
    }

    const favorite = await prisma.favorite.create({
      data: { userId, type, targetId },
    });

    res.status(201).json({
      id: favorite.id,
      favorited: true,
      type: favorite.type,
      targetId: favorite.targetId,
      title: resolved.title,
      subtitle: resolved.subtitle,
      communityId: resolved.communityId,
      restaurantId: resolved.restaurantId ?? null,
      emoji: resolved.emoji,
      savedAt: favorite.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
