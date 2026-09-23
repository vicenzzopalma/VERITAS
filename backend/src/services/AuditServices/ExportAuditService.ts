import { Op } from "sequelize";
import fs from "fs";
import path from "path";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import uploadConfig from "../../config/upload";

interface Request {
  whatsappId?: string | number;
  ticketId?: string | number;
  contactId?: string | number;
  contactNumber?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  onlyDeleted?: string | boolean;
  mediaType?: string;
  format?: "csv" | "txt" | "json" | "html" | "pdf";
  imageLimit?: string | number;
  part?: string | number;
}

interface ExportResult {
  filename: string;
  contentType: string;
  data: string;
}

const getBase64Image = (rawUrl: string | null): string | null => {
  if (!rawUrl) return null;
  try {
    const cleanName = path.basename(rawUrl);
    const localFilePath = path.join(uploadConfig.directory, cleanName);
    if (fs.existsSync(localFilePath)) {
      const ext = path.extname(cleanName).toLowerCase().replace(".", "");
      let mime = "image/jpeg";
      if (ext === "png") mime = "image/png";
      else if (ext === "webp") mime = "image/webp";
      else if (ext === "gif") mime = "image/gif";
      const buffer = fs.readFileSync(localFilePath);
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
  } catch (err) {
    console.error("Erro ao converter imagem em base64:", err);
  }
  return rawUrl;
};

const formatBrDate = (dateVal: Date | string): string => {
  try {
    const d = new Date(dateVal);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return String(dateVal);
  }
};

const formatDateOnly = (dateVal: Date | string): string => {
  try {
    const d = new Date(dateVal);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
};

const formatDateTime = (dateVal: Date | string): string => {
  try {
    const d = new Date(dateVal);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return "";
  }
};

let cachedWaBg: string | null = null;
const getWaBackgroundBase64 = (): string => {
  if (cachedWaBg !== null) return cachedWaBg;
  try {
    const candidatePaths = [
      path.resolve("d:/VERITAS/frontend/src/assets/wa-background.png"),
      path.resolve("D:/VERITAS/frontend/src/assets/wa-background.png"),
      path.resolve(process.cwd(), "frontend", "src", "assets", "wa-background.png"),
      path.resolve(process.cwd(), "..", "frontend", "src", "assets", "wa-background.png"),
      path.resolve(__dirname, "..", "..", "..", "..", "frontend", "src", "assets", "wa-background.png")
    ];

    for (const bgPath of candidatePaths) {
      if (fs.existsSync(bgPath)) {
        const buffer = fs.readFileSync(bgPath);
        cachedWaBg = `data:image/png;base64,${buffer.toString("base64")}`;
        return cachedWaBg;
      }
    }
  } catch (e) {
    console.error("Erro ao carregar wa-background.png:", e);
  }
  cachedWaBg = "";
  return cachedWaBg;
};

const ExportAuditService = async ({
  whatsappId,
  ticketId,
  contactId,
  contactNumber,
  search = "",
  startDate,
  endDate,
  onlyDeleted,
  mediaType,
  format = "html",
  imageLimit = 50,
  part = 1
}: Request): Promise<ExportResult> => {
  const whereConditions: any = {};
  const ticketWhereConditions: any = {};

  if (ticketId) {
    const currentTicket = await Ticket.findByPk(Number(ticketId));
    if (currentTicket) {
      if (!whatsappId) {
        ticketWhereConditions.whatsappId = currentTicket.whatsappId;
      }
      if (!contactId && !contactNumber) {
        ticketWhereConditions.contactId = currentTicket.contactId;
      }
    } else {
      whereConditions.ticketId = Number(ticketId);
    }
  }

  if (contactId) {
    ticketWhereConditions.contactId = Number(contactId);
  } else if (contactNumber) {
    const cleanNum = contactNumber.replace(/\D/g, "");
    const foundContact = await Contact.findOne({
      where: {
        number: { [Op.like]: `%${cleanNum}%` }
      }
    });
    if (foundContact) {
      ticketWhereConditions.contactId = foundContact.id;
    }
  }

  if (whatsappId) {
    ticketWhereConditions.whatsappId = Number(whatsappId);
  }

  if (onlyDeleted === true || onlyDeleted === "true") {
    whereConditions.isDeleted = true;
  }

  if (search && search.trim()) {
    whereConditions.body = {
      [Op.like]: `%${search.trim()}%`
    };
  }

  const parseDateFilter = (val: string, isEnd: boolean): Date => {
    if (val.length === 10 && val.includes("-")) {
      const [y, m, d] = val.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      if (isEnd) {
        date.setHours(23, 59, 59, 999);
      } else {
        date.setHours(0, 0, 0, 0);
      }
      return date;
    }
    const date = new Date(val);
    if (isEnd && !val.includes("T")) {
      date.setHours(23, 59, 59, 999);
    }
    return date;
  };

  const formatPeriodDate = (val: string): string => {
    if (val.length === 10 && val.includes("-")) {
      const [y, m, d] = val.split("-");
      return `${d}/${m}/${y}`;
    }
    try {
      return new Date(val).toLocaleDateString("pt-BR");
    } catch {
      return val;
    }
  };

  if (startDate || endDate) {
    const dateFilter: any = {};
    if (startDate) {
      dateFilter[Op.gte] = parseDateFilter(startDate, false);
    }
    if (endDate) {
      dateFilter[Op.lte] = parseDateFilter(endDate, true);
    }
    whereConditions.createdAt = dateFilter;
  }

  if (mediaType && mediaType !== "all") {
    if (mediaType === "audio") {
      whereConditions[Op.or] = [
        { mediaType: { [Op.like]: "%audio%" } },
        { mediaType: "voice" },
        { mediaType: "ptt" }
      ];
    } else if (mediaType === "image") {
      whereConditions[Op.or] = [{ mediaType: { [Op.like]: "%image%" } }];
    } else if (mediaType === "video") {
      whereConditions[Op.or] = [{ mediaType: { [Op.like]: "%video%" } }];
    } else if (mediaType === "document") {
      whereConditions[Op.or] = [
        { mediaType: { [Op.like]: "%document%" } },
        { mediaType: { [Op.like]: "%pdf%" } }
      ];
    } else if (mediaType === "vcard") {
      whereConditions.mediaType = "vcard";
    }
  }

  const messages = await Message.findAll({
    where: whereConditions,
    include: [
      {
        model: Contact,
        as: "contact"
      },
      {
        model: Ticket,
        as: "ticket",
        where: Object.keys(ticketWhereConditions).length > 0 ? ticketWhereConditions : undefined,
        required: Object.keys(ticketWhereConditions).length > 0,
        include: [
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["id", "name"]
          },
          {
            model: Contact,
            as: "contact"
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: [
          {
            model: Contact,
            as: "contact"
          }
        ]
      }
    ],
    order: [["createdAt", "ASC"]],
    limit: 50000
  });

  const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
  let targetDeviceName = "Todos os Aparelhos";
  let targetContactName = "Todas as Conversas";
  let targetContactNumber = "";
  let targetProfilePicUrl = "";
  let targetProfilePicBase64 = "";

  if (messages.length > 0 && messages[0].ticket) {
    if (messages[0].ticket.whatsapp) {
      targetDeviceName = messages[0].ticket.whatsapp.name || `WhatsApp-${messages[0].ticket.whatsapp.id}`;
    }
    if (messages[0].ticket.contact) {
      targetContactName = messages[0].ticket.contact.name || messages[0].ticket.contact.number || "Sem Nome";
      targetContactNumber = messages[0].ticket.contact.number || "";
      targetProfilePicUrl = messages[0].ticket.contact.profilePicUrl || "";
    }
  } else {
    if (whatsappId) {
      const w = await Whatsapp.findByPk(Number(whatsappId));
      if (w) targetDeviceName = w.name;
    }
    if (ticketWhereConditions.contactId) {
      const c = await Contact.findByPk(Number(ticketWhereConditions.contactId));
      if (c) {
        targetContactName = c.name || c.number;
        targetContactNumber = c.number;
        targetProfilePicUrl = c.profilePicUrl || "";
      }
    }
  }

  if (targetProfilePicUrl) {
    try {
      targetProfilePicBase64 = getBase64Image(targetProfilePicUrl);
    } catch {
      targetProfilePicBase64 = targetProfilePicUrl;
    }
  }

  let periodLabel = "Histórico Completo";
  if (startDate && endDate) {
    periodLabel = `${formatPeriodDate(startDate)} até ${formatPeriodDate(endDate)}`;
  } else if (startDate) {
    periodLabel = `A partir de ${formatPeriodDate(startDate)}`;
  } else if (endDate) {
    periodLabel = `Até ${formatPeriodDate(endDate)}`;
  }

  const isImageMsg = (m: Message): boolean => {
    return Boolean(
      (m.mediaType && m.mediaType.includes("image")) ||
      (m.mediaUrl && /\.(jpe?g|png|webp|gif)$/i.test(m.mediaUrl))
    );
  };

  const imageMessageIndices: number[] = [];
  messages.forEach((m, idx) => {
    if (isImageMsg(m)) {
      imageMessageIndices.push(idx);
    }
  });

  const totalImages = imageMessageIndices.length;
  let parsedLimit = 0;
  if (imageLimit && imageLimit !== "all" && imageLimit !== "0") {
    parsedLimit = Math.max(1, Number(imageLimit));
  }

  let totalParts = 1;
  let currentPart = Math.max(1, Number(part || 1));

  if (parsedLimit > 0 && totalImages > parsedLimit) {
    totalParts = Math.ceil(totalImages / parsedLimit);
    if (currentPart > totalParts) {
      currentPart = totalParts;
    }
  }

  let startMsgIdx = 0;
  let endMsgIdx = messages.length > 0 ? messages.length - 1 : 0;

  if (parsedLimit > 0 && totalParts > 1) {
    const imgStart = (currentPart - 1) * parsedLimit;
    const imgEnd = Math.min(totalImages - 1, currentPart * parsedLimit - 1);

    if (currentPart > 1) {
      startMsgIdx = imageMessageIndices[imgStart];
    } else {
      startMsgIdx = 0;
    }

    if (currentPart < totalParts) {
      const nextImgIdx = imageMessageIndices[imgEnd + 1];
      endMsgIdx = nextImgIdx - 1;
    } else {
      endMsgIdx = messages.length - 1;
    }
  }

  const partMessages = messages.length > 0 ? messages.slice(startMsgIdx, endMsgIdx + 1) : [];
  const partImagesCount = partMessages.filter(isImageMsg).length;
  const partDeletedCount = partMessages.filter((m) => m.isDeleted).length;

  const safeDeviceName = targetDeviceName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeContactNumber = (targetContactNumber || targetContactName).replace(/[^a-zA-Z0-9_-]/g, "_");

  // FORMATO 1: JSON
  if (format === "json") {
    return {
      filename: `laudo-auditoria-${safeDeviceName}-${safeContactNumber}-${timestampStr}.json`,
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify(
        {
          reportTitle: "Laudo Forense de Auditoria WhatsApp",
          device: targetDeviceName,
          contact: `${targetContactName} (${targetContactNumber})`,
          period: periodLabel,
          generatedAt: new Date().toISOString(),
          part: currentPart,
          totalParts,
          imageLimit: parsedLimit || "Todas",
          totalMessagesInPeriod: messages.length,
          messagesInThisPart: partMessages.length,
          imagesInThisPart: partImagesCount,
          totalImagesInPeriod: totalImages,
          deletedMessagesCount: partDeletedCount,
          messages: partMessages.map((m) => ({
            id: m.id,
            timestamp: m.createdAt,
            fromMe: m.fromMe,
            sender: m.fromMe ? `📱 ${targetDeviceName}` : m.contact?.name || targetContactName,
            contactNumber: m.contact?.number || targetContactNumber,
            status: m.isDeleted ? "DELETADA_NO_WHATSAPP" : "NORMAL",
            mediaType: m.mediaType || "text",
            mediaUrl: m.mediaUrl || null,
            body: m.body
          }))
        },
        null,
        2
      )
    };
  }

  // FORMATO 2: TXT
  if (format === "txt") {
    let txt = "========================================================================================\r\n";
    txt += "       LAUDO PERICIAL DE AUDITORIA & HISTÓRICO DE WHATSAPP (PADRÃO FORENSE)\r\n";
    txt += "========================================================================================\r\n";
    txt += `Aparelho Auditado: ${targetDeviceName}\r\n`;
    txt += `Interlocutor / Contato: ${targetContactName} (${targetContactNumber})\r\n`;
    txt += `Período Auditado: ${periodLabel}\r\n`;
    txt += `Data da Emissão: ${new Date().toLocaleString("pt-BR")}\r\n`;
    txt += `Parte Atual: ${currentPart} de ${totalParts} (Fotos nesta parte: ${partImagesCount} de ${totalImages})\r\n`;
    txt += `Total de Mensagens no Laudo: ${partMessages.length} (de ${messages.length} no período)\r\n`;
    txt += `Mensagens Apagadas Recuperadas (Anti-Delete): ${partDeletedCount}\r\n`;
    txt += "========================================================================================\r\n\r\n";

    partMessages.forEach((m, idx) => {
      const dateFormatted = formatBrDate(m.createdAt);
      const sender = m.fromMe ? `OPERADOR (📱 ${targetDeviceName})` : `CLIENTE (${m.contact?.name || targetContactName})`;
      const statusBadge = m.isDeleted ? " [🚫 MENSAGEM APAGADA NO WHATSAPP]" : "";
      const mediaInfo = m.mediaUrl ? ` [MÍDIA: ${m.mediaType || "arquivo"}]` : "";

      txt += `[#${idx + 1}] [${dateFormatted}] [${sender}]${statusBadge}${mediaInfo}\r\n`;
      if (m.quotedMsg) {
        const quotedSender = m.quotedMsg.fromMe ? `📱 ${targetDeviceName}` : (m.quotedMsg.contact?.name || "Participante");
        txt += `   >> Em resposta a [${quotedSender}]: "${(m.quotedMsg.body || "").replace(/[\r\n]+/g, " ")}"\r\n`;
      }
      txt += `Conteúdo: ${m.body || "(sem texto)"}\r\n`;
      if (m.mediaUrl) {
        txt += `Arquivo/Mídia: ${m.mediaUrl}\r\n`;
      }
      txt += "----------------------------------------------------------------------------------------\r\n";
    });

    return {
      filename: `laudo-auditoria-${safeDeviceName}-${safeContactNumber}-P${currentPart}-${timestampStr}.txt`,
      contentType: "text/plain; charset=utf-8",
      data: txt
    };
  }

  // FORMATO 3: CSV
  if (format === "csv") {
    let csv = "\uFEFF";
    csv += "ID;Data e Hora;Remetente;Nome Contato;Telefone;Status Auditoria;Tipo Midia;Conteudo Mensagem;URL Midia\r\n";

    partMessages.forEach((m) => {
      const id = m.id;
      const dateFormatted = formatBrDate(m.createdAt);
      const sender = m.fromMe ? `📱 ${targetDeviceName}` : (m.contact?.name || targetContactName);
      const contactName = (m.contact?.name || targetContactName).replace(/;/g, ",");
      const contactNum = m.contact?.number || targetContactNumber;
      const auditStatus = m.isDeleted ? "APAGADA NO WHATSAPP" : "NORMAL";
      const mediaTypeVal = m.mediaType || "texto";
      const bodyClean = (m.body || "").replace(/[\r\n]+/g, " ").replace(/;/g, ",");
      const mediaUrlVal = m.mediaUrl || "";

      csv += `"${id}";"${dateFormatted}";"${sender}";"${contactName}";"${contactNum}";"${auditStatus}";"${mediaTypeVal}";"${bodyClean}";"${mediaUrlVal}"\r\n`;
    });

    return {
      filename: `auditoria-${safeDeviceName}-${safeContactNumber}-P${currentPart}-${timestampStr}.csv`,
      contentType: "text/csv; charset=utf-8",
      data: csv
    };
  }

  // FORMATO 4: LAUDO VISUAL 100% IDÊNTICO AO CHAT DA AUDITORIA
  let partNavigationHtml = "";
  if (totalParts > 1) {
    partNavigationHtml += `<div class="part-nav no-print">`;
    partNavigationHtml += `<span class="part-nav-title">📁 Laudo dividido por limite de imagens (${parsedLimit} fotos/parte):</span>`;
    for (let p = 1; p <= totalParts; p++) {
      const isCurrent = p === currentPart;
      const partQuery = `whatsappId=${whatsappId || ""}&ticketId=${ticketId || ""}&contactId=${contactId || ""}&contactNumber=${contactNumber || ""}&startDate=${startDate || ""}&endDate=${endDate || ""}&onlyDeleted=${onlyDeleted || ""}&mediaType=${mediaType || ""}&imageLimit=${imageLimit}&format=html&part=${p}`;
      partNavigationHtml += `
        <a href="?${partQuery}" class="part-badge ${isCurrent ? "part-badge-active" : ""}">
          Parte ${p} ${isCurrent ? "(Atual)" : ""}
        </a>
      `;
    }
    partNavigationHtml += `</div>`;
  }

  let messagesHtml = "";
  let lastDateSeparator = "";

  if (partMessages.length === 0) {
    messagesHtml = `
      <div class="empty-state">
        <div style="font-size: 40px; margin-bottom: 8px;">📭</div>
        <h3 style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">Nenhum registro encontrado para os filtros selecionados</h3>
        <p>Aparelho: <strong>${targetDeviceName}</strong> | Contato: <strong>${targetContactName} (${targetContactNumber})</strong></p>
        <p>Período: <strong>${periodLabel}</strong></p>
      </div>
    `;
  } else {
    partMessages.forEach((m) => {
      const currentDate = formatDateOnly(m.createdAt);
      if (currentDate && currentDate !== lastDateSeparator) {
        messagesHtml += `
          <div class="dailyTimestampContainer">
            <span class="dailyTimestampBadge">${currentDate}</span>
          </div>
        `;
        lastDateSeparator = currentDate;
      }

      const isOp = m.fromMe;
      const isGroup = Boolean(m.ticket?.contact?.isGroup);
      const senderName = isOp
        ? `📱 ${targetDeviceName}`
        : (m.contact?.name || targetContactName);

      // Banner de Mensagem Apagada
      let deletedBannerHtml = "";
      if (m.isDeleted) {
        deletedBannerHtml = `
          <div class="deletedBanner">
            <span style="font-size: 14px;">🚫</span>
            <span>MENSAGEM APAGADA NO WHATSAPP</span>
          </div>
        `;
      }

      // Mensagem Respondida (Quoted)
      let quotedHtml = "";
      if (m.quotedMsg) {
        const quotedSender = m.quotedMsg.fromMe
          ? `📱 ${targetDeviceName}`
          : (m.quotedMsg.contact?.name || "Participante");
        const quotedText = (m.quotedMsg.body || "Mídia / Arquivo").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        quotedHtml = `
          <div class="quotedMsgBox">
            <div class="quotedSender">${quotedSender}</div>
            <div class="quotedBody">${quotedText}</div>
          </div>
        `;
      }

      // Mídias
      let mediaHtml = "";
      const isImg = isImageMsg(m);
      if (isImg && m.mediaUrl) {
        const base64Img = getBase64Image(m.mediaUrl);
        mediaHtml = `
          <div class="mediaContainer">
            <img src="${base64Img}" alt="Foto" class="mediaPreview" />
          </div>
        `;
      } else if (m.mediaUrl && (m.mediaType?.includes("audio") || m.mediaType === "voice" || m.mediaType === "ptt")) {
        mediaHtml = `
          <div style="margin: 4px 0;">
            <audio controls class="audioPlayer">
              <source src="${m.mediaUrl}" type="audio/ogg" />
              <source src="${m.mediaUrl}" type="audio/mp4" />
              <source src="${m.mediaUrl}" type="audio/mpeg" />
              Áudio não suportado
            </audio>
          </div>
        `;
      } else if (m.mediaUrl && (m.mediaType?.includes("document") || m.mediaUrl.match(/\.(pdf|doc|docx|xlsx|zip)$/i))) {
        const isPdf = m.mediaUrl.toLowerCase().includes(".pdf");
        const docTitle = m.body && m.body !== m.mediaUrl ? m.body : path.basename(m.mediaUrl);
        if (isPdf) {
          mediaHtml = `
            <div class="pdfCard">
              <div class="pdfCardHeader">
                <span class="pdfIcon">📄</span>
                <div style="overflow: hidden; flex-grow: 1;">
                  <div class="pdfTitle">${docTitle}</div>
                  <div class="pdfSubtitle">Documento PDF</div>
                </div>
              </div>
            </div>
          `;
        } else {
          mediaHtml = `
            <div class="docButton">
              <span>📎</span>
              <span>${docTitle}</span>
            </div>
          `;
        }
      }

      // Texto Principal
      let bodyHtml = "";
      if (!m.mediaUrl || m.mediaType === "chat" || (m.body && !m.body.includes(".pdf") && !m.body.includes(".ogg"))) {
        const formattedBody = (m.body || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
        if (formattedBody) {
          bodyHtml = `<div class="messageText">${formattedBody}</div>`;
        }
      }

      const formattedTime = formatDateTime(m.createdAt);

      messagesHtml += `
        <div class="messageBubble ${isOp ? "messageOperator" : "messageClient"}">
          ${isGroup ? `<div class="senderHeader" style="color: ${isOp ? "#0284c7" : "#059669"};">${senderName}</div>` : ""}
          ${deletedBannerHtml}
          ${quotedHtml}
          ${mediaHtml}
          ${bodyHtml}
          <div class="metaFooter">
            <span>${formattedTime}</span>
            ${isOp ? `<span class="checkMark">✓✓</span>` : ""}
          </div>
        </div>
      `;
    });
  }

  const waBgDataUri = getWaBackgroundBase64();

  const htmlData = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${targetContactName} (${targetContactNumber}) • ${targetDeviceName} • VERITAS</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: #efeae2 !important;
      ${waBgDataUri ? `background-image: url("${waBgDataUri}");` : ""}
      background-repeat: repeat;
      color: #111827;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* BARRA SUPERIOR DE AÇÕES (NÃO SAI NA IMPRESSÃO) */
    .top-action-bar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0284c7;
      box-shadow: 0 4px 12px rgba(0,0,0,0.22);
    }

    .top-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .top-brand-icon {
      font-size: 24px;
    }

    .top-brand-title {
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #38bdf8;
    }

    .top-brand-sub {
      font-size: 11px;
      color: #94a3b8;
    }

    .top-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .btn-action {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      text-decoration: none;
    }

    .btn-action:hover {
      background: #0369a1;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: #334155;
      color: #e2e8f0;
    }

    .btn-secondary:hover {
      background: #475569;
    }

    /* JANELA PRINCIPAL DO CHAT WHATSAPP NO VERITAS */
    .whatsapp-chat-window {
      max-width: 860px;
      margin: 16px auto 32px auto;
      background-color: #efeae2;
      ${waBgDataUri ? `background-image: url("${waBgDataUri}");` : ""}
      background-repeat: repeat;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      border: 1px solid #cbd5e1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* CABEÇALHO IDÊNTICO AO WHATSAPP NO VERITAS */
    .whatsapp-chat-header {
      background-color: #ffffff;
      padding: 12px 18px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
    }

    .header-avatar {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid #52658C;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }

    .header-avatar-placeholder {
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background-color: #52658C;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      font-weight: 700;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }

    .header-info {
      overflow: hidden;
    }

    .header-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-sub {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      flex-wrap: wrap;
    }

    .header-chip {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 12px;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .chip-count {
      background-color: #e0f2fe;
      color: #0369a1;
    }

    .chip-period {
      background-color: #f1f5f9;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .chip-part {
      background-color: #fef3c7;
      color: #b45309;
    }

    /* BARRA DE NAVEGAÇÃO DE PARTES */
    .part-nav {
      background: #f8fafc;
      padding: 8px 18px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .part-nav-title {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }

    .part-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11.5px;
      font-weight: 700;
      text-decoration: none;
      background: #e2e8f0;
      color: #334155;
    }

    .part-badge-active {
      background: #0284c7 !important;
      color: #ffffff !important;
    }

    /* CORPO DO CHAT (MENSAGENS) */
    .chat-body {
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background-color: #efeae2;
      ${waBgDataUri ? `background-image: url("${waBgDataUri}");` : ""}
      background-repeat: repeat;
      min-height: 500px;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* SEPARADOR DE DIA IDÊNTICO AO AUDITORIA */
    .dailyTimestampContainer {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 12px 0 8px 0;
      width: 100%;
    }

    .dailyTimestampBadge {
      background-color: rgba(17, 27, 33, 0.88) !important;
      color: #e9edef !important;
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 0.74rem;
      font-weight: 600;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3);
      display: inline-block;
      text-align: center;
      letter-spacing: 0.3px;
      user-select: none;
      border: none !important;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* BALÃO DE MENSAGEM IDÊNTICO AO AUDITORIA */
    .messageBubble {
      max-width: 68%;
      min-width: 140px;
      padding: 7px 11px 5px 11px;
      border-radius: 7.5px;
      box-shadow: 0 1px 1px rgba(11,20,26,0.13);
      position: relative;
      word-break: break-word;
      font-size: 0.88rem;
      line-height: 1.4;
      border: none !important;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    .messageOperator {
      align-self: flex-end;
      background-color: #dcf8c6 !important;
      color: #111827;
      border-top-right-radius: 0;
    }

    .messageClient {
      align-self: flex-start;
      background-color: #ffffff !important;
      color: #111827;
      border-top-left-radius: 0;
    }

    .senderHeader {
      font-weight: 700;
      font-size: 0.76rem;
      margin-bottom: 3px;
    }

    .messageText {
      font-size: 0.88rem;
      line-height: 1.38;
      color: #111827;
    }

    /* BANNER DE MENSAGEM APAGADA IDÊNTICO AO AUDITORIA */
    .deletedBanner {
      background-color: #fef2f2 !important;
      border: 1px solid #f87171 !important;
      color: #b91c1c !important;
      padding: 3px 7px;
      border-radius: 5px;
      font-size: 0.74rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 5px;
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
    }

    /* MENSAGEM CITADA (QUOTED) IDÊNTICO AO AUDITORIA */
    .quotedMsgBox {
      background-color: rgba(0,0,0,0.05);
      border-left: 3px solid #0284c7;
      border-radius: 4px;
      padding: 3px 7px;
      margin-bottom: 5px;
      font-size: 0.78rem;
      color: #475569;
    }

    .quotedSender {
      font-weight: 700;
      color: #0284c7;
      margin-bottom: 1px;
    }

    .quotedBody {
      white-space: pre-wrap;
    }

    /* IMAGENS IDÊNTICO AO AUDITORIA */
    .mediaContainer {
      margin-top: 4px;
      margin-bottom: 4px;
    }

    .mediaPreview {
      max-width: 100%;
      max-height: 260px;
      border-radius: 5px;
      object-fit: cover;
      display: block;
    }

    /* ÁUDIO & DOCUMENTOS */
    .audioPlayer {
      width: 100%;
      max-width: 280px;
      height: 38px;
    }

    .pdfCard {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 6px;
      margin-bottom: 6px;
      max-width: 320px;
      width: 100%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    .pdfCardHeader {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: #ffffff;
      border-bottom: 1px solid #e2e8f0;
    }

    .pdfIcon {
      color: #ef4444;
      font-size: 24px;
      margin-right: 8px;
    }

    .pdfTitle {
      font-weight: 600;
      font-size: 0.82rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #0f172a;
    }

    .pdfSubtitle {
      font-size: 0.72rem;
      color: #64748b;
    }

    .docButton {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #e2e8f0;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #1e293b;
      margin-top: 4px;
      text-decoration: none;
    }

    /* RODAPÉ DO BALÃO (HORA E CHECKMARK) */
    .metaFooter {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 4px;
      font-size: 0.68rem;
      color: #64748b;
      user-select: none;
    }

    .checkMark {
      color: #38bdf8;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: -1.5px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      background: #ffffff;
      border-radius: 8px;
      color: #64748b;
    }

    /* ESTILOS DE IMPRESSÃO (CTRL+P / SALVAR COMO PDF A4) */
    @media print {
      .no-print {
        display: none !important;
      }

      html, body {
        background-color: #efeae2 !important;
        ${waBgDataUri ? `background-image: url("${waBgDataUri}") !important;` : ""}
        background-repeat: repeat !important;
        color: #111827 !important;
        margin: 0 !important;
        padding: 0 !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }

      .whatsapp-chat-window {
        max-width: 100% !important;
        margin: 0 !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background-color: #efeae2 !important;
        ${waBgDataUri ? `background-image: url("${waBgDataUri}") !important;` : ""}
        background-repeat: repeat !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }

      .whatsapp-chat-header {
        background-color: #ffffff !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
        padding: 10px 14px !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }

      .chat-body {
        background-color: #efeae2 !important;
        ${waBgDataUri ? `background-image: url("${waBgDataUri}") !important;` : ""}
        background-repeat: repeat !important;
        padding: 10px 14px !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }

      .messageBubble {
        box-shadow: 0 1px 0.5px rgba(11,20,26,0.13) !important;
        border: none !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      .messageOperator {
        background-color: #dcf8c6 !important;
        border: none !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }

      .messageClient {
        background-color: #ffffff !important;
        border: none !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }

      .dailyTimestampBadge {
        background-color: rgba(17, 27, 33, 0.88) !important;
        color: #e9edef !important;
        border: none !important;
        print-color-adjust: exact !important;
        -webkit-print-color-adjust: exact !important;
      }

      .mediaPreview {
        max-height: 240px !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }

      @page {
        margin: 6mm 8mm;
        size: A4 portrait;
      }
    }
  </style>
</head>
<body>

  <!-- BARRA DE AÇÕES SUPERIOR -->
  <div class="top-action-bar no-print">
    <div class="top-brand">
      <span class="top-brand-icon">🛡️</span>
      <div>
        <div class="top-brand-title">VERITAS • CONVERSA DO WHATSAPP</div>
        <div class="top-brand-sub">${targetContactName} (${targetContactNumber || "Sem Telefone"}) • ${targetDeviceName}</div>
      </div>
    </div>
    <div class="top-actions">
      <button id="btnPrint" class="btn-action" type="button" onclick="triggerPrint()">
        🖨️ Imprimir / Salvar em PDF (A4)
      </button>
      <button id="btnDownload" class="btn-action btn-secondary" type="button" onclick="downloadCurrentHtml()">
        ⬇️ Baixar HTML
      </button>
    </div>
  </div>

  <div class="whatsapp-chat-window">
    <!-- CABEÇALHO IDÊNTICO AO WHATSAPP NO VERITAS -->
    <div class="whatsapp-chat-header">
      <div class="header-left">
        ${targetProfilePicBase64 ? `
          <img src="${targetProfilePicBase64}" alt="${targetContactName}" class="header-avatar" />
        ` : `
          <div class="header-avatar-placeholder">
            ${(targetContactName || targetContactNumber || "C").charAt(0).toUpperCase()}
          </div>
        `}
        <div class="header-info">
          <div class="header-name">${targetContactName}</div>
          <div class="header-sub">
            <span>📱 <strong>${targetDeviceName}</strong></span>
            ${targetContactNumber && targetContactNumber !== targetContactName ? `<span>• ${targetContactNumber}</span>` : ""}
          </div>
        </div>
      </div>

      <div class="header-right">
        <span class="header-chip chip-count">${partMessages.length} mensagens</span>
        ${periodLabel ? `<span class="header-chip chip-period">📅 ${periodLabel}</span>` : ""}
        ${totalParts > 1 ? `<span class="header-chip chip-part">Parte ${currentPart} de ${totalParts}</span>` : ""}
      </div>
    </div>

    <!-- SELETOR DE PARTES POR LIMITE DE IMAGEM -->
    ${partNavigationHtml}

    <!-- CORPO DO CHAT COM WALLPAPER E BALÕES IDÊNTICOS AO VERITAS -->
    <div class="chat-body">
      ${messagesHtml}
    </div>
  </div>

  <script>
    function triggerPrint() {
      try {
        window.print();
      } catch (err) {
        console.error("Erro ao disparar impressão:", err);
      }
    }

    function downloadCurrentHtml() {
      try {
        var fullHtml = "<!DOCTYPE html>" + String.fromCharCode(10) + document.documentElement.outerHTML;
        var blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "conversa-whatsapp-${safeDeviceName}-${safeContactNumber}-P${currentPart}.html";
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
          a.remove();
          URL.revokeObjectURL(url);
        }, 1000);
      } catch (err) {
        console.error("Erro no download HTML:", err);
      }
    }

    window.triggerPrint = triggerPrint;
    window.downloadCurrentHtml = downloadCurrentHtml;

    function initExportActions() {
      var printBtn = document.getElementById("btnPrint");
      if (printBtn) {
        printBtn.onclick = triggerPrint;
      }
      var dlBtn = document.getElementById("btnDownload");
      if (dlBtn) {
        dlBtn.onclick = downloadCurrentHtml;
      }

      var searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("autoPrint") === "true") {
        setTimeout(triggerPrint, 500);
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initExportActions);
    } else {
      initExportActions();
    }
  </script>
</body>
</html>`;

  return {
    filename: `laudo-auditoria-${safeDeviceName}-${safeContactNumber}-P${currentPart}-${timestampStr}.html`,
    contentType: "text/html; charset=utf-8",
    data: htmlData
  };
};

export default ExportAuditService;
