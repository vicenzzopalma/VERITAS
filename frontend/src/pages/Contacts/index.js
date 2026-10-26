import React, { useState, useEffect, useReducer, useContext } from "react";
import openSocket from "../../services/socket-io";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import Avatar from "@material-ui/core/Avatar";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import Tooltip from "@material-ui/core/Tooltip";

import IconButton from "@material-ui/core/IconButton";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import PersonAddOutlinedIcon from "@material-ui/icons/PersonAddOutlined";
import ContactsOutlinedIcon from "@material-ui/icons/ContactsOutlined";
import CloudDownloadOutlinedIcon from "@material-ui/icons/CloudDownloadOutlined";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainContainer from "../../components/MainContainer";
import { PageHeader, SearchField, EmptyState } from "../../components/ui";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import { getContactDisplayName, formatPhoneNumber } from "../../helpers/contactHelper";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

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
  avatar: { width: 34, height: 34, fontSize: "0.85rem" },
  name: { fontWeight: 600, color: theme.palette.text.primary },
  number: {
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    color: theme.palette.text.primary,
  },
  muted: { color: theme.palette.text.secondary },
  subtle: { color: theme.custom.textSubtle },
  whatsBtn: {
    "&:hover": { color: theme.palette.success.main },
  },
  actions: {
    whiteSpace: "nowrap",
    "& > *:not(:first-child)": { marginLeft: 4 },
  },
  deleteBtn: {
    "&:hover": { color: theme.palette.error.main },
  },
}));

const Contacts = () => {
  const classes = useStyles();
  const history = useHistory();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/contacts/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("contact", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const handleSaveTicket = async (contactId) => {
    if (!contactId) return;
    setLoading(true);
    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        userId: user?.id,
        status: "open",
      });
      history.push(`/tickets/${ticket.id}`);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleimportContact = async () => {
    try {
      await api.post("/contacts/import");
      history.go(0);
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
      <ContactModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      ></ContactModal>
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${
                deletingContact.name
              }?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={(e) =>
          deletingContact
            ? handleDeleteContact(deletingContact.id)
            : handleimportContact()
        }
      >
        {deletingContact
          ? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>
      <PageHeader
        icon={<ContactsOutlinedIcon />}
        title={i18n.t("contacts.title")}
        subtitle="Sua base de clientes. Inicie conversas ou edite dados em um clique."
        actions={
          <>
            <SearchField
              placeholder={i18n.t("contacts.searchPlaceholder")}
              type="search"
              value={searchParam}
              onChange={handleSearch}
            />
            <Button
              variant="outlined"
              startIcon={<CloudDownloadOutlinedIcon />}
              onClick={(e) => setConfirmOpen(true)}
            >
              {i18n.t("contacts.buttons.import")}
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PersonAddOutlinedIcon />}
              onClick={handleOpenContactModal}
            >
              {i18n.t("contacts.buttons.add")}
            </Button>
          </>
        }
      />
      <Paper className={classes.tableCard} onScroll={handleScroll}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("contacts.table.name")}</TableCell>
              <TableCell>{i18n.t("contacts.table.whatsapp")}</TableCell>
              <TableCell>{i18n.t("contacts.table.email")}</TableCell>
              <TableCell align="right">
                {i18n.t("contacts.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {contacts.map((contact) => (
                <TableRow key={contact.id} hover>
                  <TableCell>
                    <div className={classes.person}>
                      <Avatar
                        className={classes.avatar}
                        src={contact.profilePicUrl}
                      >
                        {getContactDisplayName(contact).charAt(0).toUpperCase()}
                      </Avatar>
                      <span className={classes.name}>
                        {getContactDisplayName(contact)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className={classes.number}>
                    {formatPhoneNumber(contact.number) || (
                      <span className={classes.subtle}>—</span>
                    )}
                  </TableCell>
                  <TableCell className={classes.muted}>
                    {contact.email || <span className={classes.subtle}>—</span>}
                  </TableCell>
                  <TableCell align="right" className={classes.actions}>
                    <Tooltip title="Iniciar conversa">
                      <IconButton
                        size="small"
                        className={classes.whatsBtn}
                        onClick={() => handleSaveTicket(contact.id)}
                      >
                        <WhatsAppIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => hadleEditContact(contact.id)}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Can
                      role={user.profile}
                      perform="contacts-page:deleteContact"
                      yes={() => (
                        <Tooltip title="Excluir">
                          <IconButton
                            size="small"
                            className={classes.deleteBtn}
                            onClick={(e) => {
                              setConfirmOpen(true);
                              setDeletingContact(contact);
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRowSkeleton
                  avatar
                  columns={3}
                  rows={contacts.length ? 1 : 6}
                />
              )}
            </>
          </TableBody>
        </Table>
        {!loading && contacts.length === 0 && (
          <EmptyState
            icon={<ContactsOutlinedIcon />}
            title={
              searchParam
                ? "Nenhum contato encontrado"
                : "Nenhum contato por aqui"
            }
            description={
              searchParam
                ? "Tente buscar por outro nome, número ou e-mail."
                : "Adicione contatos manualmente ou importe-os do WhatsApp conectado."
            }
            action={
              !searchParam && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PersonAddOutlinedIcon />}
                  onClick={handleOpenContactModal}
                >
                  {i18n.t("contacts.buttons.add")}
                </Button>
              )
            }
          />
        )}
      </Paper>
    </MainContainer>
  );
};

export default Contacts;
