import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import {
  makeStyles,
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
  const isDark = theme.palette.type === "dark";
  return {
    root: {
      display: "flex",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      backgroundColor: isDark ? "#111b21" : "#f0f2f5",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999
    },

    // Painel Esquerdo (Lista de Conversas)
    leftPanel: {
      width: 420,
      minWidth: 320,
      maxWidth: 480,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      borderRight: `1px solid ${isDark ? "#222d34" : "#e9edef"}`,
      backgroundColor: isDark ? "#111b21" : "#ffffff",
      zIndex: 2,
      [theme.breakpoints.down("sm")]: {
        width: "100%",
        maxWidth: "100%"
      }
    },
    leftPanelHiddenOnMobile: {
      [theme.breakpoints.down("sm")]: {
        display: "none"
      }
    },

    // Header do Operador (topo esquerdo)
    leftHeader: {
      height: 60,
      minHeight: 60,
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isDark ? "#202c33" : "#f0f2f5",
      borderBottom: `1px solid ${isDark ? "#222d34" : "#e9edef"}`
    },
    operatorInfo: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      overflow: "hidden"
    },
    deviceAvatar: {
      backgroundColor: "#25d366",
      color: "#ffffff",
      width: 40,
      height: 40
    },
    deviceTextWrapper: {
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      marginLeft: 10
    },
    deviceName: {
      fontSize: "0.95rem",
      fontWeight: 600,
      color: isDark ? "#e9edef" : "#111b21",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    deviceStatus: {
      fontSize: "0.75rem",
      color: "#25d366",
      fontWeight: 500,
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 2
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      backgroundColor: "#25d366",
      boxShadow: "0 0 6px #25d366",
      display: "inline-block",
      marginRight: 4
    },
    headerActions: {
      display: "flex",
      alignItems: "center",
      gap: 4
    },

    // Barra de Busca
    searchContainer: {
      padding: "8px 12px",
      backgroundColor: isDark ? "#111b21" : "#ffffff",
      borderBottom: `1px solid ${isDark ? "#222d34" : "#e9edef"}`
    },
    searchBox: {
      display: "flex",
      alignItems: "center",
      backgroundColor: isDark ? "#202c33" : "#f0f2f5",
      borderRadius: 8,
      padding: "4px 12px",
      height: 38
    },
    searchInput: {
      marginLeft: 8,
      flex: 1,
      fontSize: "0.875rem",
      color: isDark ? "#d1d7db" : "#3b4a54"
    },
    searchIcon: {
      color: isDark ? "#8696a0" : "#54656f",
      fontSize: 20
    },

    // Lista de Conversas
    chatListWrapper: {
      flex: 1,
      overflowY: "auto",
      ...theme.scrollbarStyles
    },
    chatItem: {
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      cursor: "pointer",
      borderBottom: `1px solid ${isDark ? "#222d34" : "#f5f6f6"}`,
      transition: "background-color 0.15s ease",
      "&:hover": {
        backgroundColor: isDark ? "#202c33" : "#f5f6f6"
      }
    },
    chatItemSelected: {
      backgroundColor: isDark ? "#2a3942 !important" : "#e9edef !important"
    },
    contactAvatar: {
      width: 48,
      height: 48,
      marginRight: 14,
      backgroundColor: isDark ? "#374248" : "#dfe5e7",
      color: isDark ? "#aebac1" : "#54656f",
      fontWeight: 600
    },
    chatContent: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 3
    },
    chatRowTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    },
    contactPhone: {
      fontSize: "0.95rem",
      fontWeight: 600,
      color: isDark ? "#e9edef" : "#111b21",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    },
    chatTimestamp: {
      fontSize: "0.75rem",
      color: isDark ? "#8696a0" : "#667781",
      whiteSpace: "nowrap",
      marginLeft: 8
    },
    chatRowBottom: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 6
    },
    lastMessagePreview: {
      fontSize: "0.825rem",
      color: isDark ? "#8696a0" : "#667781",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      flex: 1,
      display: "flex",
      alignItems: "center",
      gap: 4
    },
    unreadBadge: {
      backgroundColor: "#25d366",
      color: "#ffffff",
      fontWeight: 700,
      fontSize: "0.725rem",
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 6px"
    },

    // Painel Direito
    rightPanel: {
      flex: 1,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: isDark ? "#0b141a" : "#efeae2",
      position: "relative",
      overflow: "hidden"
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
      height: 60,
      minHeight: 60,
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: isDark ? "#202c33" : "#f0f2f5",
      borderBottom: `1px solid ${isDark ? "#222d34" : "#e9edef"}`,
      zIndex: 10
    },
    chatHeaderContact: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      overflow: "hidden"
    },
    chatHeaderPhone: {
      fontSize: "1rem",
      fontWeight: 600,
      color: isDark ? "#e9edef" : "#111b21"
    },
    chatHeaderSubtext: {
      fontSize: "0.75rem",
      color: isDark ? "#8696a0" : "#667781"
    },

    messagesContainer: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
      height: "calc(100% - 60px)"
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
      backgroundColor: isDark ? "#222e35" : "#f0f2f5",
      borderBottom: `6px solid #25d366`
    },
    welcomeIcon: {
      fontSize: 80,
      color: isDark ? "#3b4a54" : "#aebac1",
      marginBottom: 24
    },
    welcomeTitle: {
      fontSize: "1.75rem",
      fontWeight: 300,
      color: isDark ? "#e9edef" : "#41525d",
      marginBottom: 12
    },
    welcomeSubtitle: {
      fontSize: "0.925rem",
      color: isDark ? "#8696a0" : "#667781",
      maxWidth: 460,
      lineHeight: 1.6
    },

    emptyState: {
      padding: 32,
      textAlign: "center",
      color: isDark ? "#8696a0" : "#667781"
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
          <MicIcon style={{ fontSize: 16, color: "#25d366" }} />
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
          <PhotoCameraIcon style={{ fontSize: 16 }} />
          <span>Foto</span>
        </>
      );
    }
    if (last.endsWith(".pdf") || last.endsWith(".docx") || last.endsWith(".zip")) {
      return (
        <>
          <FileIcon style={{ fontSize: 16 }} />
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
                  <Brightness7Icon style={{ color: "#e9edef" }} />
                ) : (
                  <Brightness4Icon style={{ color: "#54656f" }} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title="Sair da Conta" arrow>
              <IconButton size="small" onClick={handleLogout} style={{ padding: 8 }}>
                <ExitToAppIcon style={{ color: "#f15c6d" }} />
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
                      {isPending ? (
                        <Tooltip arrow title={PENDING_TOOLTIP}>
                          <span
                            style={{
                              cursor: "help",
                              color: "#8696a0",
                              fontStyle: "italic"
                            }}
                          >
                            Nº pendente{" "}
                            <span style={{ fontWeight: 700, color: "#aebac1" }}>
                              (?)
                            </span>
                          </span>
                        </Tooltip>
                      ) : (
                        displayName
                      )}
                    </Typography>
                    {t.updatedAt && (
                      <span className={classes.chatTimestamp}>
                        {isSameDay(parseISO(t.updatedAt), new Date())
                          ? format(parseISO(t.updatedAt), "HH:mm")
                          : format(parseISO(t.updatedAt), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>

                  <div className={classes.chatRowBottom}>
                    <div className={classes.lastMessagePreview}>
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
            <div style={{ padding: 24, textAlign: "center" }}>
              <CircularProgress size={28} style={{ color: "#25d366" }} />
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
                    style={{ marginRight: 8 }}
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
                <div>
                  <Typography className={classes.chatHeaderPhone}>
                    {isPendingResolution(getContactDisplayName(activeTicket?.contact)) ? (
                      <Tooltip arrow title={PENDING_TOOLTIP}>
                        <span
                          style={{
                            cursor: "help",
                            color: "#8696a0",
                            fontStyle: "italic"
                          }}
                        >
                          Nº pendente{" "}
                          <span style={{ fontWeight: 700, color: "#aebac1" }}>
                            (?)
                          </span>
                        </span>
                      </Tooltip>
                    ) : (
                      getContactDisplayName(activeTicket?.contact)
                    )}
                  </Typography>
                  <Typography className={classes.chatHeaderSubtext}>
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
            <ForumIcon className={classes.welcomeIcon} />
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
