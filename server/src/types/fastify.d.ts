import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
      // name del rol (ej: "ADMIN", "OPERACIONES"). Desde el refactor de roles
      // dinámicos es un string libre sourced de la tabla roles.
      role: string;
    };
  }
}
