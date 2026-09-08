import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function requireCurrentAgency() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const agency = await prisma.agency.findUnique({
    where: { id: session.agencyId },
  });
  if (!agency) redirect("/login");

  return agency;
}

export async function getCurrentAgency() {
  return requireCurrentAgency();
}

export async function getCurrentAgencyId(): Promise<string> {
  const agency = await requireCurrentAgency();
  return agency.id;
}
