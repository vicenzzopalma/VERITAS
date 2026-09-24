import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  profile?: string;
  status?: string;
  whatsappId?: number;
  canAccessConnections?: boolean;
  connectionSectors?: string[];
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
  status: string;
}

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  profile = "admin",
  status = "active",
  whatsappId,
  canAccessConnections = false,
  connectionSectors = []
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string().email().required(),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const emailExists = await User.findOne({
    where: { email }
  });

  if (emailExists) {
    if (emailExists.status === "pending") {
      throw new AppError("ERR_USER_ALREADY_EXISTS_PENDING", 400);
    }
    throw new AppError("ERR_USER_ALREADY_EXISTS", 400);
  }

  const user = await User.create(
    {
      email,
      password,
      name,
      profile,
      status,
      whatsappId: whatsappId ? whatsappId : null,
      canAccessConnections,
      connectionSectors
    },
    { include: ["queues", "whatsapp"] }
  );

  await user.$set("queues", queueIds);

  await user.reload();

  return SerializeUser(user);
};

export default CreateUserService;
