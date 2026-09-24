import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import { logger } from "../../utils/logger";

const getPositiveInteger = (
  value: string | undefined,
  fallback: number
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const StartAllWhatsAppsSessions = async (): Promise<void> => {
  const whatsapps = await ListWhatsAppsService();
  if (whatsapps.length === 0) return;

  const concurrency = getPositiveInteger(
    process.env.WHATSAPP_START_CONCURRENCY,
    8
  );
  const batchDelayMs = getPositiveInteger(
    process.env.WHATSAPP_START_BATCH_DELAY_MS,
    250
  );

  logger.info({
    info: "Starting WhatsApp sessions with bounded concurrency",
    total: whatsapps.length,
    concurrency,
    batchDelayMs
  });

  for (let offset = 0; offset < whatsapps.length; offset += concurrency) {
    const batch = whatsapps.slice(offset, offset + concurrency);
    const results = await Promise.allSettled(
      batch.map(whatsapp => StartWhatsAppSession(whatsapp))
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        logger.error({
          info: "Failed to initialize WhatsApp session during startup",
          whatsappId: batch[index].id,
          err: result.reason
        });
      }
    });

    if (offset + batch.length < whatsapps.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
};
