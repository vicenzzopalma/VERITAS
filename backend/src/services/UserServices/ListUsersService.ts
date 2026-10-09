import { Sequelize, Op } from "sequelize";
import Queue from "../../models/Queue";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import Sector from "../../models/Sector";
import UserSectorPermission from "../../models/UserSectorPermission";
import { MASTER_ADMIN_EMAIL, MASTER_ADMIN_PROFILE } from "../WhatsappService/WhatsappAccessPolicy";

interface Request {
  searchParam?: string;
  pageNumber?: string | number;
  accessUser?: any;
}

interface Response {
  users: User[];
  count: number;
  hasMore: boolean;
}

export const getHiddenUserIdsForOperationalAdmin = async (): Promise<number[]> => {
  const sectors = await Sector.findAll({ where: { active: true, minimumProfile: "admin_master" }, attributes: ["name"] });
  if (sectors.length === 0) return [];
  const permissions = await UserSectorPermission.findAll({ where: { sector: { [Op.in]: sectors.map(item => item.name) } }, attributes: ["userId"], group: ["userId"] });
  return permissions.map(permission => permission.userId);
};

const ListUsersService = async ({
  searchParam = "",
  pageNumber = "1",
  accessUser
}: Request): Promise<Response> => {
  const whereCondition = {
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
  const hiddenIds = accessUser?.profile === "admin_operational" ? await getHiddenUserIdsForOperationalAdmin() : [];
  const userWhere: any = { ...whereCondition };
  if (hiddenIds.length > 0) userWhere.id = { [Op.notIn]: hiddenIds };
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: users } = await User.findAndCountAll({
    where: userWhere,
    attributes: ["name", "id", "email", "profile", "status", "createdAt"],
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      { model: Whatsapp, as: "whatsapp", attributes: ["id", "name"] }
    ]
  });

  users.forEach(user => {
    if (String(user.email || "").trim().toLowerCase() === MASTER_ADMIN_EMAIL) {
      user.profile = MASTER_ADMIN_PROFILE;
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
