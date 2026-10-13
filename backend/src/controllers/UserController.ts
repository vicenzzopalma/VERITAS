import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CheckSettingsHelper from "../helpers/CheckSettings";
import AppError from "../errors/AppError";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import User from "../models/User";
import {
  isMasterAdmin,
  isAnyAdmin,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_PROFILE,
  OPERATIONAL_ADMIN_PROFILE
} from "../services/WhatsappService/WhatsappAccessPolicy";
import {
  getUserSectorPermissions,
  updateUserSectorPermissions
} from "../services/UserServices/SectorPermissionService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  if (!req.user || !isMasterAdmin(req.user)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    requesterUser: req.user
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password, name, queueIds, whatsappId, canAccessConnections, connectionSectors, sectorPermissions } = req.body;
  let { profile, status } = req.body;

  if (
    req.url === "/signup" &&
    (await CheckSettingsHelper("userCreation")) === "disabled"
  ) {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  } else if (req.url !== "/signup" && (!req.user || !isMasterAdmin(req.user))) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // Prevenção estrita de Mass Assignment / Escalação de Privilégio no Signup
  if (req.url === "/signup") {
    profile = "user";
    status = "pending";
  }

  // Apenas o Master pode atribuir perfil master
  if (profile === MASTER_ADMIN_PROFILE && !isMasterAdmin(req.user)) {
    profile = OPERATIONAL_ADMIN_PROFILE;
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

  if (Array.isArray(sectorPermissions) && sectorPermissions.length > 0 && isMasterAdmin(req.user)) {
    await updateUserSectorPermissions(user.id, sectorPermissions, req.user);
  }

  const finalUser = await ShowUserService(user.id);

  const io = getIO();
  io.emit("user", {
    action: "create",
    user: finalUser
  });

  return res.status(200).json(finalUser);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;

  const user = await ShowUserService(userId);

  return res.status(200).json(user);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (!req.user || !isMasterAdmin(req.user)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { userId } = req.params;
  const targetUser = await User.findByPk(userId);
  if (!targetUser) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const targetEmail = String(targetUser.email || "").toLowerCase().trim();
  const isTargetMaster = targetEmail === MASTER_ADMIN_EMAIL;

  // Proteção: Ninguém altera o Master exceto ele mesmo
  if (isTargetMaster && !isMasterAdmin(req.user)) {
    throw new AppError("Apenas o próprio Administrador Master pode editar seu perfil.", 403);
  }

  const { email, password, name, profile, queueIds, whatsappId, status, canAccessConnections, connectionSectors, sectorPermissions } = req.body;

  let finalProfile = profile;
  if (isTargetMaster) {
    finalProfile = MASTER_ADMIN_PROFILE;
  } else if (profile === MASTER_ADMIN_PROFILE && !isMasterAdmin(req.user)) {
    finalProfile = OPERATIONAL_ADMIN_PROFILE;
  }

  const user = await UpdateUserService({
    userData: { email, password, name, profile: finalProfile, queueIds, whatsappId, status, canAccessConnections, connectionSectors },
    userId
  });

  if (Array.isArray(sectorPermissions) && isMasterAdmin(req.user) && !isTargetMaster) {
    await updateUserSectorPermissions(userId, sectorPermissions, req.user);
  }

  const finalUser = await ShowUserService(userId);

  const io = getIO();
  io.emit("user", {
    action: "update",
    user: finalUser
  });

  return res.status(200).json(finalUser);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;

  if (!req.user || !isMasterAdmin(req.user)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const targetUser = await User.findByPk(userId);
  if (targetUser && isMasterAdmin(targetUser)) {
    throw new AppError("O Administrador Master não pode ser excluído.", 403);
  }

  await DeleteUserService(userId);

  const io = getIO();
  io.emit("user", {
    action: "delete",
    userId
  });

  return res.status(200).json({ message: "User deleted" });
};

export const sectorPermissions = async (req: Request, res: Response): Promise<Response> => {
  if (!req.user || !isMasterAdmin(req.user)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { userId } = req.params;
  const permissions = await getUserSectorPermissions(userId);
  return res.status(200).json(permissions);
};

export const updateSectorPermissions = async (req: Request, res: Response): Promise<Response> => {
  if (!req.user || !isMasterAdmin(req.user)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { userId } = req.params;
  const { permissions } = req.body;
  const updated = await updateUserSectorPermissions(userId, permissions, req.user);
  return res.status(200).json(updated);
};