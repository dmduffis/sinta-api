import "dotenv/config";
import { syncYelpForAllCommunities, syncYelpForCommunity } from "../src/lib/yelpSync";
import { prisma } from "../src/lib/prisma";

async function main() {
  const communityId = process.argv[2];

  if (communityId) {
    const result = await syncYelpForCommunity(communityId);
    console.log(result);
  } else {
    const results = await syncYelpForAllCommunities();
    console.log(JSON.stringify(results, null, 2));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
