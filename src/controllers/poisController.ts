import type { Request, Response, NextFunction } from "express";
import {
  getPoiWithGeometry,
  listPoisNear,
  mapPoi,
} from "../lib/geo";
import { prisma } from "../lib/prisma";

export async function listPoisHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const nearRaw = typeof req.query.near === "string" ? req.query.near : "";
    const [latStr, lngStr] = nearRaw.split(",").map((s) => s.trim());
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({
        error: "near=lat,lng is required (e.g. near=40.72,-73.95)",
      });
      return;
    }

    const radiusRaw =
      typeof req.query.radius === "string" ? Number(req.query.radius) : 5000;
    const radiusMeters = Number.isFinite(radiusRaw)
      ? Math.min(Math.max(radiusRaw, 200), 50000)
      : 5000;

    const limitRaw =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 80;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 80;

    const ethnicityRaw =
      typeof req.query.ethnicity === "string" ? req.query.ethnicity : "";
    const ethnicities = ethnicityRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const communityId =
      typeof req.query.communityId === "string" && req.query.communityId.trim()
        ? req.query.communityId.trim()
        : undefined;

    const unassignedOnly =
      req.query.unassignedOnly === "1" || req.query.unassignedOnly === "true";

    const rows = await listPoisNear({
      lat,
      lng,
      radiusMeters,
      ethnicities: ethnicities.length ? ethnicities : undefined,
      communityId,
      unassignedOnly,
      limit,
    });

    res.json({
      near: { lat, lng },
      radiusMeters,
      count: rows.length,
      pois: rows.map(mapPoi),
    });
  } catch (err) {
    next(err);
  }
}

export async function getPoiHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const row = await getPoiWithGeometry(id);
    if (!row) {
      res.status(404).json({ error: "POI not found" });
      return;
    }

    const dishes = await prisma.dish.findMany({
      where: { poiId: id },
      orderBy: { name: "asc" },
    });

    const ethnicities = row.ethnicities ?? [];

    res.json({
      ...mapPoi(row),
      dishes: dishes.map((d) => ({
        id: d.id,
        poiId: d.poiId,
        name: d.name,
        description: d.description,
        priceRange: d.priceRange,
        communityId: row.communityId,
        ethnicities: Array.isArray(ethnicities) ? ethnicities.slice(0, 2) : [],
      })),
    });
  } catch (err) {
    next(err);
  }
}
