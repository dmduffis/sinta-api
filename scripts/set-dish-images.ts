/**
 * Set curated Unsplash food photos on known seed dishes.
 *
 * Usage: npx tsx scripts/set-dish-images.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/** Unsplash CDN — free-to-use food photography (https://unsplash.com/license). */
const u = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&h=600&q=80`;

const DISH_IMAGES: Record<string, string> = {
  // Himalayan / Tibetan
  "d-momos": u("photo-1534422298391-e4f8c172dddb"),
  "d-thukpa": u("photo-1569718212165-3a8278d5f624"),
  "d-butter-tea": u("photo-1571934811356-5cc061b6821f"),
  // Little Odessa
  d14: u("photo-1559339352-11d035aa65de"),
  "d-blini": u("photo-1482049016688-2d3e1b311543"),
  // Koreatown
  d9: u("photo-1590301157890-4810ed352733"),
  d10: u("photo-1604908176997-125f25cc6f3d"),
  // Little Senegal
  d13: u("photo-1455619452474-d2be8b1e70cd"),
  "d-yassa": u("photo-1555939594-58d7cb561ad1"),
  "d-attaya": u("photo-1544787219-7f47ccb76574"),
  // Flushing Chinatown
  "d-xlb": u("photo-1496116218417-1a781b1c416c"),
  "d-shengjian": u("photo-1563245372-f21724e3856d"),
  // Little India
  "d-masala-dosa": u("photo-1589301760014-d929f3979dbc"),
  "d-chole-bhature": u("photo-1585937421612-70a008356fbe"),
  // Little Guyana
  "d-doubles": u("photo-1601050690597-df0568f70950"),
  "d-goat-roti": u("photo-1565557623262-b51c2513a641"),
  // Sunset Park Mexico
  "d-al-pastor": u("photo-1565299585323-38d6b0865b47"),
  "d-horchata": u("photo-1546171753-97d7676e4602"),
  // Dominican
  "d-mangu": u("photo-1525755662778-989d0524087e"),
  "d-pollo-guisado": u("photo-1598103442097-8b74394b95c6"),
  // Yemen
  "d-mandi": u("photo-1516684669134-de6f7c473a2a"),
  "d-fahsa": u("photo-1574484284002-952d92456975"),
};

async function main() {
  const ids = Object.keys(DISH_IMAGES);
  console.log(`Updating images for ${ids.length} dishes…`);

  let updated = 0;
  for (const id of ids) {
    const imageUrl = DISH_IMAGES[id]!;
    const result = await prisma.dish.updateMany({
      where: { id },
      data: { imageUrl },
    });
    if (result.count > 0) {
      updated += 1;
      console.log(`  ✓ ${id}`);
    } else {
      console.log(`  · skip ${id} (not found)`);
    }
  }

  console.log(`Done. Updated ${updated}/${ids.length}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
