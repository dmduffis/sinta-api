import type { Request, Response, NextFunction } from "express";
import { RouteType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getPoiWithGeometry, mapPoi } from "../lib/geo";

function parseRouteType(value: unknown): RouteType | undefined {
  if (typeof value !== "string") return undefined;
  if (
    value === RouteType.curated ||
    value === RouteType.ai_generated ||
    value === RouteType.seasonal
  ) {
    return value;
  }
  return undefined;
}

/**
 * List routes, optionally filtered by ?type=.
 *
 * TODO: replace with real logic — AI-based route recommendations should
 * score/rank routes for the current user (preferences, visit history,
 * proximity). Until then we fall back to most recently created routes.
 */
export async function listRoutesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const typeParam = req.query.type;
    if (typeParam !== undefined && parseRouteType(typeParam) === undefined) {
      res.status(400).json({
        error:
          "Invalid type. Expected curated | ai_generated | seasonal",
      });
      return;
    }

    const type = parseRouteType(typeParam);

    // TODO: replace with real logic (AI recommendations / personalization).
    // Fallback: most recently added routes (optionally filtered by type).
    const routes = await prisma.route.findMany({
      where: type ? { type } : undefined,
      include: { _count: { select: { stops: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      routes.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        createdAt: r.createdAt.toISOString(),
        stopCount: r._count.stops,
      })),
    );
  } catch (err) {
    next(err);
  }
}

export async function getRouteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        stops: { orderBy: { order: "asc" } },
      },
    });

    if (!route) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    const stops = await Promise.all(
      route.stops.map(async (stop) => {
        const poiRow = await getPoiWithGeometry(stop.poiId);
        return {
          id: stop.id,
          routeId: stop.routeId,
          poiId: stop.poiId,
          order: stop.order,
          poi: poiRow ? mapPoi(poiRow) : undefined,
        };
      }),
    );

    res.json({
      id: route.id,
      title: route.title,
      description: route.description,
      type: route.type,
      createdAt: route.createdAt.toISOString(),
      stopCount: stops.length,
      stops,
    });
  } catch (err) {
    next(err);
  }
}
