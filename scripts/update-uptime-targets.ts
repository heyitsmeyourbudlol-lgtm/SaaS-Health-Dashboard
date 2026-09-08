import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

  const uptimeIntegrations = await prisma.integration.findMany({
    where: { provider: "uptime" },
    include: { client: true },
  });

  console.log(`Found ${uptimeIntegrations.length} uptime integrations`);

  for (const integration of uptimeIntegrations) {
    const name = integration.client?.name ?? "";
    const patternBase = slugify(name) || integration.clientId;

    const targets = [
      `${baseUrl}/api/healthz?pattern=${encodeURIComponent(patternBase)}:a`,
      `${baseUrl}/api/healthz?pattern=${encodeURIComponent(patternBase)}:b`,
    ];

    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        config: JSON.stringify({ targets }),
      },
    });

    console.log(`Updated ${integration.clientId} targets`);
  }

  console.log("Uptime targets update complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

