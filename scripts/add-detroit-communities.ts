/**
 * Upsert Greater Detroit enclaves without wiping existing communities / POIs.
 *
 * Usage: npx tsx scripts/add-detroit-communities.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { syncYelpForCommunity } from "../src/lib/yelpSync";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const needsSsl =
  /supabase\.(co|com)/.test(connectionString) ||
  connectionString.includes("sslmode=require");

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  }),
});

const COMMUNITIES = [
  {
    id: "little-arabia-dearborn",
    name: "Little Arabia in Dearborn",
    neighborhood: "Warren Avenue, Dearborn",
    city: "Metro Detroit",
    description:
      "America's Arab capital — Warren Avenue bakeries, shawarma spots, and the densest Middle Eastern food corridor outside the Middle East.",
    heroEmoji: "🇱🇧",
    lat: 42.3223,
    lng: -83.1763,
    delta: 0.028,
  },
  {
    id: "little-baghdad-sterling-heights",
    name: "Little Baghdad in Sterling Heights",
    neighborhood: "15 Mile & Dequindre, Sterling Heights",
    city: "Metro Detroit",
    description:
      "Metro Detroit's Chaldean and Iraqi hub — restaurants, markets, and bilingual storefronts around 15 Mile and Dequindre.",
    heroEmoji: "🇮🇶",
    lat: 42.5806,
    lng: -83.0675,
    delta: 0.03,
  },
  {
    id: "banglatown-hamtramck",
    name: "Banglatown in Hamtramck",
    neighborhood: "Conant Street, Hamtramck",
    city: "Metro Detroit",
    description:
      "Hamtramck's Banglatown — Bangladeshi groceries, sweets shops, and South Asian restaurants along Conant Street.",
    heroEmoji: "🇧🇩",
    lat: 42.3978,
    lng: -83.057,
    delta: 0.022,
  },
  {
    id: "mexicantown-detroit",
    name: "Mexicantown in Detroit",
    neighborhood: "Southwest Detroit",
    city: "Metro Detroit",
    description:
      "Detroit's Mexicantown — tacos, bakeries, and murals along Vernor and Bagley in Southwest Detroit.",
    heroEmoji: "🇲🇽",
    lat: 42.3185,
    lng: -83.0865,
    delta: 0.022,
  },
] as const;

function squarePolygonWkt(lat: number, lng: number, delta: number): string {
  const minLng = lng - delta;
  const maxLng = lng + delta;
  const minLat = lat - delta;
  const maxLat = lat + delta;
  return `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
}

async function main() {
  console.log(`Upserting ${COMMUNITIES.length} Metro Detroit enclaves…`);

  for (const c of COMMUNITIES) {
    await prisma.community.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        name: c.name,
        neighborhood: c.neighborhood,
        city: c.city,
        description: c.description,
        heroEmoji: c.heroEmoji,
      },
      update: {
        name: c.name,
        neighborhood: c.neighborhood,
        city: c.city,
        description: c.description,
        heroEmoji: c.heroEmoji,
      },
    });

    await prisma.$executeRawUnsafe(
      `UPDATE "Community" SET boundary = ST_SetSRID(ST_GeomFromText($1), 4326) WHERE id = $2`,
      squarePolygonWkt(c.lat, c.lng, c.delta),
      c.id,
    );
    console.log(`  ✓ ${c.id}`);
  }

  console.log("\nSyncing Yelp for Metro Detroit enclaves…");
  for (const c of COMMUNITIES) {
    const result = await syncYelpForCommunity(c.id, {
      radiusMeters: 2800,
      limit: 50,
    });
    console.log(
      `  ${result.communityId}: fetched=${result.fetched} upserted=${result.upserted} skipped=${result.skipped}`,
    );
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
