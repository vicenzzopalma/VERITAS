import Whatsapp from "../../models/Whatsapp";
import WppKey from "../../models/WppKey";
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
  const allWhatsapps = await Whatsapp.findAll();
  if (allWhatsapps.length === 0) return;

  // Filtrar apenas aparelhos que possuem credenciais/chaves criptográficas salvas
  // Evita disparar loop de QR code ou erros em slots desativados ou reservas vazias
  const whatsappsToStart: Whatsapp[] = [];
  for (const whatsapp of allWhatsapps) {
    const hasKeys =
      (await WppKey.count({ where: { connectionId: whatsapp.id } })) > 0 ||
      Boolean(whatsapp.session && whatsapp.session.trim().length > 10);

    if (hasKeys) {
      whatsappsToStart.push(whatsapp);
    }
  }

  if (whatsappsToStart.length === 0) {
    logger.info("Nenhuma sessão com credenciais encontrada para inicialização automática.");
    return;
  }

  const concurrency = getPositiveInteger(
    process.env.WHATSAPP_START_CONCURRENCY,
    4
  );
  const batchDelayMs = getPositiveInteger(
    process.env.WHATSAPP_START_BATCH_DELAY_MS,
    1200
  );

  logger.info({
    info: "Starting paired WhatsApp sessions with bounded concurrency",
    totalPaired: whatsappsToStart.length,
    concurrency,
    batchDelayMs
  });

  for (let offset = 0; offset < whatsappsToStart.length; offset += concurrency) {
    const batch = whatsappsToStart.slice(offset, offset + concurrency);
    await Promise.all(
      batch.map(async whatsapp => {
        try {
          await StartWhatsAppSession(whatsapp);
        } catch (err) {
          logger.error({
            info: "Failed to initialize WhatsApp session during startup",
            whatsappId: whatsapp.id,
            err
          });
        }
      })
    );

    if (offset + batch.length < whatsappsToStart.length) {
      await new Promise(resolve => setTimeout(resolve, batchDelayMs));
    }
  }
};
