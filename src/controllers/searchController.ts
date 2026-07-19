import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import {
  getPoiWithGeometry,
  listCommunities,
  mapCommunitySummary,
  mapPoi,
} from "../lib/geo";

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

    const needle = q.toLowerCase();

    const [allCommunities, pois, dishes] = await Promise.all([
      listCommunities(),
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
        include: {
          poi: {
            select: {
              name: true,
              communityId: true,
              ethnicities: true,
            },
          },
        },
        take: 20,
        orderBy: { name: "asc" },
      }),
    ]);

    const communities = allCommunities
      .filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.neighborhood.toLowerCase().includes(needle) ||
          c.description.toLowerCase().includes(needle) ||
          c.city.toLowerCase().includes(needle),
      )
      .slice(0, 20)
      .map(mapCommunitySummary);

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
      communities,
      pois: poiResults,
      dishes: dishes.map((d) => ({
        id: d.id,
        poiId: d.poiId,
        name: d.name,
        description: d.description,
        priceRange: d.priceRange,
        imageUrl: d.imageUrl,
        poiName: d.poi.name,
        communityId: d.poi.communityId,
        ethnicities: Array.isArray(d.poi.ethnicities)
          ? d.poi.ethnicities.slice(0, 2)
          : [],
      })),
    });
  } catch (err) {
    next(err);
  }
}
