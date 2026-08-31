import fs from "fs";
import path from "path";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import sequelize from "../../database";

interface WhatsAppStorageStat {
  id: number;
  name: string;
  status: string;
  dbBytes: number;
  mediaBytes: number;
  totalBytes: number;
  dbSizeFormatted: string;
  mediaSizeFormatted: string;
  totalSizeFormatted: string;
  percentage: number;
  messagesCount: number;
  ticketsCount: number;
}

interface StorageStatsResponse {
  database: {
    dialect: string;
    filePath: string;
    fileSizeBytes: number;
    fileSizeFormatted: string;
  };
  media: {
    folderPath: string;
    totalSizeBytes: number;
    totalSizeFormatted: string;
    totalFilesCount: number;
  };
  overview: {
    totalStorageBytes: number;
    totalStorageFormatted: string;
    totalMessages: number;
    totalTickets: number;
    totalContacts: number;
    totalWhatsapps: number;
  };
  usageByNumber: WhatsAppStorageStat[];
}

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return "0.00 MB";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const GetStorageStatsService = async (): Promise<StorageStatsResponse> => {
  // 1. Obter informações físicas do arquivo SQLite
  const dbPath = process.env.DB_STORAGE || path.resolve(__dirname, "..", "..", "..", "whaticket.sqlite");
  let dbFileSize = 0;
  if (fs.existsSync(dbPath)) {
    try {
      dbFileSize = fs.statSync(dbPath).size;
    } catch (err) {
      dbFileSize = 0;
    }
  }

  // 2. Obter informações da pasta public de mídias
  const pubDir = path.resolve(__dirname, "..", "..", "..", "public");
  let mediaDirSize = 0;
  let mediaFilesCount = 0;
  if (fs.existsSync(pubDir)) {
    try {
      const files = fs.readdirSync(pubDir);
      mediaFilesCount = files.length;
      for (const file of files) {
        const filePath = path.join(pubDir, file);
        try {
          const st = fs.statSync(filePath);
          if (st.isFile()) {
            mediaDirSize += st.size;
          }
        } catch {
          // ignore individual file errors
        }
      }
    } catch {
      mediaDirSize = 0;
    }
  }

  // 3. Contadores Globais
  const [totalMessages, totalTickets, totalContacts, totalWhatsapps] = await Promise.all([
    Message.count(),
    Ticket.count(),
    Contact.count(),
    Whatsapp.count()
  ]);

  // 4. Detalhamento por WhatsApp / Número
  const whatsapps = await Whatsapp.findAll({
    attributes: ["id", "name", "status", "session"]
  });

  const statsMap: Record<number, {
    id: number;
    name: string;
    status: string;
    dbBytes: number;
    mediaBytes: number;
    messagesCount: number;
    ticketsCount: number;
  }> = {};

  whatsapps.forEach(w => {
    statsMap[w.id] = {
      id: w.id,
      name: w.name || `WhatsApp ${w.id}`,
      status: w.status,
      dbBytes: (w.session ? Buffer.byteLength(w.session, "utf8") : 0) + 512,
      mediaBytes: 0,
      messagesCount: 0,
      ticketsCount: 0
    };
  });

  // Consultar contagem de tickets por whatsapp
  const [ticketCounts] = await sequelize.query(`
    SELECT whatsappId, COUNT(*) as count FROM Tickets WHERE whatsappId IS NOT NULL GROUP BY whatsappId;
  `);

  if (Array.isArray(ticketCounts)) {
    for (const t of ticketCounts as any[]) {
      const wId = Number(t.whatsappId);
      if (statsMap[wId]) {
        statsMap[wId].ticketsCount = Number(t.count) || 0;
        statsMap[wId].dbBytes += (Number(t.count) || 0) * 256;
      }
    }
  }

  // Consultar mensagens e mídias vinculadas a cada whatsappId
  const [msgMediaRows] = await sequelize.query(`
    SELECT t.whatsappId, m.mediaUrl, LENGTH(m.body) as body_len 
    FROM Messages m 
    JOIN Tickets t ON m.ticketId = t.id
    WHERE t.whatsappId IS NOT NULL;
  `);

  if (Array.isArray(msgMediaRows)) {
    for (const row of msgMediaRows as any[]) {
      const wId = Number(row.whatsappId);
      if (!statsMap[wId]) {
        statsMap[wId] = {
          id: wId,
          name: `Aparelho ${wId}`,
          status: "CONNECTED",
          dbBytes: 0,
          mediaBytes: 0,
          messagesCount: 0,
          ticketsCount: 0
        };
      }

      statsMap[wId].messagesCount++;
      statsMap[wId].dbBytes += (Number(row.body_len) || 0) + 180;

      if (row.mediaUrl) {
        const fn = path.basename(row.mediaUrl);
        const fp = path.join(pubDir, fn);
        try {
          if (fs.existsSync(fp)) {
            statsMap[wId].mediaBytes += fs.statSync(fp).size;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  const globalTotalBytes = dbFileSize + mediaDirSize;

  const usageByNumber: WhatsAppStorageStat[] = Object.values(statsMap).map(item => {
    const totalBytes = item.dbBytes + item.mediaBytes;
    const percentage = globalTotalBytes > 0 
      ? Math.min(100, Math.round((totalBytes / globalTotalBytes) * 1000) / 10) 
      : 0;

    return {
      id: item.id,
      name: item.name,
      status: item.status,
      dbBytes: item.dbBytes,
      mediaBytes: item.mediaBytes,
      totalBytes,
      dbSizeFormatted: formatBytes(item.dbBytes),
      mediaSizeFormatted: formatBytes(item.mediaBytes),
      totalSizeFormatted: formatBytes(totalBytes),
      percentage,
      messagesCount: item.messagesCount,
      ticketsCount: item.ticketsCount
    };
  });

  // Ordenar decrescente por consumo total
  usageByNumber.sort((a, b) => b.totalBytes - a.totalBytes);

  return {
    database: {
      dialect: "SQLite",
      filePath: dbPath,
      fileSizeBytes: dbFileSize,
      fileSizeFormatted: formatBytes(dbFileSize)
    },
    media: {
      folderPath: pubDir,
      totalSizeBytes: mediaDirSize,
      totalSizeFormatted: formatBytes(mediaDirSize),
      totalFilesCount: mediaFilesCount
    },
    overview: {
      totalStorageBytes: globalTotalBytes,
      totalStorageFormatted: formatBytes(globalTotalBytes),
      totalMessages,
      totalTickets,
      totalContacts,
      totalWhatsapps
    },
    usageByNumber
  };
};
