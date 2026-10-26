import React, { useState, useEffect, useReducer } from "react";
import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Avatar from "@material-ui/core/Avatar";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import AddIcon from "@material-ui/icons/Add";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";

import MainContainer from "../../components/MainContainer";
import {
  PageHeader,
  SearchField,
  StatusPill,
  EmptyState,
} from "../../components/ui";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";

const reducer = (state, action) => {
  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const PROFILE_TONES = { admin: "primary", master: "accent", user: "neutral" };

const getInitials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";

const useStyles = makeStyles((theme) => ({
  tableCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  person: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    minWidth: 0,
  },
  avatar: { width: 34, height: 34, fontSize: "0.8rem" },
  name: { fontWeight: 600, color: theme.palette.text.primary },
  muted: { color: theme.palette.text.secondary },
  connection: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    color: theme.palette.text.primary,
    "& svg": { fontSize: 16, color: theme.palette.success.main },
  },
  actions: {
    whiteSpace: "nowrap",
    "& > *:not(:first-child)": { marginLeft: 4 },
  },
  deleteBtn: {
    "&:hover": { color: theme.palette.error.main },
  },
}));

const Users = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [users, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_USERS", payload: data.users });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("user", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_USERS", payload: data.user });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.userId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${
            deletingUser.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <UserModal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        aria-labelledby="form-dialog-title"
        userId={selectedUser && selectedUser.id}
      />
      <PageHeader
        icon={<PeopleAltOutlinedIcon />}
        title={i18n.t("users.title")}
        subtitle="Gerencie atendentes, perfis de acesso e conexões padrão."
        actions={
          <>
            <SearchField
              placeholder={i18n.t("contacts.searchPlaceholder")}
              type="search"
              value={searchParam}
              onChange={handleSearch}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenUserModal}
            >
              {i18n.t("users.buttons.add")}
            </Button>
          </>
        }
      />
      <Paper className={classes.tableCard} onScroll={handleScroll}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("users.table.name")}</TableCell>
              <TableCell>{i18n.t("users.table.email")}</TableCell>
              <TableCell>{i18n.t("users.table.profile")}</TableCell>
              <TableCell>{i18n.t("users.table.whatsapp")}</TableCell>
              <TableCell align="right">
                {i18n.t("users.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <div className={classes.person}>
                      <Avatar className={classes.avatar}>
                        {getInitials(user.name)}
                      </Avatar>
                      <span className={classes.name}>{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className={classes.muted}>{user.email}</TableCell>
                  <TableCell>
                    <StatusPill tone={PROFILE_TONES[user.profile] || "neutral"}>
                      {user.profile
                        ? user.profile.charAt(0).toUpperCase() +
                          user.profile.slice(1)
                        : "-"}
                    </StatusPill>
                  </TableCell>
                  <TableCell>
                    {user.whatsapp?.name ? (
                      <span className={classes.connection}>
                        <WhatsAppIcon />
                        {user.whatsapp.name}
                      </span>
                    ) : (
                      <span className={classes.muted}>—</span>
                    )}
                  </TableCell>
                  <TableCell align="right" className={classes.actions}>
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => handleEditUser(user)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        className={classes.deleteBtn}
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingUser(user);
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRowSkeleton
                  avatar
                  columns={4}
                  rows={users.length ? 1 : 5}
                />
              )}
            </>
          </TableBody>
        </Table>
        {!loading && users.length === 0 && (
          <EmptyState
            icon={<PeopleAltOutlinedIcon />}
            title={
              searchParam
                ? "Nenhum usuário encontrado"
                : "Nenhum usuário cadastrado"
            }
            description={
              searchParam
                ? "Tente buscar por outro nome ou e-mail."
                : "Adicione atendentes para distribuir os tickets entre a equipe."
            }
            action={
              !searchParam && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={handleOpenUserModal}
                >
                  {i18n.t("users.buttons.add")}
                </Button>
              )
            }
          />
        )}
      </Paper>
    </MainContainer>
  );
};

export default Users;
