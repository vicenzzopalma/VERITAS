import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import WhatsappQueue from "../../models/WhatsappQueue";
import WppKey from "../../models/WppKey";
import LidMapping from "../../models/LidMapping";

const DeleteWhatsAppService = async (id: string): Promise<void> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  const numId = Number(id);

  // 1. Desvincular tickets preservando histórico e auditoria sem violar integridade referencial
  await Ticket.update(
    { whatsappId: null },
    { where: { whatsappId: numId } }
  );

  // 2. Desvincular usuários atribuídos a este aparelho
  await User.update(
    { whatsappId: null },
    { where: { whatsappId: numId } }
  );

  // 3. Excluir associações de filas
  await WhatsappQueue.destroy({
    where: { whatsappId: numId }
  });

  // 4. Excluir chaves e sessões Baileys
  await WppKey.destroy({
    where: { connectionId: numId }
  });

  // 5. Excluir mapeamentos de LID
  await LidMapping.destroy({
    where: { whatsappId: numId }
  });

  // 6. Excluir a conexão
  await whatsapp.destroy();
};

export default DeleteWhatsAppService;
