import { Sequelize, Op } from "sequelize";
import Contact from "../../models/Contact";
import { getPhoneSearchVariants } from "../../helpers/phoneSearchHelper";

interface Request {
  searchParam?: string;
  pageNumber?: string;
}

interface Response {
  contacts: Contact[];
  count: number;
  hasMore: boolean;
}

const ListContactsService = async ({
  searchParam = "",
  pageNumber = "1"
}: Request): Promise<Response> => {
  const trimmedSearch = (searchParam || "").trim();
  let whereCondition: any = {};

  if (trimmedSearch) {
    const orConditions: any[] = [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("name")),
          "LIKE",
          `%${trimmedSearch.toLowerCase()}%`
        )
      }
    ];

    const phoneVariants = getPhoneSearchVariants(trimmedSearch);
    for (const variant of phoneVariants) {
      orConditions.push({ number: { [Op.like]: `%${variant}%` } });
      orConditions.push({ lid: { [Op.like]: `%${variant}%` } });
    }

    whereCondition = {
      [Op.or]: orConditions
    };
  }
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const { count, rows: contacts } = await Contact.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]]
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
