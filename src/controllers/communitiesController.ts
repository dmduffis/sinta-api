import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import {
  findCommunitiesNear,
  getCommunityWithGeometry,
  listCommunities,
  listPoisForCommunity,
  mapCommunityDetail,
  mapCommunitySummary,
  mapPoi,
} from "../lib/geo";

function parseNearParam(
  near: string | undefined,
): { lat: number; lng: number } | null {
  if (!near) return null;
  const [latStr, lngStr] = near.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function listCommunitiesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const near = parseNearParam(
      typeof req.query.near === "string" ? req.query.near : undefined,
    );
    const radiusRaw =
      typeof req.query.radius === "string" ? Number(req.query.radius) : NaN;
    const radiusMeters = Number.isFinite(radiusRaw) ? radiusRaw : 5000;

    if (req.query.near && !near) {
      res.status(400).json({
        error: "Invalid near param. Expected ?near=lat,lng",
      });
      return;
    }

    if (near) {
      const rows = await findCommunitiesNear(
        near.lat,
        near.lng,
        radiusMeters,
      );
      res.json(rows.map(mapCommunitySummary));
      return;
    }

    const rows = await listCommunities();
    res.json(rows.map(mapCommunitySummary));
  } catch (err) {
    next(err);
  }
}

export async function getCommunityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const community = await getCommunityWithGeometry(id);
    if (!community) {
      res.status(404).json({ error: "Community not found" });
      return;
    }

    const poiRows = await listPoisForCommunity(id);
    res.json(mapCommunityDetail(community, poiRows.map(mapPoi)));
  } catch (err) {
    next(err);
  }
}

export async function listCommunityDishesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const community = await prisma.community.findUnique({ where: { id } });
    if (!community) {
      res.status(404).json({ error: "Community not found" });
      return;
    }

    const dishes = await prisma.dish.findMany({
      where: { poi: { communityId: id } },
      include: { poi: { select: { name: true } } },
      orderBy: { name: "asc" },
    });

    res.json(
      dishes.map((d) => ({
        id: d.id,
        poiId: d.poiId,
        name: d.name,
        description: d.description,
        priceRange: d.priceRange,
        poiName: d.poi.name,
      })),
    );
  } catch (err) {
    next(err);
  }
}
