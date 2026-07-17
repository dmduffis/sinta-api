import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RouteType } from "@prisma/client";

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

/** Rough square polygon around a lat/lng center (degrees ≈ city-block scale). */
function squarePolygonWkt(lat: number, lng: number, delta = 0.008): string {
  const minLng = lng - delta;
  const maxLng = lng + delta;
  const minLat = lat - delta;
  const maxLat = lat + delta;
  // WKT: exterior ring, lon lat order, closed
  return `POLYGON((${minLng} ${minLat}, ${maxLng} ${minLat}, ${maxLng} ${maxLat}, ${minLng} ${maxLat}, ${minLng} ${minLat}))`;
}

function pointWkt(lat: number, lng: number): string {
  return `POINT(${lng} ${lat})`;
}

async function setCommunityBoundary(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  const wkt = squarePolygonWkt(lat, lng);
  await prisma.$executeRawUnsafe(
    `UPDATE "Community" SET boundary = ST_SetSRID(ST_GeomFromText($1), 4326) WHERE id = $2`,
    wkt,
    id,
  );
}

async function setPoiLocation(
  id: string,
  lat: number,
  lng: number,
): Promise<void> {
  const wkt = pointWkt(lat, lng);
  await prisma.$executeRawUnsafe(
    `UPDATE "Poi" SET location = ST_SetSRID(ST_GeomFromText($1), 4326) WHERE id = $2`,
    wkt,
    id,
  );
}

/**
 * Seed data aligned to sinta-mobile mock communities:
 * - Little Bhod-Tibet (Jackson Heights) — "Little Tibet" in product copy
 * - Little Odessa (Brighton Beach)
 * - Koreatown in Manhattan
 * - Little Senegal (Harlem)
 */
