import { prisma } from "./prisma";
import { ethnicitiesFromYelp } from "./ethnicities";
import {
  formatYelpAddress,
  formatYelpCategory,
  searchYelpBusinesses,
  type YelpBusiness,
} from "./yelp";

export type YelpSyncResult = {
  communityId: string;
  communityName: string;
  fetched: number;
  upserted: number;
  skipped: number;
};

async function getCommunityCentroid(
  communityId: string,
): Promise<{ lat: number; lng: number; name: string } | null> {
  const rows = await prisma.$queryRawUnsafe<
    { name: string; latitude: number | string | null; longitude: number | string | null }[]
  >(
    `
    SELECT
      c.name,
      ST_Y(ST_Centroid(c.boundary)) AS latitude,
      ST_X(ST_Centroid(c.boundary)) AS longitude
    FROM "Community" c
    WHERE c.id = $1
    LIMIT 1
    `,
    communityId,
  );

  const row = rows[0];
  if (!row) return null;
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name: row.name };
}

async function setPoiLocation(
  poiId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "Poi" SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3`,
    lng,
    lat,
    poiId,
  );
}

/** Keep POIs that fall inside the community polygon when boundary exists. */
async function isInsideCommunity(
  communityId: string,
  lat: number,
  lng: number,
): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ inside: boolean }[]>(
    `
    SELECT ST_Contains(
      c.boundary,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)
    ) AS inside
    FROM "Community" c
    WHERE c.id = $3
    LIMIT 1
    `,
    lng,
    lat,
    communityId,
  );
  return Boolean(rows[0]?.inside);
}

async function upsertYelpBusiness(
  communityId: string,
  business: YelpBusiness,
): Promise<"upserted" | "skipped"> {
  const lat = business.coordinates?.latitude;
  const lng = business.coordinates?.longitude;
  if (lat == null || lng == null) return "skipped";

  const inside = await isInsideCommunity(communityId, lat, lng);
  if (!inside) return "skipped";

  const data = {
    communityId,
    name: business.name,
    category: formatYelpCategory(business),
    address: formatYelpAddress(business),
    hours: null as string | null,
    yelpId: business.id,
    rating: business.rating ?? null,
    priceLevel: business.price ?? null,
    imageUrl: business.image_url || null,
    yelpUrl: business.url || null,
    ethnicities: ethnicitiesFromYelp(business),
  };

  const existing = await prisma.poi.findUnique({
    where: { yelpId: business.id },
  });

  // Same Yelp place can sit near multiple enclaves — keep the first assignment.
  if (existing && existing.communityId !== communityId) {
    return "skipped";
  }

  const poi = existing
    ? await prisma.poi.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.poi.create({ data });

  await setPoiLocation(poi.id, lat, lng);
  return "upserted";
}

/**
 * Pull Yelp restaurants/food near a community centroid and upsert POIs
 * that fall inside the community boundary.
 */
export async function syncYelpForCommunity(
  communityId: string,
  opts?: { radiusMeters?: number; limit?: number; term?: string },
): Promise<YelpSyncResult> {
  const centroid = await getCommunityCentroid(communityId);
  if (!centroid) {
    throw new Error(`Community not found or missing boundary: ${communityId}`);
  }

  const businesses = await searchYelpBusinesses({
    latitude: centroid.lat,
    longitude: centroid.lng,
    radiusMeters: opts?.radiusMeters ?? 1200,
    limit: opts?.limit ?? 30,
    term: opts?.term ?? "restaurants",
  });

  let upserted = 0;
  let skipped = 0;

  for (const business of businesses) {
    const result = await upsertYelpBusiness(communityId, business);
    if (result === "upserted") upserted += 1;
    else skipped += 1;
  }

  return {
    communityId,
    communityName: centroid.name,
    fetched: businesses.length,
    upserted,
    skipped,
  };
}

export async function syncYelpForAllCommunities(
  opts?: { radiusMeters?: number; limit?: number; term?: string },
): Promise<YelpSyncResult[]> {
  const communities = await prisma.community.findMany({
    select: { id: true },
    orderBy: { name: "asc" },
  });

  const results: YelpSyncResult[] = [];
  for (const community of communities) {
    const result = await syncYelpForCommunity(community.id, opts);
    results.push(result);
    // Brief pause to stay under Yelp Fusion rate limits
    await new Promise((r) => setTimeout(r, 350));
  }
  return results;
}
