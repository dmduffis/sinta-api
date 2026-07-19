/**
 * Upsert curated starter POIs + dishes without wiping existing data.
 *
 * Usage: npx tsx scripts/upsert-seed-dishes.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

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

type DishSeed = {
  id: string;
  name: string;
  description: string;
  priceRange: string;
};

type PoiSeed = {
  id: string;
  communityId: string;
  name: string;
  category: string;
  address: string;
  hours: string;
  ethnicities: string[];
  lat: number;
  lng: number;
  dishes: DishSeed[];
};

const POIS: PoiSeed[] = [
  {
    id: "r-nan-xiang",
    communityId: "chinatown-flushing",
    name: "Nan Xiang Xiao Long Bao",
    category: "restaurant",
    address: "Main St, Flushing",
    hours: "10:00–21:00",
    ethnicities: ["chinese"],
    lat: 40.759,
    lng: -73.83,
    dishes: [
      {
        id: "d-xlb",
        name: "Soup Dumplings",
        description: "Delicate steamed buns filled with pork and molten broth.",
        priceRange: "$$",
      },
      {
        id: "d-shengjian",
        name: "Shengjian Bao",
        description: "Pan-fried soup buns with crispy bottoms.",
        priceRange: "$",
      },
    ],
  },
  {
    id: "r-jackson-dosa",
    communityId: "little-india",
    name: "Jackson Diner",
    category: "restaurant",
    address: "37th Ave, Jackson Heights",
    hours: "11:00–22:00",
    ethnicities: ["indian"],
    lat: 40.7498,
    lng: -73.891,
    dishes: [
      {
        id: "d-masala-dosa",
        name: "Masala Dosa",
        description: "Crispy fermented crepe with spiced potato filling.",
        priceRange: "$$",
      },
      {
        id: "d-chole-bhature",
        name: "Chole Bhature",
        description: "Chickpea curry with puffy fried bread.",
        priceRange: "$$",
      },
    ],
  },
  {
    id: "r-singh-roti",
    communityId: "little-guyana-queens",
    name: "Singh's Roti Shop",
    category: "restaurant",
    address: "Liberty Ave, Richmond Hill",
    hours: "10:00–21:00",
    ethnicities: ["guyanese"],
    lat: 40.6965,
    lng: -73.831,
    dishes: [
      {
        id: "d-doubles",
        name: "Doubles",
        description: "Curried chickpeas on soft fried bara.",
        priceRange: "$",
      },
      {
        id: "d-goat-roti",
        name: "Goat Roti",
        description: "Flaky skin with tender curried goat.",
        priceRange: "$$",
      },
    ],
  },
  {
    id: "r-taco-sunset",
    communityId: "little-mexico-sunset-park",
    name: "Tacos El Bronco",
    category: "restaurant",
    address: "5th Ave, Sunset Park",
    hours: "11:00–23:00",
    ethnicities: ["mexican"],
    lat: 40.6455,
    lng: -74.01,
    dishes: [
      {
        id: "d-al-pastor",
        name: "Tacos al Pastor",
        description: "Trompo-carved pork with pineapple on corn tortillas.",
        priceRange: "$",
      },
      {
        id: "d-horchata",
        name: "Horchata",
        description: "Cinnamon rice drink — cold and sweet.",
        priceRange: "$",
      },
    ],
  },
  {
    id: "r-malecon",
    communityId: "little-dominican-republic",
    name: "El Malecon",
    category: "restaurant",
    address: "W 175th St, Washington Heights",
    hours: "07:00–23:00",
    ethnicities: ["dominican"],
    lat: 40.8465,
    lng: -73.938,
    dishes: [
      {
        id: "d-mangu",
        name: "Mangú",
        description: "Mashed plantains with pickled onions and fried cheese.",
        priceRange: "$$",
      },
      {
        id: "d-pollo-guisado",
        name: "Pollo Guisado",
        description: "Slow-simmered Dominican chicken stew with rice.",
        priceRange: "$$",
      },
    ],
  },
  {
    id: "r-yemen-house",
    communityId: "little-yemen",
    name: "Yemen Café",
    category: "restaurant",
    address: "Atlantic Ave, Brooklyn",
    hours: "11:00–22:00",
    ethnicities: ["yemeni"],
    lat: 40.69,
    lng: -73.986,
    dishes: [
      {
        id: "d-mandi",
        name: "Mandi",
        description: "Slow-cooked lamb over fragrant basmati rice.",
        priceRange: "$$$",
      },
      {
        id: "d-fahsa",
        name: "Fahsa",
        description: "Bubbling lamb stew with hilbeh foam.",
        priceRange: "$$",
      },
    ],
  },
];

async function main() {
  console.log(`Upserting ${POIS.length} curated POIs with dishes…`);

  for (const poi of POIS) {
    const community = await prisma.community.findUnique({
      where: { id: poi.communityId },
    });
    if (!community) {
      console.log(`  skip ${poi.id} — missing community ${poi.communityId}`);
      continue;
    }

    await prisma.poi.upsert({
      where: { id: poi.id },
      create: {
        id: poi.id,
        communityId: poi.communityId,
        name: poi.name,
        category: poi.category,
        address: poi.address,
        hours: poi.hours,
        ethnicities: poi.ethnicities,
      },
      update: {
        communityId: poi.communityId,
        name: poi.name,
        category: poi.category,
        address: poi.address,
        hours: poi.hours,
        ethnicities: poi.ethnicities,
      },
    });
    await setPoiLocation(poi.id, poi.lat, poi.lng);

    for (const dish of poi.dishes) {
      await prisma.dish.upsert({
        where: { id: dish.id },
        create: {
          id: dish.id,
          poiId: poi.id,
          name: dish.name,
          description: dish.description,
          priceRange: dish.priceRange,
        },
        update: {
          poiId: poi.id,
          name: dish.name,
          description: dish.description,
          priceRange: dish.priceRange,
        },
      });
    }
    console.log(`  ✓ ${poi.id} (${poi.dishes.length} dishes)`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
