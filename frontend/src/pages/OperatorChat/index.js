import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { makeStyles, alpha } from "@material-ui/core/styles";
import {
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  InputBase,
  CircularProgress,
  Hidden
} from "@material-ui/core";
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  ExitToApp as ExitToAppIcon,
  PhoneIphone as SmartphoneIcon,
  ArrowBack as ArrowBackIcon,
  Forum as ForumIcon,
  Mic as MicIcon,
  PhotoCamera as PhotoCameraIcon,
  InsertDriveFile as FileIcon
} from "@material-ui/icons";

import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useThemeContext } from "../../context/DarkMode";
import MessagesList from "../../components/MessagesList";
import MessageInput from "../../components/MessageInput";
import { ReplyMessageProvider } from "../../context/ReplyingMessage/ReplyingMessageContext";
import {
  getContactDisplayName,
  isPendingResolution,
  PENDING_TOOLTIP
} from "../../helpers/contactHelper";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  const isDark = theme.palette.type === "dark";
  const success = theme.palette.success.main;
  return {
    root: {
      display: "flex",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.5),
      height: "100dvh",
      width: "100%",
      overflow: "hidden",
      ...c.dotGrid,
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
      [theme.breakpoints.down("sm")]: {
        position: "relative",
        padding: 0,
        gap: 0,
        minHeight: "calc(100dvh - 56px)",
        height: "calc(100dvh - 56px)",
      },
    },

    // Painel Esquerdo (Lista de Conversas)
    leftPanel: {
      width: 400,
      minWidth: 320,
      maxWidth: 460,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 16,
      boxShadow: c.shadow,
      overflow: "hidden",
      zIndex: 2,
      [theme.breakpoints.down("sm")]: {
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        borderRadius: 0,
        border: "none",
      }
    },
    leftPanelHiddenOnMobile: {
      [theme.breakpoints.down("sm")]: {
        display: "none",
      }
    },

    // Header do Operador (topo esquerdo)
    leftHeader: {
      minHeight: 68,
      padding: theme.spacing(1.5, 2),
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.surface,
      borderBottom: `1px solid ${c.border}`
    },
    operatorInfo: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      overflow: "hidden"
    },
    deviceAvatar: {
      background: c.gradient,
      color: "#ffffff",
      width: 40,
      height: 40,
      borderRadius: 12
    },
    deviceTextWrapper: {
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    },
    deviceName: {
      fontSize: "0.92rem",
      fontWeight: 700,
      letterSpacing: "-0.01em",
      color: theme.palette.text.primary,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    deviceStatus: {
      alignSelf: "flex-start",
      fontSize: "0.68rem",
      color: success,
      backgroundColor: alpha(success, isDark ? 0.16 : 0.1),
      fontWeight: 600,
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      marginTop: 3,
      padding: "1px 8px",
      borderRadius: 999,
      lineHeight: 1.6
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      backgroundColor: success,
      boxShadow: `0 0 0 3px ${alpha(success, 0.2)}`,
      display: "inline-block"
    },
    headerActions: {
      display: "flex",
      alignItems: "center",
      gap: 4
    },
    logoutButton: {
      color: theme.palette.error.main,
      "&:hover": { backgroundColor: alpha(theme.palette.error.main, 0.1) }
    },

    // Barra de Busca
    searchContainer: {
      padding: theme.spacing(1.5, 1.5, 1),
      backgroundColor: c.surface
    },
    searchBox: {
      display: "flex",
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: "4px 8px 4px 12px",
      height: 40,
      transition: "border-color .15s, box-shadow .15s",
      "&:focus-within": {
        borderColor: c.primary,
        boxShadow: `0 0 0 3px ${c.primarySoft}`
      }
    },
    searchInput: {
      marginLeft: 8,
      flex: 1,
      fontSize: "0.86rem",
      color: theme.palette.text.primary
    },
    searchIcon: {
      color: c.textSubtle,
      fontSize: 20
    },

    // Lista de Conversas
    chatListWrapper: {
      flex: 1,
      overflowY: "auto",
      padding: theme.spacing(0.5, 1, 1),
      ...theme.scrollbarStyles
    },
    chatItem: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.25, 1.25, 1.25, 1.5),
      margin: "2px 0",
      borderRadius: 12,
      cursor: "pointer",
      transition: "background-color .12s ease",
      "&:hover": {
        backgroundColor: c.surfaceHover
      }
    },
    chatItemSelected: {
      backgroundColor: `${c.primarySoft} !important`,
      "&::before": {
        content: '""',
        position: "absolute",
        left: 0,
        top: 10,
        bottom: 10,
        width: 3,
        borderRadius: 3,
        backgroundColor: c.primary
      }
    },
    contactAvatar: {
      width: 42,
      height: 42,
      flex: "none",
      border: `1px solid ${c.border}`,
      backgroundColor: c.primarySoft,
      color: c.primary,
      fontWeight: 700
    },
    chatContent: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    },
    chatRowTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing(1)
    },
    contactPhone: {
      fontSize: "0.88rem",
      fontWeight: 600,
      color: theme.palette.text.primary,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    chatTimestamp: {
      flex: "none",
      fontSize: "0.72rem",
      fontWeight: 500,
      color: c.textSubtle,
      whiteSpace: "nowrap"
    },
    chatTimestampUnread: {
      color: c.primary,
      fontWeight: 700
    },
    chatRowBottom: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 6
    },
    lastMessagePreview: {
      fontSize: "0.8rem",
      color: c.textMuted,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 4,
      "& > span": {
        overflow: "hidden",
        textOverflow: "ellipsis"
      },
      "& svg": {
        fontSize: 16,
        flex: "none",
        color: c.textSubtle
      }
    },
    lastMessageUnread: {
      color: theme.palette.text.primary,
      fontWeight: 600
    },
    voiceIcon: {
      color: `${c.primary} !important`
    },
    unreadBadge: {
      flex: "none",
      backgroundColor: c.primary,
      color: theme.palette.primary.contrastText,
      fontWeight: 700,
      fontSize: "0.7rem",
      minWidth: 20,
      height: 20,
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 6px"
    },

    // Painel Direito
    rightPanel: {
      flex: 1,
      minWidth: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 16,
      boxShadow: c.shadow,
      position: "relative",
      overflow: "hidden",
      [theme.breakpoints.down("sm")]: {
        borderRadius: 0,
        border: "none"
      }
    },
    rightPanelHiddenOnMobile: {
      [theme.breakpoints.down("sm")]: {
        display: "none"
      }
    },

    chatArea: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      width: "100%",
      overflow: "hidden",
      position: "relative"
    },

    // Header do Chat Ativo
    chatHeader: {
      minHeight: 68,
      padding: theme.spacing(1.25, 2),
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: c.surface,
      borderBottom: `1px solid ${c.border}`,
      zIndex: 10
    },
    chatHeaderContact: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      overflow: "hidden",
      minWidth: 0
    },
    chatHeaderText: {
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    },
    chatHeaderPhone: {
      fontSize: "0.98rem",
      fontWeight: 700,
      letterSpacing: "-0.01em",
      color: theme.palette.text.primary,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    chatHeaderSubtext: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: "0.75rem",
      color: c.textMuted,
      "& svg": { fontSize: 14, color: c.textSubtle }
    },

    messagesContainer: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
      height: "calc(100% - 68px)"
    },

    // Tela de Boas-Vindas
    welcomeScreen: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      textAlign: "center",
      ...c.dotGrid
    },
    welcomeIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 24,
      display: "grid",
      placeItems: "center",
      backgroundColor: c.primarySoft,
      color: c.primary,
      marginBottom: 24,
      boxShadow: `0 0 0 8px ${alpha(c.primary, isDark ? 0.06 : 0.05)}`
    },
    welcomeIcon: {
      fontSize: 44
    },
    welcomeTitle: {
      fontSize: "1.45rem",
      fontWeight: 750,
      letterSpacing: "-0.02em",
      color: theme.palette.text.primary,
      marginBottom: 8
    },
    welcomeSubtitle: {
      fontSize: "0.9rem",
      color: c.textMuted,
      maxWidth: 460,
      lineHeight: 1.6,
      "& strong": { color: theme.palette.text.primary }
    },

    emptyState: {
      padding: 32,
      textAlign: "center",
      color: c.textMuted
    },
    loadingWrap: {
      padding: 24,
      textAlign: "center"
    }
  };
});

