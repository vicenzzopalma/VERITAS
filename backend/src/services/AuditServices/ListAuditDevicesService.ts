import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { Op } from "sequelize";
import sequelize from "../../database";

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

  const enrichedDevices: AuditDeviceResponse[] = await Promise.all(
    whatsapps.map(async (w) => {
      const tickets = await Ticket.findAll({
        where: { whatsappId: w.id },
        attributes: ["id", "updatedAt"]
      });

      const ticketIds = tickets.map((t) => t.id);
      let totalMessages = 0;
      let deletedMessages = 0;
      let mediaMessages = 0;
      let lastActivity: Date | null = tickets.length > 0 ? tickets[0].updatedAt : null;

      if (ticketIds.length > 0) {
        totalMessages = await Message.count({
          where: { ticketId: { [Op.in]: ticketIds } }
        });

        deletedMessages = await Message.count({
          where: {
            ticketId: { [Op.in]: ticketIds },
            isDeleted: true
          }
        });

        mediaMessages = await Message.count({
          where: {
            ticketId: { [Op.in]: ticketIds },
            mediaUrl: { [Op.ne]: null as any }
          }
        });

        const latestMessage = await Message.findOne({
          where: { ticketId: { [Op.in]: ticketIds } },
          order: [["createdAt", "DESC"]],
          attributes: ["createdAt"]
        });

        if (latestMessage) {
          lastActivity = latestMessage.createdAt;
        }
      }

      return {
        id: w.id,
        name: w.name || `WhatsApp ${w.id}`,
        status: w.status || "DISCONNECTED",
        number: (w as any).number || "",
        isDefault: w.isDefault || false,
        battery: w.battery || "",
        plugged: w.plugged || false,
        totalMessages,
        totalChats: tickets.length,
        deletedMessages,
        mediaMessages,
        lastActivity,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt
      };
    })
  );

  return enrichedDevices;
};

export default ListAuditDevicesService;
