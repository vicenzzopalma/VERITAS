import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";

interface MessageData {
  id: string;
  ticketId: number;
  body: string;
  contactId?: number;
  fromMe?: boolean;
  read?: boolean;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  quotedMsgId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
interface Request {
  messageData: MessageData;
}

const CreateMessageService = async ({
  messageData
}: Request): Promise<Message> => {
  if (messageData.quotedMsgId) {
    const quotedExists = await Message.findByPk(messageData.quotedMsgId);
    if (!quotedExists) {
      delete messageData.quotedMsgId;
    }
  }

  if (messageData.contactId) {
    const contactExists = await Contact.findByPk(messageData.contactId);
    if (!contactExists) {
      delete messageData.contactId;
    }
  }

  // COLLISION DETECTION & ISOLATION FOR MULTI-DEVICE INTERNAL CHATS:
  // Se a mensagem já existe no banco mas pertence a OUTRO ticket (ex: conversa interna entre 2 chips conectados),
  // geramos um ID composto isolado por ticket para que cada ticket tenha sua cópia íntegra da mensagem.
  const existingMessage = await Message.findByPk(messageData.id);
  if (existingMessage && existingMessage.ticketId !== messageData.ticketId) {
    messageData.id = `${messageData.ticketId}_${messageData.id}`;
  }

  await Message.upsert(messageData);

  const message = await Message.findByPk(messageData.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_MESSAGE");
  }

  const io = getIO();
  io.to(message.ticketId.toString())
    .to(message.ticket.status)
    .to("notification")
    .emit("appMessage", {
      action: "create",
      message,
      ticket: message.ticket,
      contact: message.ticket.contact
    });

  return message;
};

export default CreateMessageService;
