/**
 * Sync ethnic restaurants for a metro (no enclave required).
 *
 * Usage: npx tsx scripts/sync-yelp-metro.ts nyc
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { METRO_SYNCS, syncYelpForMetro } from "../src/lib/yelpSync";

async function main() {
  const metroId = (process.argv[2] ?? "nyc").trim().toLowerCase();
  if (!METRO_SYNCS[metroId]) {
    console.error(
      `Unknown metro "${metroId}". Known: ${Object.keys(METRO_SYNCS).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Syncing metro cuisine POIs for ${metroId}…`);
  const result = await syncYelpForMetro(metroId);
  console.log(
    `  ${result.metroName}: fetched=${result.fetched} upserted=${result.upserted} skipped=${result.skipped}`,
  );
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
