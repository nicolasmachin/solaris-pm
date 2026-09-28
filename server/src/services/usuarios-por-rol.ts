import { prisma } from "../lib/prisma.js";

// Usuarios activos de un rol que tienen mail (el mail es opcional desde que los
// Generadores pueden entrar sin mail; para avisarles hace falta). Lo usan los
// jobs que alertan a un área: aviso de habilitación y plan de granizo.
export async function usuariosPorRol(roleName: string): Promise<Array<{ id: string; email: string }>> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: roleName }, email: { not: null } },
    select: { id: true, email: true },
  });
  return users.filter((u): u is { id: string; email: string } => !!u.email);
}
