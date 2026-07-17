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

/** Preferred Yelp search terms for enclaves where generic "restaurants" is too noisy. */
const COMMUNITY_SEARCH_TERMS: Record<string, string | string[]> = {
  "little-colombia": "colombian",
  "little-ecuador": "ecuadorian",
  "little-mexico-sunset-park": "mexican",
  "little-mexico-port-richmond": "mexican",
  "little-india": "indian",
  "little-pakistan": "pakistani",
  "little-bangladesh": "bangladeshi",
  "koreatown-manhattan": "korean",
  "koreatown-queens": ["korean", "korean bbq"],
  "chinatown-flushing": "chinese",
  "chinatown-manhattan": "chinese",
  "chinatown-sunset-park": "chinese",
  "little-senegal": ["senegalese", "west african", "african"],
  "little-africa-si": ["liberian", "west african", "african"],
  "little-africa-bronx": ["ghanaian", "west african", "african"],
  "little-dominican-republic": "dominican",
  "little-haiti": "haitian",
  "little-poland": "polish",
  "little-ukraine": "ukrainian",
  "little-odessa": ["russian", "ukrainian"],
  "little-manila": "filipino",
  "little-egypt": ["egyptian", "middle eastern"],
  "little-yemen": "yemeni",
  "little-palestine": ["palestinian", "middle eastern"],
  "little-guyana-queens": ["guyanese", "roti"],
  "little-guyana-bronx": ["guyanese", "roti"],
  "guyana-gateway": ["guyanese", "roti"],
  "little-caribbean": ["caribbean", "jamaican", "jerk"],
  "little-bhod-tibet": ["tibetan", "nepali", "himalayan", "momo"],
  "little-albania": "albanian",
  "little-india-hicksville": ["indian", "south indian", "pakistani"],
  "little-portugal-mineola": ["portuguese", "bacalhau"],
  "little-el-salvador-brentwood": ["salvadoran", "pupusas", "central american"],
  "koreatown-nassau": ["korean", "korean bbq"],
};

/** Ethnicity ids that "belong" to an enclave — used to reclaim misplaced Yelp POIs. */
const COMMUNITY_ETHNICITIES: Record<string, string[]> = {
  "little-colombia": ["colombian"],
  "little-ecuador": ["ecuadorian"],
  "little-mexico-sunset-park": ["mexican"],
  "little-mexico-port-richmond": ["mexican"],
  "little-india": ["indian"],
  "little-pakistan": ["pakistani"],
  "little-bangladesh": ["bangladeshi"],
  "koreatown-manhattan": ["korean"],
  "koreatown-queens": ["korean"],
  "chinatown-flushing": ["chinese", "taiwanese"],
  "chinatown-manhattan": ["chinese"],
  "chinatown-sunset-park": ["chinese"],
  "little-senegal": ["senegalese", "west_african", "ghanaian"],
  "little-africa-si": ["liberian", "west_african", "ghanaian", "senegalese"],
  "little-africa-bronx": ["ghanaian", "west_african", "nigerian", "senegalese"],
  "little-dominican-republic": ["dominican"],
  "little-haiti": ["haitian"],
  "little-poland": ["polish"],
  "little-ukraine": ["ukrainian"],
  "little-odessa": ["russian", "ukrainian"],
  "little-manila": ["filipino"],
  "little-egypt": ["egyptian", "middle_eastern"],
  "little-yemen": ["yemeni"],
  "little-palestine": ["palestinian", "middle_eastern", "lebanese"],
  "little-guyana-queens": ["guyanese"],
  "little-guyana-bronx": ["guyanese"],
  "guyana-gateway": ["guyanese"],
  "little-caribbean": ["jamaican", "caribbean", "haitian", "guyanese"],
  "little-bhod-tibet": ["nepali"],
  "little-albania": ["albanian"],
  "little-india-hicksville": ["indian", "pakistani", "bangladeshi"],
  "little-portugal-mineola": ["portuguese"],
  "little-el-salvador-brentwood": ["salvadoran"],
  "koreatown-nassau": ["korean"],
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

function ethnicityMatchesCommunity(
  communityId: string,
  ethnicities: string[],
): boolean {
  const preferred = COMMUNITY_ETHNICITIES[communityId];
  if (!preferred?.length) return false;
  return ethnicities.some((e) => preferred.includes(e));
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

  const ethnicities = ethnicitiesFromYelp(business);
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
    ethnicities,
  };

  const existing = await prisma.poi.findUnique({
    where: { yelpId: business.id },
  });

  // Same Yelp place near multiple enclaves: keep first assignment, unless this
  // enclave is a better ethnicity match (e.g. Arepa Lady → Little Colombia).
  if (existing && existing.communityId !== communityId) {
    const reclaim = ethnicityMatchesCommunity(communityId, ethnicities);
    if (!reclaim) return "skipped";
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

  const termOpt =
    opts?.term ?? COMMUNITY_SEARCH_TERMS[communityId] ?? "restaurants";
  const terms = Array.isArray(termOpt) ? termOpt : [termOpt];

  const seen = new Set<string>();
  const businesses: YelpBusiness[] = [];
  for (const term of terms) {
    const batch = await searchYelpBusinesses({
      latitude: centroid.lat,
      longitude: centroid.lng,
      radiusMeters: opts?.radiusMeters ?? 1600,
      limit: opts?.limit ?? 40,
      term,
    });
    for (const b of batch) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      businesses.push(b);
    }
    if (terms.length > 1) {
      await new Promise((r) => setTimeout(r, 250));
    }
  }

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
    await new Promise((r) => setTimeout(r, 350));
  }
  return results;
}
