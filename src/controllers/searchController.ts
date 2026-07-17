import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { getPoiWithGeometry, mapPoi } from "../lib/geo";

export async function searchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.status(400).json({ error: "Query param q is required" });
      return;
    }

    const [communities, pois, dishes] = await Promise.all([
      prisma.community.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { neighborhood: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 20,
        orderBy: { name: "asc" },
      }),
      prisma.poi.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 20,
        orderBy: { name: "asc" },
      }),
      prisma.dish.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        include: { poi: { select: { name: true } } },
        take: 20,
        orderBy: { name: "asc" },
      }),
    ]);

    const poiResults = await Promise.all(
      pois.map(async (p) => {
        const row = await getPoiWithGeometry(p.id);
        return row
          ? mapPoi(row)
          : {
              id: p.id,
              communityId: p.communityId,
              name: p.name,
              category: p.category,
              address: p.address,
              hours: p.hours,
              location: null,
            };
      }),
    );

    res.json({
      query: q,
      communities: communities.map((c) => ({
        id: c.id,
        name: c.name,
        neighborhood: c.neighborhood,
        city: c.city,
        description: c.description,
        heroEmoji: c.heroEmoji,
        imageUrl: c.imageUrl,
      })),
      pois: poiResults,
      dishes: dishes.map((d) => ({
        id: d.id,
        poiId: d.poiId,
        name: d.name,
        description: d.description,
        priceRange: d.priceRange,
        poiName: d.poi.name,
      })),
    });
  } catch (err) {
    next(err);
  }
}
