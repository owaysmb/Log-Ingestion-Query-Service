import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { parseDate, parseEnum, parseNonEmptyString } from "./primitives.js";
import { allowedLevel } from "./constants.js";

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type RejectedEntry = { index: number; reason: string };

export async function validateLogBatch(
  logs: any[]
): Promise<{ accepted: number; rejected: RejectedEntry[] }> {
  const rejected: RejectedEntry[] = [];
  const acceptedEntries: {
    timestamp: Date;
    level: string;
    service: string;
    message: string;
    attributes: Prisma.InputJsonValue;
  }[] = [];

  for (let index = 0; index < logs.length; index++) {
    const entry = logs[index];

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      rejected.push({ index, reason: "entry must be an object" });
      continue;
    }

    const { timestamp, level, service, message, attributes } = entry;

    const parsedTimestamp = parseDate(timestamp);
    if (!parsedTimestamp) {
      rejected.push({ index, reason: "invalid timestamp" });
      continue;
    }

    if (parsedTimestamp.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      rejected.push({ index, reason: "timestamp too far in the future" });
      continue;
    }

    const parsedLevel = parseEnum(level, allowedLevel);
    if (!parsedLevel) {
      rejected.push({ index, reason: "invalid level" });
      continue;
    }

    const parsedService = parseNonEmptyString(service);
    if (!parsedService) {
      rejected.push({ index, reason: "invalid service" });
      continue;
    }

    const parsedMessage = parseNonEmptyString(message);
    if (!parsedMessage) {
      rejected.push({ index, reason: "invalid message" });
      continue;
    }

    let parsedAttributes: Prisma.InputJsonValue = {};
    if (attributes !== undefined && attributes !== null) {
      if (typeof attributes !== "object" || Array.isArray(attributes)) {
        rejected.push({ index, reason: "invalid attributes" });
        continue;
      }
      let hasBadValue = false;
      for (const value of Object.values(attributes)) {
        const t = typeof value;
        if (t !== "string" && t !== "number" && t !== "boolean") {
          hasBadValue = true;
          break;
        }
      }
      if (hasBadValue) {
        rejected.push({ index, reason: "invalid attributes" });
        continue;
      }
      parsedAttributes = attributes as Prisma.InputJsonValue;
    }

    acceptedEntries.push({
      timestamp: parsedTimestamp,
      level: parsedLevel,
      service: parsedService,
      message: parsedMessage,
      attributes: parsedAttributes,
    });
  }

  if (acceptedEntries.length > 0) {
    await prisma.log.createMany({ data: acceptedEntries });
  }

  return { accepted: acceptedEntries.length, rejected };
}
