import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function resolveAdminWriterUserId() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    return session.user.id;
  }

  const fallbackAdmin = await prisma.user.findFirst({
    where: { isAdmin: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return fallbackAdmin?.id ?? null;
}
