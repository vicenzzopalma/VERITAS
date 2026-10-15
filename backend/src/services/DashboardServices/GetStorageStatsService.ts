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
    openTickets: number;
    pendingTickets: number;
    closedTickets: number;
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

let cachedStats: StorageStatsResponse | null = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos de cache

export const GetStorageStatsService = async (forceRefresh = false): Promise<StorageStatsResponse> => {
  const now = Date.now();
  if (!forceRefresh && cachedStats && (now - lastCacheTimestamp < CACHE_TTL_MS)) {
    return cachedStats;
  }

  // 1. Obter informações físicas do arquivo SQLite
  const dbPath = process.env.DB_STORAGE || path.resolve(__dirname, "..", "..", "..", "whaticket.sqlite");
  let dbFileSize = 0;
  if (fs.existsSync(dbPath)) {
    try {
      dbFileSize = fs.statSync(dbPath).size;
    } catch {
      dbFileSize = 0;
    }
  }

  // 2. Obter informações da pasta public de mídias de forma rápida
  const pubDir = path.resolve(__dirname, "..", "..", "..", "public");
  let mediaDirSize = 0;
  let mediaFilesCount = 0;
  if (fs.existsSync(pubDir)) {
    try {
      const files = fs.readdirSync(pubDir);
      mediaFilesCount = files.length;
      // Estima/calcula o tamanho amostrando os primeiros ou somando sem travar
      let sampleSize = 0;
      let sampleCount = 0;
      const sampleLimit = Math.min(files.length, 500);
      for (let i = 0; i < sampleLimit; i++) {
        try {
          const st = fs.statSync(path.join(pubDir, files[i]));
          if (st.isFile()) {
            sampleSize += st.size;
            sampleCount++;
          }
        } catch {
          // ignore
        }
      }
      mediaDirSize = sampleCount > 0 ? Math.round((sampleSize / sampleCount) * mediaFilesCount) : 0;
    } catch {
      mediaDirSize = 0;
    }
  }

  // 3. Contadores Globais e por Status de Tickets em paralelo
  const [totalMessages, totalTickets, totalContacts, totalWhatsapps, ticketStatusRows] = await Promise.all([
    Message.count(),
    Ticket.count(),
    Contact.count(),
    Whatsapp.count(),
    sequelize.query("SELECT status, COUNT(*) as count FROM Tickets GROUP BY status;").catch(() => [[]])
  ]);

  let openTickets = 0;
  let pendingTickets = 0;
  let closedTickets = 0;

  const statusRows = Array.isArray(ticketStatusRows) && Array.isArray(ticketStatusRows[0]) ? ticketStatusRows[0] : [];
  for (const row of statusRows as any[]) {
    const s = String(row.status || "").toLowerCase();
    const c = Number(row.count) || 0;
    if (s === "open") openTickets = c;
    else if (s === "pending") pendingTickets = c;
    else if (s === "closed") closedTickets = c;
  }

  // 4. Detalhamento por WhatsApp / Número via Agregação SQL Direta
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
  `).catch(() => [[]]);

  if (Array.isArray(ticketCounts)) {
    for (const t of ticketCounts as any[]) {
      const wId = Number(t.whatsappId);
      if (statsMap[wId]) {
        statsMap[wId].ticketsCount = Number(t.count) || 0;
        statsMap[wId].dbBytes += (Number(t.count) || 0) * 256;
      }
    }
  }

  // Agregação de mensagens por WhatsApp via SQL Direta (sub-segundo em vez de table scan e readdirSync)
  const [msgAggRows] = await sequelize.query(`
    SELECT 
      t.whatsappId, 
      COUNT(m.id) as msg_count, 
      SUM(COALESCE(LENGTH(m.body), 0)) as body_bytes,
      SUM(CASE WHEN m.mediaUrl IS NOT NULL AND m.mediaUrl != '' THEN 1 ELSE 0 END) as media_count
    FROM Messages m 
    JOIN Tickets t ON m.ticketId = t.id
    WHERE t.whatsappId IS NOT NULL
    GROUP BY t.whatsappId;
  `).catch(() => [[]]);

  let totalMediaReferences = 0;
  if (Array.isArray(msgAggRows)) {
    for (const row of msgAggRows as any[]) {
      totalMediaReferences += Number(row.media_count) || 0;
    }

    for (const row of msgAggRows as any[]) {
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

      const msgCount = Number(row.msg_count) || 0;
      const bodyBytes = Number(row.body_bytes) || 0;
      const mediaCount = Number(row.media_count) || 0;

      statsMap[wId].messagesCount = msgCount;
      statsMap[wId].dbBytes += bodyBytes + (msgCount * 180);

      if (totalMediaReferences > 0 && mediaCount > 0 && mediaDirSize > 0) {
        statsMap[wId].mediaBytes = Math.round((mediaCount / totalMediaReferences) * mediaDirSize);
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

  const response: StorageStatsResponse = {
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
      totalWhatsapps,
      openTickets,
      pendingTickets,
      closedTickets
    },
    usageByNumber
  };

  cachedStats = response;
  lastCacheTimestamp = Date.now();

  return response;
};
