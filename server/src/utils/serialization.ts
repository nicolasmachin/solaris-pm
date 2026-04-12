import { Prisma } from "@prisma/client";

export function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}

export function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function serializeDateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}