async function main() {
  console.log("Seeding Sinta database…");

  // Wipe in FK-safe order for idempotent re-seeds
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.stamp.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.poi.deleteMany();
  await prisma.community.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      id: "seed-user-1",
      email: "explorer@sinta.app",
      displayName: "Sinta Explorer",
    },
  });

  // —— Communities ——
  const littleTibet = await prisma.community.create({
    data: {
      id: "little-bhod-tibet",
      name: "Little Bhod-Tibet",
      neighborhood: "Jackson Heights, Queens",
      city: "New York",
      description:
        "A Himalayan pocket near Northern Boulevard — momos, butter tea energy, and prayer flags in shop windows.",
      heroEmoji: "🏔️",
    },
  });
  await setCommunityBoundary(littleTibet.id, 40.755, -73.87);

  const littleOdessa = await prisma.community.create({
    data: {
      id: "little-odessa",
      name: "Little Odessa",
      neighborhood: "Brighton Beach, Brooklyn",
      city: "New York",
      description:
        "Brighton Beach's Little Odessa — smoked fish, Georgian bakery, and Russian under the elevated tracks.",
      heroEmoji: "🇷🇺",
    },
  });
  await setCommunityBoundary(littleOdessa.id, 40.5776, -73.9614);

  const koreatown = await prisma.community.create({
    data: {
      id: "koreatown-manhattan",
      name: "Koreatown in Manhattan",
      neighborhood: "Manhattan",
      city: "New York",
      description:
        "A vertical village around 32nd Street — karaoke above BBQ, skincare next to soju bars.",
      heroEmoji: "🍜",
    },
  });
  await setCommunityBoundary(koreatown.id, 40.7473, -73.9869);

  const littleSenegal = await prisma.community.create({
    data: {
      id: "little-senegal",
      name: "Little Senegal",
      neighborhood: "Harlem, Manhattan",
      city: "New York",
      description:
        "Le Petit Sénégal on West 116th — thieboudienne, fabric shops, and Wolof in the air.",
      heroEmoji: "🇸🇳",
    },
  });
  await setCommunityBoundary(littleSenegal.id, 40.8029, -73.9531);

  // —— POIs + dishes ——
  const himalayanYak = await prisma.poi.create({
    data: {
      id: "r-momo-hut",
      communityId: littleTibet.id,
      name: "Himalayan Yak",
      category: "restaurant",
      address: "Northern Blvd, Queens",
      hours: "11:00–22:00",
      dishes: {
        create: [
          {
            id: "d-momos",
            name: "Momos",
            description: "Steamed Himalayan dumplings with spicy tomato achar.",
            priceRange: "$$",
          },
          {
            id: "d-thukpa",
            name: "Thukpa",
            description: "Hearty noodle soup with vegetables and tender meat.",
            priceRange: "$$",
          },
        ],
      },
    },
  });
  await setPoiLocation(himalayanYak.id, 40.756, -73.869);

  const butterTeaHouse = await prisma.poi.create({
    data: {
      id: "r-butter-tea",
      communityId: littleTibet.id,
      name: "Prayer Flag Café",
      category: "cafe",
      address: "37th Ave near Northern Blvd",
      hours: "09:00–20:00",
      dishes: {
        create: [
          {
            id: "d-butter-tea",
            name: "Butter Tea",
            description: "Salty Tibetan po cha — warming and rich.",
            priceRange: "$",
          },
        ],
      },
    },
  });
  await setPoiLocation(butterTeaHouse.id, 40.754, -73.871);

  const tatiana = await prisma.poi.create({
    data: {
      id: "r-tatiana",
      communityId: littleOdessa.id,
      name: "Tatiana Restaurant",
      category: "restaurant",
      address: "3152 Brighton 6th St",
      hours: "12:00–23:00",
      dishes: {
        create: [
          {
            id: "d14",
            name: "Smoked Fish Platter",
            description: "Assorted smoked fish with dark bread.",
            priceRange: "$$$",
          },
        ],
      },
    },
  });
  await setPoiLocation(tatiana.id, 40.578, -73.96);

  const odessaMarket = await prisma.poi.create({
    data: {
      id: "r-odessa-market",
      communityId: littleOdessa.id,
      name: "Brighton Beach Market",
      category: "market",
      address: "Brighton Beach Ave",
      hours: "08:00–20:00",
      dishes: {
        create: [
          {
            id: "d-blini",
            name: "Blini with Caviar",
            description: "Thin pancakes with sour cream and caviar.",
            priceRange: "$$$",
          },
        ],
      },
    },
  });
  await setPoiLocation(odessaMarket.id, 40.577, -73.962);

  const jongro = await prisma.poi.create({
    data: {
      id: "r-jongro",
      communityId: koreatown.id,
      name: "Jongro BBQ",
      category: "restaurant",
      address: "22 W 32nd St",
      hours: "11:30–02:00",
      dishes: {
        create: [
          {
            id: "d9",
            name: "Korean BBQ",
            description: "Table-grilled short rib with banchan.",
            priceRange: "$$$",
          },
        ],
      },
    },
  });
  await setPoiLocation(jongro.id, 40.7475, -73.987);

  const herNameIsHan = await prisma.poi.create({
    data: {
      id: "r-her-name",
      communityId: koreatown.id,
      name: "Her Name Is Han",
      category: "restaurant",
      address: "17 E 31st St",
      hours: "17:00–23:00",
      dishes: {
        create: [
          {
            id: "d10",
            name: "Tteokbokki",
            description: "Chewy rice cakes in spicy gochujang sauce.",
            priceRange: "$$",
          },
        ],
      },
    },
  });
  await setPoiLocation(herNameIsHan.id, 40.7468, -73.9855);

  const africaKine = await prisma.poi.create({
    data: {
      id: "r-africa-kine",
      communityId: littleSenegal.id,
      name: "Africa Kine",
      category: "restaurant",
      address: "256 W 116th St",
      hours: "12:00–22:00",
      dishes: {
        create: [
          {
            id: "d13",
            name: "Thieboudienne",
            description: "Senegal's national fish-and-rice dish.",
            priceRange: "$$",
          },
          {
            id: "d-yassa",
            name: "Chicken Yassa",
            description: "Onion-lemon marinated chicken with rice.",
            priceRange: "$$",
          },
        ],
      },
    },
  });
  await setPoiLocation(africaKine.id, 40.803, -73.9535);

  const senegalMarket = await prisma.poi.create({
    data: {
      id: "r-senegal-market",
      communityId: littleSenegal.id,
      name: "Le Petit Marché",
      category: "market",
      address: "W 116th St",
      hours: "10:00–19:00",
      dishes: {
        create: [
          {
            id: "d-attaya",
            name: "Attaya Tea",
            description: "Sweet Senegalese mint tea poured from height.",
            priceRange: "$",
          },
        ],
      },
    },
  });
  await setPoiLocation(senegalMarket.id, 40.8025, -73.9525);

  // —— Sample stamp + journal ——
  await prisma.stamp.create({
    data: {
      userId: user.id,
      communityId: koreatown.id,
    },
  });

  await prisma.journalEntry.create({
    data: {
      userId: user.id,
      communityId: koreatown.id,
      poiId: jongro.id,
      note: "Late-night BBQ after work — banchan never ends.",
      photoUrl: null,
    },
  });

  // —— Routes ——
  const neonNoodles = await prisma.route.create({
    data: {
      id: "route-neon-noodles",
      title: "Neon & Noodles",
      description: "Late-night Koreatown for after-work explorers",
      type: RouteType.curated,
      stops: {
        create: [
          { poiId: jongro.id, order: 1 },
          { poiId: herNameIsHan.id, order: 2 },
        ],
      },
    },
  });

  const queensHimalaya = await prisma.route.create({
    data: {
      id: "route-queens-himalaya",
      title: "Himalayan Queens Afternoon",
      description: "Momos, thukpa, and butter tea in Little Bhod-Tibet",
      type: RouteType.seasonal,
      stops: {
        create: [
          { poiId: himalayanYak.id, order: 1 },
          { poiId: butterTeaHouse.id, order: 2 },
        ],
      },
    },
  });

  // Placeholder AI-generated route — listing falls back to newest / nearby until real AI lands
  await prisma.route.create({
    data: {
      id: "route-ai-harlem-boardwalk",
      title: "Harlem to the Boardwalk (suggested)",
      description:
        "Stub AI suggestion spanning Little Senegal flavors and Brighton Beach classics.",
      type: RouteType.ai_generated,
      stops: {
        create: [
          { poiId: africaKine.id, order: 1 },
          { poiId: tatiana.id, order: 2 },
        ],
      },
    },
  });

  console.log("Seed complete.");
  console.log({
    user: user.id,
    communities: 4,
    routes: [neonNoodles.id, queensHimalaya.id],
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
