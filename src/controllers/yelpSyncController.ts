import type { Request, Response, NextFunction } from "express";
import {
  syncYelpForAllCommunities,
  syncYelpForCommunity,
  syncYelpForMetro,
} from "../lib/yelpSync";

/**
 * Protects admin sync endpoints.
 * Set SYNC_SECRET in env and send header: x-sync-secret: <value>
 */
function assertSyncAuthorized(req: Request, res: Response): boolean {
  const expected = process.env.SYNC_SECRET?.trim();
  if (!expected) {
    res.status(503).json({
      error: "SYNC_SECRET is not configured on the server",
    });
    return false;
  }
  const provided = req.header("x-sync-secret")?.trim();
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export async function syncCommunityYelpHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!assertSyncAuthorized(req, res)) return;

    const { id } = req.params;
    const radiusMeters =
      typeof req.query.radius === "string" ? Number(req.query.radius) : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const term =
      typeof req.query.term === "string" ? req.query.term : undefined;

    const result = await syncYelpForCommunity(id, {
      radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      term,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function syncAllYelpHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!assertSyncAuthorized(req, res)) return;

    const radiusMeters =
      typeof req.query.radius === "string" ? Number(req.query.radius) : undefined;
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const term =
      typeof req.query.term === "string" ? req.query.term : undefined;

    const results = await syncYelpForAllCommunities({
      radiusMeters: Number.isFinite(radiusMeters) ? radiusMeters : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      term,
    });

    res.json({
      communities: results.length,
      results,
    });
  } catch (err) {
    next(err);
  }
}

export async function syncMetroYelpHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!assertSyncAuthorized(req, res)) return;

    const metroId = req.params.metroId?.trim().toLowerCase();
    if (!metroId) {
      res.status(400).json({ error: "metroId is required" });
      return;
    }

    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

    const result = await syncYelpForMetro(metroId, {
      limitPerSearch: Number.isFinite(limit) ? limit : undefined,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}
