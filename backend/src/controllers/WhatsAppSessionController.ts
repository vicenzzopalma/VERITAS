import { Request, Response } from "express";
import { whatsappProvider } from "../providers/WhatsApp";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import { StartAllWhatsAppsSessions } from "../services/WbotServices/StartAllWhatsAppsSessions";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import ClearWppSessionKeys from "../services/WppKeyServices/ClearWppSessionKeys";
import { getIO } from "../libs/socket";
import { canAccessWhatsapp } from "../services/WhatsappService/WhatsappAccessPolicy";
import {
  getPairingPayload,
  isPairingInProgress,
  markWatching,
  normalizePairingNumber,
  setTypedNumber
} from "../helpers/pairingCode";
import {
  ensurePairingCodeForSession,
  requestPairingCodeForSession
} from "../providers/WhatsApp/Implementations/whaileys";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  // item 81: pareamento por código em andamento: não reinicia a sessão no meio.
  if (isPairingInProgress(whatsapp.id)) {
    return res.status(409).json({ error: "ERR_PAIRING_IN_PROGRESS" });
  }

  // Se o aparelho não possui credenciais ou está iniciando pareamento, limpa QR code anterior
  if (!whatsapp.session || whatsapp.session.length < 10) {
    await whatsapp.update({ qrcode: "", status: "OPENING" });
  }

  StartWhatsAppSession(whatsapp);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const idNumber = Number(whatsappId);
  const currentWhatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, currentWhatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  // item 81: "Novo QR" (ou a renovação automática do modal) não apaga um pareamento
  // por código que o celular já aceitou e que espera o 515 para reconectar.
  if (isPairingInProgress(idNumber)) {
    return res.status(409).json({ error: "ERR_PAIRING_IN_PROGRESS" });
  }

  // Remove sessao ativa em memoria e limpa qualquer listener
  try {
    await whatsappProvider.removeSession(idNumber);
  } catch (err) {
    // ignora se nao houver sessao ativa
  }

  // Limpa todas as chaves criptograficas antigas (WppKeys no SQLite e Redis)
  await ClearWppSessionKeys(idNumber);

  await currentWhatsapp.update({
    session: "",
    qrcode: "",
    retries: 0,
    status: "OPENING"
  });

  StartWhatsAppSession(currentWhatsapp);

  return res.status(200).json({ message: "Starting session." });
};

// item 81: estado atual do código de pareamento (o modal pode abrir depois do evento).
const showPairingCode = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }
  if (whatsapp.status === "CONNECTED") {
    return res.status(200).json({ whatsappId: whatsapp.id, status: "SEM_NUMERO" });
  }
  // Modal aberto: libera o código automático e tenta gerar já (resultado vem pelo socket).
  markWatching(whatsapp.id);
  ensurePairingCodeForSession(whatsapp);
  return res.status(200).json(getPairingPayload(whatsapp.id));
};

// item 81: número do chip digitado na tela => pede o código para o socket em QR.
const requestPairingCode = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }
  const number = normalizePairingNumber(req.body?.number);
  if (!number) {
    return res.status(400).json({ error: "ERR_PAIRING_INVALID_NUMBER" });
  }
  if (whatsapp.status === "CONNECTED") {
    return res.status(409).json({ error: "ERR_PAIRING_ALREADY_CONNECTED" });
  }
  if (isPairingInProgress(whatsapp.id)) {
    return res.status(409).json({ error: "ERR_PAIRING_IN_PROGRESS" });
  }
  markWatching(whatsapp.id);
  setTypedNumber(whatsapp.id, number);
  const payload = await requestPairingCodeForSession(whatsapp, number);
  return res.status(200).json(payload);
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const idNumber = Number(whatsappId);
  const whatsapp = await ShowWhatsAppService(whatsappId);
  if (!canAccessWhatsapp(req.user, whatsapp)) {
    return res.status(403).json({ error: "ERR_NO_PERMISSION" });
  }

  try {
    await whatsappProvider.logout(whatsapp.id);
  } catch (err) {
    try {
      await whatsappProvider.removeSession(idNumber);
    } catch {}
  }

  // Limpa todas as chaves no banco e redis
  await ClearWppSessionKeys(idNumber);

  await whatsapp.update({
    status: "DISCONNECTED",
    session: "",
    qrcode: "",
    retries: 0
  });

  const io = getIO();
  io.emit("whatsappSession", {
    action: "update",
    session: whatsapp
  });

  return res.status(200).json({ message: "Session disconnected." });
};

const startAll = async (req: Request, res: Response): Promise<Response> => {
  StartAllWhatsAppsSessions().catch(() => {});
  return res.status(200).json({ message: "Iniciando reconexão de todas as sessões." });
};

export default { store, remove, update, showPairingCode, requestPairingCode, startAll };
