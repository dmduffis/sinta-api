import type { Request, Response, NextFunction } from "express";
import { getPoiWithGeometry, mapPoi } from "../lib/geo";
import { prisma } from "../lib/prisma";

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

    res.json({
      ...mapPoi(row),
      dishes: dishes.map((d) => ({
        id: d.id,
        poiId: d.poiId,
        name: d.name,
        description: d.description,
        priceRange: d.priceRange,
      })),
    });
  } catch (err) {
    next(err);
  }
}
