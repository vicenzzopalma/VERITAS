import { Sequelize, Op } from "sequelize";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import Sector from "../../models/Sector";
import UserSectorPermission from "../../models/UserSectorPermission";
import {
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_PROFILE,
  OPERATIONAL_ADMIN_PROFILE,
  isMasterAdmin,
  isOperationalAdmin
} from "../WhatsappService/WhatsappAccessPolicy";

interface Request {
  searchParam?: string;
  pageNumber?: string | number;
  requesterUser?: any;
}

interface Response {
  users: User[];
  count: number;
  hasMore: boolean;
}

const ListUsersService = async ({
  searchParam = "",
  pageNumber = "1",
  requesterUser
}: Request): Promise<Response> => {
  let whereCondition: any = {
    [Op.or]: [
      {
        "$User.name$": Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("User.name")),
          "LIKE",
          `%${searchParam.toLowerCase()}%`
        )
      },
      { email: { [Op.like]: `%${searchParam.toLowerCase()}%` } }
    ]
  };

  // Se o solicitante for Administrador Operacional, oculta usuários vinculados a setores restritos ao Master
  if (isOperationalAdmin(requesterUser)) {
    try {
      const masterSectors = await Sector.findAll({
        where: { active: true, minimumProfile: "admin_master" },
        attributes: ["name"]
      });

      if (masterSectors && masterSectors.length > 0) {
        const sectorNames = masterSectors.map(s => s.name);
        const restrictedPerms = await UserSectorPermission.findAll({
          where: { sector: { [Op.in]: sectorNames } },
          attributes: ["userId"]
        });
        const restrictedUserIds = restrictedPerms.map(p => p.userId);
        if (restrictedUserIds.length > 0) {
          whereCondition.id = { [Op.notIn]: restrictedUserIds };
        }
      }
    } catch (_err) {}
  }

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: users } = await User.findAndCountAll({
    where: whereCondition,
    attributes: ["name", "id", "email", "profile", "status", "createdAt"],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] }
    ]
  });

  // Normalização de perfis na resposta
  users.forEach(u => {
    const email = String(u.email || "").toLowerCase().trim();
    if (email === MASTER_ADMIN_EMAIL) {
      u.profile = MASTER_ADMIN_PROFILE;
    } else if (u.profile === "admin") {
      u.profile = OPERATIONAL_ADMIN_PROFILE;
    }
  });

  const hasMore = count > offset + users.length;

  return {
    users,
    count,
    hasMore
  };
};

export default ListUsersService;