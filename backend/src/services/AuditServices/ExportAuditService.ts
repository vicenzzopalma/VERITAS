import { Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  whatsappId?: string | number;
  ticketId?: string | number;
  search?: string;
  startDate?: string;
  endDate?: string;
  onlyDeleted?: string | boolean;
  mediaType?: string;
  format?: "csv" | "txt" | "json";
}

interface ExportResult {
  filename: string;
  contentType: string;
  data: string;
}

const ExportAuditService = async ({
  whatsappId,
  ticketId,
  search = "",
  startDate,
  endDate,
  onlyDeleted,
  mediaType,
  format = "csv"
}: Request): Promise<ExportResult> => {
  const whereConditions: any = {};
  const ticketWhereConditions: any = {};

  if (ticketId) {
    whereConditions.ticketId = Number(ticketId);
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

  if (startDate || endDate) {
    const dateFilter: any = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      dateFilter[Op.gte] = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter[Op.lte] = end;
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
      }
    ],
    order: [["createdAt", "ASC"]],
    limit: 10000
  });

  const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
  let targetDeviceName = "Geral";
  let targetContactName = "Todas as Conversas";

  if (messages.length > 0 && messages[0].ticket) {
    if (messages[0].ticket.whatsapp) {
      targetDeviceName = messages[0].ticket.whatsapp.name || `WhatsApp-${messages[0].ticket.whatsapp.id}`;
    }
    if (messages[0].ticket.contact) {
      targetContactName = `${messages[0].ticket.contact.name} (${messages[0].ticket.contact.number})`;
    }
  }

  if (format === "json") {
    return {
      filename: `laudo-auditoria-${targetDeviceName}-${timestampStr}.json`,
      contentType: "application/json",
      data: JSON.stringify(
        {
          reportTitle: "Laudo de Auditoria e Histórico WhatsApp",
          generatedAt: new Date().toISOString(),
          device: targetDeviceName,
          contact: targetContactName,
          totalMessages: messages.length,
          deletedCount: messages.filter((m) => m.isDeleted).length,
          messages: messages.map((m) => ({
            id: m.id,
            timestamp: m.createdAt,
            fromMe: m.fromMe,
            sender: m.fromMe ? "Operador" : m.contact?.name || "Cliente",
            contactNumber: m.contact?.number || m.ticket?.contact?.number || "",
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

  if (format === "txt") {
    let txt = "========================================================================================\r\n";
    txt += "       LAUDO PERICIAL DE AUDITORIA & HISTÓRICO PERPÉTUO DE WHATSAPP\r\n";
    txt += "========================================================================================\r\n";
    txt += `Aparelho Auditado: ${targetDeviceName}\r\n`;
    txt += `Interlocutor / Contato: ${targetContactName}\r\n`;
    txt += `Data da Geração: ${new Date().toLocaleString("pt-BR")}\r\n`;
    txt += `Total de Mensagens no Laudo: ${messages.length}\r\n`;
    txt += `Mensagens Apagadas Recuperadas (Anti-Delete): ${messages.filter((m) => m.isDeleted).length}\r\n`;
    txt += "========================================================================================\r\n\r\n";

    messages.forEach((m, idx) => {
      const dateFormatted = new Date(m.createdAt).toLocaleString("pt-BR");
      const sender = m.fromMe ? "OPERADOR" : `CLIENTE (${m.contact?.name || m.ticket?.contact?.name || "Contato"})`;
      const statusBadge = m.isDeleted ? " [🚫 MENSAGEM APAGADA NO WHATSAPP]" : "";
      const mediaInfo = m.mediaUrl ? ` [MÍDIA: ${m.mediaType || "arquivo"}]` : "";

      txt += `[#${idx + 1}] [${dateFormatted}] [${sender}]${statusBadge}${mediaInfo}\r\n`;
      txt += `Conteúdo: ${m.body || "(sem texto)"}\r\n`;
      if (m.mediaUrl) {
        txt += `URL do Arquivo: ${m.mediaUrl}\r\n`;
      }
      txt += "----------------------------------------------------------------------------------------\r\n";
    });

    return {
      filename: `laudo-auditoria-${targetDeviceName}-${timestampStr}.txt`,
      contentType: "text/plain; charset=utf-8",
      data: txt
    };
  }

  // Padrão: CSV
  let csv = "\uFEFF"; // UTF-8 BOM
  csv += "ID;Data e Hora;Remetente;Nome Contato;Telefone;Status Auditoria;Tipo Midia;Conteudo Mensagem;URL Midia\r\n";

  messages.forEach((m) => {
    const id = m.id;
    const dateFormatted = new Date(m.createdAt).toLocaleString("pt-BR");
    const sender = m.fromMe ? "Operador" : "Cliente";
    const contactName = (m.contact?.name || m.ticket?.contact?.name || "").replace(/;/g, ",");
    const contactNumber = m.contact?.number || m.ticket?.contact?.number || "";
    const auditStatus = m.isDeleted ? "APAGADA NO WHATSAPP" : "NORMAL";
    const mediaTypeVal = m.mediaType || "texto";
    const bodyClean = (m.body || "").replace(/[\r\n]+/g, " ").replace(/;/g, ",");
    const mediaUrlVal = m.mediaUrl || "";

    csv += `"${id}";"${dateFormatted}";"${sender}";"${contactName}";"${contactNumber}";"${auditStatus}";"${mediaTypeVal}";"${bodyClean}";"${mediaUrlVal}"\r\n`;
  });

  return {
    filename: `auditoria-whatsapp-${targetDeviceName}-${timestampStr}.csv`,
    contentType: "text/csv; charset=utf-8",
    data: csv
  };
};

export default ExportAuditService;
