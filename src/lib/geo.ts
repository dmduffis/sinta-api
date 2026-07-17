import { prisma } from "./prisma";
import type { GeoJsonPoint, GeoJsonPolygon } from "../types";

type CommunityRow = {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  description: string;
  heroEmoji: string | null;
  imageUrl: string | null;
  boundary_geojson: string | null;
  distance_meters?: number | null;
};

type PoiRow = {
  id: string;
  communityId: string;
  name: string;
  category: string;
  address: string | null;
  hours: string | null;
  location_geojson: string | null;
};

export function parseGeoJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function findCommunitiesNear(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<CommunityRow[]> {
  return prisma.$queryRawUnsafe<CommunityRow[]>(
    `
    SELECT
      c.id,
      c.name,
      c.neighborhood,
      c.city,
      c.description,
      c."heroEmoji",
      c."imageUrl",
      ST_AsGeoJSON(c.boundary)::text AS boundary_geojson,
      ST_Distance(
        c.boundary::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) AS distance_meters
    FROM "Community" c
    WHERE c.boundary IS NOT NULL
      AND ST_DWithin(
        c.boundary::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
    ORDER BY distance_meters ASC
    `,
    lng,
    lat,
    radiusMeters,
  );
}

export async function listCommunities(): Promise<CommunityRow[]> {
  return prisma.$queryRawUnsafe<CommunityRow[]>(
    `
    SELECT
      c.id,
      c.name,
      c.neighborhood,
      c.city,
      c.description,
      c."heroEmoji",
      c."imageUrl",
      ST_AsGeoJSON(c.boundary)::text AS boundary_geojson
    FROM "Community" c
    ORDER BY c.name ASC
    `,
  );
}

export async function getCommunityWithGeometry(
  id: string,
): Promise<CommunityRow | null> {
  const rows = await prisma.$queryRawUnsafe<CommunityRow[]>(
    `
    SELECT
      c.id,
      c.name,
      c.neighborhood,
      c.city,
      c.description,
      c."heroEmoji",
      c."imageUrl",
      ST_AsGeoJSON(c.boundary)::text AS boundary_geojson
    FROM "Community" c
    WHERE c.id = $1
    LIMIT 1
    `,
    id,
  );
  return rows[0] ?? null;
}

export async function listPoisForCommunity(
  communityId: string,
): Promise<PoiRow[]> {
  return prisma.$queryRawUnsafe<PoiRow[]>(
    `
    SELECT
      p.id,
      p."communityId",
      p.name,
      p.category,
      p.address,
      p.hours,
      ST_AsGeoJSON(p.location)::text AS location_geojson
    FROM "Poi" p
    WHERE p."communityId" = $1
    ORDER BY p.name ASC
    `,
    communityId,
  );
}

export async function getPoiWithGeometry(id: string): Promise<PoiRow | null> {
  const rows = await prisma.$queryRawUnsafe<PoiRow[]>(
    `
    SELECT
      p.id,
      p."communityId",
      p.name,
      p.category,
      p.address,
      p.hours,
      ST_AsGeoJSON(p.location)::text AS location_geojson
    FROM "Poi" p
    WHERE p.id = $1
    LIMIT 1
    `,
    id,
  );
  return rows[0] ?? null;
}

export function mapCommunitySummary(row: CommunityRow) {
  return {
    id: row.id,
    name: row.name,
    neighborhood: row.neighborhood,
    city: row.city,
    description: row.description,
    heroEmoji: row.heroEmoji,
    imageUrl: row.imageUrl,
    ...(row.distance_meters != null
      ? { distanceMeters: Number(row.distance_meters) }
      : {}),
  };
}

export function mapCommunityDetail(
  row: CommunityRow,
  pois: ReturnType<typeof mapPoi>[],
) {
  return {
    ...mapCommunitySummary(row),
    boundary: parseGeoJson<GeoJsonPolygon>(row.boundary_geojson),
    pois,
  };
}

export function mapPoi(row: PoiRow) {
  return {
    id: row.id,
    communityId: row.communityId,
    name: row.name,
    category: row.category,
    address: row.address,
    hours: row.hours,
    location: parseGeoJson<GeoJsonPoint>(row.location_geojson),
  };
}
