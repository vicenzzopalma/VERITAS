import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { Op } from "sequelize";
import sequelize from "../../database";
import { getSessionStatus } from "../../providers/WhatsApp/Implementations/whaileys";

export interface AuditDeviceResponse {
  id: number;
  name: string;
  status: string;
  number: string;
  isDefault: boolean;
  battery: string;
  plugged: boolean;
  totalMessages: number;
  totalChats: number;
  deletedMessages: number;
  mediaMessages: number;
  lastActivity: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ListAuditDevicesService = async (): Promise<AuditDeviceResponse[]> => {
  const whatsapps = await Whatsapp.findAll({
    order: [["name", "ASC"]]
  });

  const [stats]: any = await sequelize.query(`
    SELECT 
      t.whatsappId,
      count(DISTINCT t.id) as totalChats,
      count(m.id) as totalMessages,
      sum(case when m.isDeleted = 1 then 1 else 0 end) as deletedMessages,
      sum(case when m.mediaUrl IS NOT NULL then 1 else 0 end) as mediaMessages,
      max(m.createdAt) as lastActivity
    FROM Tickets t
    LEFT JOIN Messages m ON m.ticketId = t.id
    GROUP BY t.whatsappId;
  `);

  const statsMap = new Map<number, any>();
  if (Array.isArray(stats)) {
    for (const s of stats) {
      statsMap.set(Number(s.whatsappId), s);
    }
  }

  const enrichedDevices: AuditDeviceResponse[] = whatsapps.map((w) => {
    const s = statsMap.get(w.id);

    let liveStatus = w.status || "DISCONNECTED";
    const runtimeStatus = getSessionStatus(w.id);
    if (runtimeStatus) {
      liveStatus = runtimeStatus;
    } else if (w.status === "CONNECTED" && !runtimeStatus) {
      liveStatus = "DISCONNECTED";
    }

    return {
      id: w.id,
      name: w.name || `WhatsApp ${w.id}`,
      status: liveStatus,
      number: (w as any).number || "",
      isDefault: w.isDefault || false,
      battery: w.battery || "",
      plugged: w.plugged || false,
      totalMessages: s ? Number(s.totalMessages) : 0,
      totalChats: s ? Number(s.totalChats) : 0,
      deletedMessages: s ? Number(s.deletedMessages) : 0,
      mediaMessages: s ? Number(s.mediaMessages) : 0,
      lastActivity: s && s.lastActivity ? new Date(s.lastActivity) : null,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt
    };
  });

  return enrichedDevices;
};

export default ListAuditDevicesService;
