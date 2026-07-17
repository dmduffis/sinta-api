import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  userId: string;
}

/**
 * Stub auth middleware.
 *
 * TODO: Replace this with real authentication before shipping
 * (e.g. Supabase Auth, Clerk, or Firebase Auth). Do not ship
 * with a trusted client-supplied user id header.
 *
 * For now, reads `x-user-id` and attaches it to the request.
 * Falls back to DEV_DEFAULT_USER_ID when set (local development only).
 */
export function stubAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const headerId = req.header("x-user-id")?.trim();
  const fallback = process.env.DEV_DEFAULT_USER_ID?.trim();
  const userId = headerId || fallback;

  if (!userId) {
    res.status(401).json({
      error:
        "Missing x-user-id header. Stub auth requires x-user-id until real auth is wired up.",
    });
    return;
  }

  (req as AuthenticatedRequest).userId = userId;
  next();
}
