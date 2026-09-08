import { PrismaClient } from "@prisma/client";
import { checkUptimeForClient } from "../src/lib/uptime";

const prisma = new PrismaClient();

async function main() {
  const firstClient = await prisma.client.findFirst({
    where: { archived: false },
    orderBy: { healthScore: "asc" },
  });

  if (!firstClient) {
    console.log("No clients found.");
    return;
  }

  console.log(`Running uptime check for client: ${firstClient.name}`);
  const res = await checkUptimeForClient(firstClient.id);

  console.log("Check result:", res);

  const updated = await prisma.client.findUnique({
    where: { id: firstClient.id },
  });
  console.log("Updated latestUptimePct:", updated?.latestUptimePct);
  console.log("Updated healthScore:", updated?.healthScore);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

