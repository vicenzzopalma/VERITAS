import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  status?: string;
  queueIds?: number[];
  whatsappId?: number;
  canAccessConnections?: boolean;
  connectionSectors?: string[];
}

interface Request {
  userData: UserData;
  userId: string | number;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
  status: string;
}

const UpdateUserService = async ({
  userData,
  userId
}: Request): Promise<Response | undefined> => {
  const user = await User.findByPk(userId, {
    include: ["queues", "whatsapp"]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    status: Yup.string(),
    password: Yup.string()
  });

  const {
    email,
    password,
    profile,
    status,
    name,
    queueIds = [],
    whatsappId,
    canAccessConnections,
    connectionSectors
  } = userData;

  try {
    await schema.validate({ email, password, profile, status, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  await user.update({
    email,
    password,
    profile,
    status,
    name,
    whatsappId: whatsappId ? whatsappId : null,
    ...(canAccessConnections !== undefined && { canAccessConnections }),
    ...(connectionSectors !== undefined && { connectionSectors })
  });

  await user.$set("queues", queueIds);

  await user.reload();

  return SerializeUser(user);
};

export default UpdateUserService;
