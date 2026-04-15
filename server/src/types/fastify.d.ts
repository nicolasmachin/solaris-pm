import "fastify";
import type { Role } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }
}
