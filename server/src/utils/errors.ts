import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function badRequest(code: string, message: string) {
  return new AppError(400, code, message);
}

export function unauthorized(message = "No autenticado") {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "No autorizado") {
  return new AppError(403, "FORBIDDEN", message);
}

export function notFound(code: string, message: string) {
  return new AppError(404, code, message);
}

export function conflict(code: string, message: string, details?: Record<string, unknown>) {
  return new AppError(409, code, message, details);
}

export function formatErrorPayload(error: unknown) {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return {
      statusCode: 400,
      payload: {
        error: true,
        code: "VALIDATION_ERROR",
        message: firstIssue?.message ?? "Error de validación en la solicitud",
      },
    };
  }

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      payload: {
        error: true,
        code: error.code,
        message: error.message,
        ...(error.details ?? {}),
      },
    };
  }

  return {
    statusCode: 500,
    payload: {
      error: true,
      code: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error interno. Intentalo nuevamente.",
    },
  };
}
