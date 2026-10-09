import React, { useState, useEffect, useReducer, useContext } from "react";
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
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";
import Chip from "@material-ui/core/Chip";
import Tooltip from "@material-ui/core/Tooltip";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import CheckCircleIcon from "@material-ui/icons/CheckCircle";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";

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

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
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
  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [sectorName, setSectorName] = useState("");
  const [sectorMinimumProfile, setSectorMinimumProfile] = useState("admin_operational");
  const [sectorRefreshKey, setSectorRefreshKey] = useState(0);
  const { user: loggedInUser } = useContext(AuthContext);
  const isMaster = String(loggedInUser?.email || "").toLowerCase() === "vicenzzo.mastronikolis@realess.com.br";

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

  const handleApproveUser = async (user) => {
    try {
      await api.put(`/users/${user.id}`, {
        name: user.name,
        email: user.email,
        profile: user.profile,
        status: "active",
      });
      toast.success(i18n.t("users.toasts.approved") || "Usuário aprovado com sucesso.");
    } catch (err) {
      toastError(err);
    }
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

  const handleCreateSector = async () => {
    try {
      await api.post("/sectors", { name: sectorName, minimumProfile: sectorMinimumProfile });
      toast.success("Setor criado com sucesso.");
      setSectorName("");
      setSectorMinimumProfile("admin_operational");
      setSectorDialogOpen(false);
      setSectorRefreshKey(value => value + 1);
    } catch (err) {
      toastError(err);
    }
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
        sectorRefreshKey={sectorRefreshKey}
      />
      <Dialog open={sectorDialogOpen} onClose={() => setSectorDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Novo setor</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth margin="dense" label="Nome do setor" value={sectorName} onChange={event => setSectorName(event.target.value)} />
          <FormControl fullWidth variant="outlined" margin="dense">
            <InputLabel>Nível mínimo para visualizar</InputLabel>
            <Select value={sectorMinimumProfile} onChange={event => setSectorMinimumProfile(event.target.value)} label="Nível mínimo para visualizar">
              <MenuItem value="admin_master">Administrador Master</MenuItem>
              <MenuItem value="admin_operational">Administrador Operacional</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSectorDialogOpen(false)}>Cancelar</Button>
          <Button color="primary" variant="contained" disabled={!sectorName.trim()} onClick={handleCreateSector}>Criar setor</Button>
        </DialogActions>
      </Dialog>
      <MainHeader>
        <Title>{i18n.t("users.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenUserModal}
          >
            {i18n.t("users.buttons.add")}
          </Button>
          {isMaster && <Button variant="outlined" color="primary" onClick={() => setSectorDialogOpen(true)}>+ Novo setor</Button>}
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">{i18n.t("users.table.name")}</TableCell>
              <TableCell align="center">
                {i18n.t("users.table.email")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("users.table.profile")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("users.table.whatsapp")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("users.table.status") || "Status"}
              </TableCell>
              <TableCell align="center">
                {i18n.t("users.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell align="center">{user.name}</TableCell>
                  <TableCell align="center">{user.email}</TableCell>
                  <TableCell align="center">
                    {user.profile === "admin_master"
                      ? "Administrador Master"
                      : user.profile === "admin_operational"
                      ? "Administrador Operacional"
                      : user.profile === "admin"
                      ? "Administrador Operacional"
                      : user.profile === "operator"
                      ? "Operador WhatsApp"
                      : user.profile === "whatsapp_control"
                      ? "Gestor WhatsApp Control (Baixo)"
                      : user.profile === "whatsapp_control_high"
                      ? "Gestor WhatsApp Control (Alto)"
                      : user.profile || "User"}
                  </TableCell>
                  <TableCell align="center">{user.whatsapp?.name || "-"}</TableCell>
                  <TableCell align="center">
                    {user.status === "pending" ? (
                      <Chip
                        size="small"
                        label="Pendente"
                        style={{
                          backgroundColor: "#f59e0b",
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                        }}
                      />
                    ) : (
                      <Chip
                        size="small"
                        label="Ativo"
                        style={{
                          backgroundColor: "#10b981",
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: "0.75rem",
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {user.status === "pending" && (
                      <Tooltip title={i18n.t("users.buttons.approve") || "Aprovar Conta"}>
                        <IconButton
                          size="small"
                          style={{ color: "#10b981", marginRight: 4 }}
                          onClick={() => handleApproveUser(user)}
                        >
                          <CheckCircleIcon />
                        </IconButton>
                      </Tooltip>
                    )}

                    <IconButton
                      size="small"
                      onClick={() => handleEditUser(user)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={(e) => {
                        setConfirmModalOpen(true);
                        setDeletingUser(user);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {loading && <TableRowSkeleton columns={6} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Users;
