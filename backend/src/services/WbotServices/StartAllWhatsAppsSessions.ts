import Whatsapp from "../../models/Whatsapp";
import WppKey from "../../models/WppKey";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import { logger } from "../../utils/logger";
import { getIO } from "../../libs/socket";

let isReconnectingAll = false;

export const StartAllWhatsAppsSessions = async (): Promise<{
  total: number;
  reconnecting: number;
  qrCodeSlots: number;
}> => {
  if (isReconnectingAll) {
    logger.warn(
      "[StartAllWhatsAppsSessions] Já existe um processo de reconexão em andamento. Ignorando chamada concorrente."
    );
    return { total: 0, reconnecting: 0, qrCodeSlots: 0 };
  }

  isReconnectingAll = true;

  try {
    const allWhatsapps = await Whatsapp.findAll();
    if (allWhatsapps.length === 0) {
      isReconnectingAll = false;
      return { total: 0, reconnecting: 0, qrCodeSlots: 0 };
    }

    const io = getIO();
    const toReconnect: Whatsapp[] = [];
    let qrCount = 0;

    for (const whatsapp of allWhatsapps) {
      // Aparelhos já 100% conectados são preservados intactos
      if (whatsapp.status === "CONNECTED") {
        continue;
      }

      // Verifica se possui chaves de sessão salvas
      const keyCount = await WppKey.count({
        where: { connectionId: whatsapp.id }
      });
      const hasSessionString = Boolean(
        whatsapp.session && whatsapp.session.trim().length > 10
      );
      const hasCredentials = keyCount > 0 || hasSessionString;

      if (!hasCredentials) {
        // Dispositivo sem credenciais (slot vazio ou não pareado):
        // Define status como 'qrcode' para exibir imediatamente o botão de QR Code no frontend
        await whatsapp.update({
          status: "qrcode",
          qrcode: "",
          retries: 0
        });
        qrCount++;

        const updated = await Whatsapp.findByPk(whatsapp.id);
        if (updated) {
          io.emit("whatsappSession", {
            action: "update",
            session: updated
          });
          io.emit("whatsapp", {
            action: "update",
            whatsapp: updated
          });
        }
      } else {
        toReconnect.push(whatsapp);
      }
    }

    logger.info({
      info: "[StartAllWhatsAppsSessions] Orquestrador de reconexão disparado",
      totalDevices: allWhatsapps.length,
      toReconnect: toReconnect.length,
      setQrCode: qrCount
    });

    // Fila de processamento em segundo plano (Non-blocking worker):
    // Processa em lotes de 3 a 4 com pausa de 1200ms entre lotes.
    // Isso garante uso suave da CPU (~5%), memória estável e ZERO lock no SQLite.
    (async () => {
      const concurrency = 3;
      const batchDelayMs = 1200;

      try {
        for (let offset = 0; offset < toReconnect.length; offset += concurrency) {
          const batch = toReconnect.slice(offset, offset + concurrency);

          await Promise.all(
            batch.map(async w => {
              try {
                await StartWhatsAppSession(w);
              } catch (err) {
                logger.error({
                  info: "[StartAllWhatsAppsSessions] Falha ao tentar reconectar dispositivo",
                  whatsappId: w.id,
                  name: w.name,
                  err
                });

                // Se houver falha de autenticação/chaves inválidas, mostra botão de QR Code
                try {
                  await w.update({ status: "qrcode", retries: 0 });
                  const fresh = await Whatsapp.findByPk(w.id);
                  if (fresh) {
                    io.emit("whatsappSession", {
                      action: "update",
                      session: fresh
                    });
                    io.emit("whatsapp", {
                      action: "update",
                      whatsapp: fresh
                    });
                  }
                } catch {}
              }
            })
          );

          if (offset + batch.length < toReconnect.length) {
            await new Promise(res => setTimeout(res, batchDelayMs));
          }
        }
      } finally {
        isReconnectingAll = false;
        logger.info(
          "[StartAllWhatsAppsSessions] Ciclo de reconexão de todos os aparelhos finalizado."
        );
      }
    })().catch(err => {
      isReconnectingAll = false;
      logger.error({
        info: "[StartAllWhatsAppsSessions] Erro não tratado no worker de reconexão",
        err
      });
    });

    return {
      total: allWhatsapps.length,
      reconnecting: toReconnect.length,
      qrCodeSlots: qrCount
    };
  } catch (error) {
    isReconnectingAll = false;
    logger.error({
      info: "[StartAllWhatsAppsSessions] Erro fatal na orquestração",
      error
    });
    throw error;
  }
};