const OperatorChat = () => {
  const classes = useStyles();
  const history = useHistory();
  const { ticketId } = useParams();
  const { user, handleLogout } = useContext(AuthContext);
  const { darkMode, toggleTheme } = useThemeContext();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParam, setSearchParam] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activeDeviceName, setActiveDeviceName] = useState(
    user?.whatsapp?.name || "Aparelho Conectado"
  );

  // Busca e atualização de nome do dispositivo
  useEffect(() => {
    if (user?.whatsapp?.name) {
      setActiveDeviceName(user.whatsapp.name);
    } else if (user?.whatsappId) {
      api
        .get(`/whatsapp/${user.whatsappId}`)
        .then(({ data }) => {
          if (data?.name) setActiveDeviceName(data.name);
        })
        .catch(() => {});
    }
  }, [user]);

  // Carregamento de tickets do operador
  const fetchTickets = useCallback(
    async (reset = false, customPage = 1) => {
      setLoading(true);
      try {
        const { data } = await api.get("/tickets", {
          params: {
            searchParam,
            pageNumber: customPage,
            showAll: "true"
          }
        });

        setTickets((prev) => {
          if (reset || customPage === 1) {
            return data.tickets;
          }
          const existingIds = new Set(prev.map((t) => t.id));
          const newOnes = data.tickets.filter((t) => !existingIds.has(t.id));
          return [...prev, ...newOnes];
        });

        setHasMore(data.hasMore);
      } catch (err) {
        toastError(err);
      } finally {
        setLoading(false);
      }
    },
    [searchParam]
  );

  // Efeito de busca com debounce
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setPageNumber(1);
      fetchTickets(true, 1);
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchParam, fetchTickets]);

  // Detalhes do ticket selecionado
  useEffect(() => {
    if (!ticketId) {
      setSelectedTicket(null);
      return;
    }

    let isSubscribed = true;
    api
      .get(`/tickets/${ticketId}`)
      .then(({ data }) => {
        if (isSubscribed) {
          setSelectedTicket(data);
          // Zera contador de não lidas localmente
          setTickets((prev) =>
            prev.map((t) => (t.id === +ticketId ? { ...t, unreadMessages: 0 } : t))
          );
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          toastError(err);
          history.push("/live");
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [ticketId, history]);

  // Sockets em tempo real
  useEffect(() => {
    const socket = openSocket();
    socket.emit("joinNotification");

    socket.on("appMessage", (data) => {
      if (data.action === "create" || data.action === "update") {
        const message = data.message;
        const ticket = data.ticket;

        if (ticket && (!user?.whatsappId || ticket.whatsappId === user.whatsappId)) {
          setTickets((prev) => {
            const isCurrentChat = ticketId && +ticketId === ticket.id;
            const existing = prev.find((t) => t.id === ticket.id);

            const updatedTicket = {
              ...(existing || ticket),
              ...ticket,
              lastMessage: message.body,
              updatedAt: message.createdAt || new Date().toISOString(),
              unreadMessages: isCurrentChat
                ? 0
                : (existing ? existing.unreadMessages + 1 : 1)
            };

            const rest = prev.filter((t) => t.id !== ticket.id);
            return [updatedTicket, ...rest];
          });
        }
      }
    });

    socket.on("ticket", (data) => {
      if (data.action === "update") {
        const ticket = data.ticket;
        if (ticket && (!user?.whatsappId || ticket.whatsappId === user.whatsappId)) {
          setTickets((prev) => {
            const idx = prev.findIndex((t) => t.id === ticket.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...ticket };
              return copy;
            }
            return [ticket, ...prev];
          });
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.whatsappId, ticketId]);

  const handleSelectTicket = (id) => {
    history.push(`/live/${id}`);
  };

  const handleBackToList = () => {
    history.push("/live");
  };

  const handleScrollChatList = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 50 && hasMore && !loading) {
      const nextPage = pageNumber + 1;
      setPageNumber(nextPage);
      fetchTickets(false, nextPage);
    }
  };

  const renderLastMessageSnippet = (ticket) => {
    const last = ticket.lastMessage;
    if (!last) return "Sem mensagens";
    if (last.endsWith(".mp3") || last.endsWith(".ogg") || last.endsWith(".wav")) {
      return (
        <>
          <MicIcon className={classes.voiceIcon} />
          <span>Mensagem de voz</span>
        </>
      );
    }
    if (
      last.endsWith(".png") ||
      last.endsWith(".jpg") ||
      last.endsWith(".jpeg") ||
      last.endsWith(".webp")
    ) {
      return (
        <>
          <PhotoCameraIcon />
          <span>Foto</span>
        </>
      );
    }
    if (last.endsWith(".pdf") || last.endsWith(".docx") || last.endsWith(".zip")) {
      return (
        <>
          <FileIcon />
          <span>Documento</span>
        </>
      );
    }
    return <span>{last}</span>;
  };

  // Ticket ativo imediato
  const activeTicket = selectedTicket || tickets.find((t) => t.id === +(ticketId || 0));

  return (
    <div className={classes.root}>
      {/* PAINEL ESQUERDO: LISTA DE CONVERSAS */}
      <div
        className={clsx(classes.leftPanel, {
          [classes.leftPanelHiddenOnMobile]: Boolean(ticketId)
        })}
      >
        {/* Topo do Operador */}
        <div className={classes.leftHeader}>
          <div className={classes.operatorInfo}>
            <Avatar className={classes.deviceAvatar}>
              <SmartphoneIcon />
            </Avatar>
            <div className={classes.deviceTextWrapper}>
              <Typography className={classes.deviceName}>
                {activeDeviceName}
              </Typography>
              <div className={classes.deviceStatus}>
                <span className={classes.statusDot} />
                <span>Conectado</span>
              </div>
            </div>
          </div>
          <div className={classes.headerActions}>
            <Tooltip title={darkMode ? "Modo Claro" : "Modo Escuro"} arrow>
              <IconButton size="small" onClick={toggleTheme} style={{ padding: 8 }}>
                {darkMode ? (
                  <Brightness7Icon fontSize="small" />
                ) : (
                  <Brightness4Icon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Sair da Conta" arrow>
              <IconButton
                size="small"
                onClick={handleLogout}
                style={{ padding: 8 }}
                className={classes.logoutButton}
              >
                <ExitToAppIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {/* Campo de Pesquisa */}
        <div className={classes.searchContainer}>
          <div className={classes.searchBox}>
            <SearchIcon className={classes.searchIcon} />
            <InputBase
              placeholder="Buscar conversa ou telefone..."
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              className={classes.searchInput}
            />
            {searchParam && (
              <IconButton size="small" onClick={() => setSearchParam("")}>
                <ClearIcon style={{ fontSize: 18 }} />
              </IconButton>
            )}
          </div>
        </div>

        {/* Lista Contínua de Conversas */}
        <div className={classes.chatListWrapper} onScroll={handleScrollChatList}>
          {tickets.map((t) => {
            const isSelected = ticketId && +ticketId === t.id;
            const displayName = getContactDisplayName(t.contact);
            const isPending = isPendingResolution(displayName);

            return (
              <div
                key={t.id}
                className={clsx(classes.chatItem, {
                  [classes.chatItemSelected]: isSelected
                })}
                onClick={() => handleSelectTicket(t.id)}
              >
                <Avatar
                  src={t.contact?.profilePicUrl}
                  className={classes.contactAvatar}
                >
                  {!t.contact?.profilePicUrl &&
                    (t.contact?.name ? t.contact.name.charAt(0).toUpperCase() : "#")}
                </Avatar>

                <div className={classes.chatContent}>
                  <div className={classes.chatRowTop}>
                    <Typography className={classes.contactPhone}>
                      {displayName}
                    </Typography>
                    {t.updatedAt && (
                      <span
                        className={clsx(classes.chatTimestamp, {
                          [classes.chatTimestampUnread]:
                            t.unreadMessages > 0 && !isSelected
                        })}
                      >
                        {isSameDay(parseISO(t.updatedAt), new Date())
                          ? format(parseISO(t.updatedAt), "HH:mm")
                          : format(parseISO(t.updatedAt), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>

                  <div className={classes.chatRowBottom}>
                    <div
                      className={clsx(classes.lastMessagePreview, {
                        [classes.lastMessageUnread]:
                          t.unreadMessages > 0 && !isSelected
                      })}
                    >
                      {renderLastMessageSnippet(t)}
                    </div>
                    {t.unreadMessages > 0 && !isSelected && (
                      <span className={classes.unreadBadge}>
                        {t.unreadMessages}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {tickets.length === 0 && !loading && (
            <div className={classes.emptyState}>
              <Typography variant="body2">
                Nenhuma conversa encontrada neste aparelho.
              </Typography>
            </div>
          )}

          {loading && (
            <div className={classes.loadingWrap}>
              <CircularProgress size={28} color="primary" />
            </div>
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: ÁREA DE CHAT OU BOAS-VINDAS */}
      <div
        className={clsx(classes.rightPanel, {
          [classes.rightPanelHiddenOnMobile]: !Boolean(ticketId)
        })}
      >
        {ticketId ? (
          <div className={classes.chatArea}>
            {/* Header do Chat Selecionado */}
            <div className={classes.chatHeader}>
              <div className={classes.chatHeaderContact}>
                <Hidden mdUp>
                  <IconButton
                    size="small"
                    onClick={handleBackToList}
                    style={{ marginRight: 4 }}
                  >
                    <ArrowBackIcon />
                  </IconButton>
                </Hidden>
                <Avatar
                  src={activeTicket?.contact?.profilePicUrl}
                  className={classes.contactAvatar}
                >
                  {!activeTicket?.contact?.profilePicUrl &&
                    (activeTicket?.contact?.name
                      ? activeTicket.contact.name.charAt(0).toUpperCase()
                      : "#")}
                </Avatar>
                <div className={classes.chatHeaderText}>
                  <Typography className={classes.chatHeaderPhone}>
                    {getContactDisplayName(activeTicket?.contact)}
                  </Typography>
                  <Typography component="span" className={classes.chatHeaderSubtext}>
                    <SmartphoneIcon />
                    {activeDeviceName}
                  </Typography>
                </div>
              </div>
            </div>

            {/* Lista de Mensagens e Barra de Digitação */}
            <div className={classes.messagesContainer}>
              <ReplyMessageProvider>
                <MessagesList
                  ticketId={ticketId}
                  isGroup={activeTicket?.isGroup}
                />
                <MessageInput ticketStatus="open" />
              </ReplyMessageProvider>
            </div>
          </div>
        ) : (
          /* Tela de Boas-Vindas */
          <div className={classes.welcomeScreen}>
            <div className={classes.welcomeIconWrap}>
              <ForumIcon className={classes.welcomeIcon} />
            </div>
            <Typography className={classes.welcomeTitle}>
              VERITAS WhatsApp Web
            </Typography>
            <Typography className={classes.welcomeSubtitle}>
              Você está conectado ao smartphone{" "}
              <strong>{activeDeviceName}</strong>. Selecione uma conversa na
              lista ao lado para visualizar e enviar mensagens em tempo real.
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorChat;
