import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CheckSettingsHelper from "../helpers/CheckSettings";
import AppError from "../errors/AppError";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService, { getHiddenUserIdsForOperationalAdmin } from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import { getUserSectorPermissions, updateUserSectorPermissions } from "../services/UserServices/SectorPermissionService";
import { isMasterAdmin, MASTER_ADMIN_EMAIL, MASTER_ADMIN_PROFILE, OPERATIONAL_ADMIN_PROFILE } from "../services/WhatsappService/WhatsappAccessPolicy";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    accessUser: req.user
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password, name, queueIds, whatsappId, canAccessConnections, connectionSectors } = req.body;
  let { profile, status } = req.body;

  if (
    req.url === "/signup" &&
    (await CheckSettingsHelper("userCreation")) === "disabled"
  ) {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  } else if (req.url !== "/signup" && (!req.user || !["admin", "admin_master", "admin_operational"].includes(req.user.profile))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // Prevenção estrita de Mass Assignment / Escalação de Privilégio no Signup
  if (req.url === "/signup") {
    profile = "user";
    status = "pending";
  }

  if (profile === "admin") profile = OPERATIONAL_ADMIN_PROFILE;
  if (profile === MASTER_ADMIN_PROFILE && (String(email || "").toLowerCase() !== MASTER_ADMIN_EMAIL || !isMasterAdmin(req.user))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await CreateUserService({
    email,
    password,
    name,
    profile: profile || "user",
    status: status || "active",
    queueIds,
    whatsappId,
    canAccessConnections,
    connectionSectors
  });

  const io = getIO();
  io.emit("user", {
    action: "create",
    user
  });

  return res.status(200).json(user);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;

  if (req.user?.profile === OPERATIONAL_ADMIN_PROFILE) {
    const hidden = await getHiddenUserIdsForOperationalAdmin();
    if (hidden.includes(Number(userId))) throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const user = await ShowUserService(userId);

  return res.status(200).json(user);
};

export const sectorPermissions = async (req: Request, res: Response): Promise<Response> => {
  if (!isMasterAdmin(req.user)) throw new AppError("ERR_NO_PERMISSION", 403);
  return res.json(await getUserSectorPermissions(req.params.userId));
};

export const updateSectorPermissions = async (req: Request, res: Response): Promise<Response> => {
  if (!isMasterAdmin(req.user)) throw new AppError("ERR_NO_PERMISSION", 403);
  return res.json(await updateUserSectorPermissions({
    userId: req.params.userId,
    permissions: req.body.permissions || []
  }));
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.user || !["admin", "admin_master", "admin_operational"].includes(req.user.profile)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { userId } = req.params;
  if (req.user.profile === OPERATIONAL_ADMIN_PROFILE) {
    const hidden = await getHiddenUserIdsForOperationalAdmin();
    if (hidden.includes(Number(userId))) throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { email, password, name, profile, queueIds, whatsappId, status, canAccessConnections, connectionSectors } = req.body;
  const target = await ShowUserService(userId);
  const normalizedProfile = profile === "admin" ? OPERATIONAL_ADMIN_PROFILE : profile;
  if (target.profile === MASTER_ADMIN_PROFILE && (!isMasterAdmin(req.user) || String(email || target.email).toLowerCase() !== MASTER_ADMIN_EMAIL)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  if (normalizedProfile === MASTER_ADMIN_PROFILE && (!isMasterAdmin(req.user) || String(email || "").toLowerCase() !== MASTER_ADMIN_EMAIL)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await UpdateUserService({
    userData: { email, password, name, profile: normalizedProfile, queueIds, whatsappId, status, canAccessConnections, connectionSectors },
    userId
  });

  const io = getIO();
  io.emit("user", {
    action: "update",
    user
  });

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;

  if (!req.user || !["admin", "admin_master", "admin_operational"].includes(req.user.profile)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await DeleteUserService(userId);

  const io = getIO();
  io.emit("user", {
    action: "delete",
    userId
  });

  return res.status(200).json({ message: "User deleted" });
};
