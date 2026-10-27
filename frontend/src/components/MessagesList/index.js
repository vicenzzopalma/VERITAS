import React, { useState, useEffect, useReducer, useRef } from "react";

import { isSameDay, parseISO, format } from "date-fns";
import openSocket from "../../services/socket-io";
import clsx from "clsx";

import { alpha } from "@material-ui/core/styles";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  makeStyles,
  Tooltip,
} from "@material-ui/core";
import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
} from "@material-ui/icons";

import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import Audio from "../Audio";
import MediaViewerModal from "../MediaViewerModal";
import PictureAsPdfIcon from "@material-ui/icons/PictureAsPdf";
import { getContactDisplayName, formatPhoneNumber, isPendingResolution, PENDING_TOOLTIP } from "../../helpers/contactHelper";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  const isDark = theme.palette.type === "dark";
  const bubbleBase = {
    marginTop: 3,
    minWidth: 100,
    maxWidth: "min(600px, 78%)",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 2,
      right: 2,
    },
    whiteSpace: "pre-wrap",
    color: c.text,
    fontSize: "0.9rem",
    lineHeight: 1.45,
    borderRadius: 14,
    padding: "6px 6px 0",
    boxShadow: isDark ? "none" : "0 1px 1px rgba(16,24,40,0.04)",
  };

  return {
    messagesListWrapper: {
      overflow: "hidden",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      minHeight: 0,
    },

    messagesList: {
      ...c.dotGrid,
      display: "flex",
      flexDirection: "column",
      flexGrow: 1,
      padding: "20px 24px",
      overflowY: "scroll",
      [theme.breakpoints.down("sm")]: {
        padding: "16px 12px",
        paddingBottom: "90px",
      },
      ...theme.scrollbarStyles,
    },

    circleLoading: {
      color: theme.palette.primary.main,
      position: "absolute",
      opacity: "80%",
      top: 0,
      left: "50%",
      marginTop: 12,
      marginLeft: -16,
    },

    messageLeft: {
      ...bubbleBase,
      marginRight: 20,
      alignSelf: "flex-start",
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      borderTopLeftRadius: 4,
    },

    quotedContainerLeft: {
      margin: "-2px -72px 6px -4px",
      overflow: "hidden",
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      display: "flex",
      position: "relative",
      fontSize: "0.82rem",
      color: c.textMuted,
    },

    quotedMsg: {
      padding: "8px 10px",
      maxWidth: 300,
      height: "auto",
      display: "block",
      whiteSpace: "pre-wrap",
      overflow: "hidden",
    },

    quotedSideColorLeft: {
      flex: "none",
      width: "3px",
      backgroundColor: theme.palette.secondary.main,
    },

    messageRight: {
      ...bubbleBase,
      marginLeft: 20,
      alignSelf: "flex-end",
      backgroundColor: c.primarySoft,
      border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.28 : 0.16)}`,
      borderTopRightRadius: 4,
    },

    quotedContainerRight: {
      margin: "-2px -72px 6px -4px",
      overflowY: "hidden",
      backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.07),
      borderColor: "transparent",
      borderRadius: 10,
      display: "flex",
      position: "relative",
    },

    quotedMsgRight: {
      padding: 10,
      maxWidth: 300,
      height: "auto",
      whiteSpace: "pre-wrap",
    },

    quotedSideColorRight: {
      flex: "none",
      width: "3px",
      backgroundColor: theme.palette.primary.main,
    },

    messageActionsButton: {
      display: "none",
      position: "relative",
      color: c.textSubtle,
      zIndex: 1,
      padding: 2,
      borderRadius: 8,
      backgroundColor: "inherit",
      opacity: "95%",
      "&:hover, &.Mui-focusVisible": {
        backgroundColor: "inherit",
        color: c.text,
      },
    },

    messageContactName: {
      display: "flex",
      color: theme.palette.secondary.main,
      fontWeight: 650,
      fontSize: "0.8rem",
      paddingLeft: 4,
    },

    textContentItem: {
      overflowWrap: "break-word",
      padding: "2px 72px 8px 4px",
    },

    textContentItemDeleted: {
      fontStyle: "italic",
      color: c.textSubtle,
      overflowWrap: "break-word",
      padding: "2px 72px 8px 4px",
    },

    messageMedia: {
      objectFit: "cover",
      width: 250,
      height: 200,
      borderRadius: 10,
    },

    timestamp: {
      fontSize: 11,
      fontWeight: 500,
      position: "absolute",
      bottom: 5,
      right: 8,
      display: "inline-flex",
      alignItems: "center",
      color: c.textSubtle,
      letterSpacing: "0.01em",
    },

    dailyTimestamp: {
      display: "flex",
      alignItems: "center",
      alignSelf: "center",
      margin: "14px 0 8px",
      padding: "3px 12px",
      borderRadius: 999,
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      boxShadow: c.shadow,
    },

    dailyTimestampText: {
      color: c.textMuted,
      fontSize: "0.72rem",
      fontWeight: 650,
      letterSpacing: "0.02em",
    },

    ackIcons: {
      fontSize: 15,
      verticalAlign: "middle",
      marginLeft: 4,
      color: c.textSubtle,
    },

    deletedIcon: {
      fontSize: 16,
      verticalAlign: "middle",
      marginRight: 4,
    },

    ackDoneAllIcon: {
      // "read" ack keeps the familiar WhatsApp-like green
      color: theme.palette.success.main,
      fontSize: 15,
      verticalAlign: "middle",
      marginLeft: 4,
    },

    downloadMedia: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "inherit",
      padding: 10,
    },

    pdfCard: {
      backgroundColor: c.surface,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      overflow: "hidden",
      marginTop: 6,
      marginBottom: 6,
      cursor: "pointer",
      transition: "border-color .15s, box-shadow .15s",
      maxWidth: 320,
      width: "100%",
      boxShadow: c.shadow,
      "&:hover": {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 3px ${c.primarySoft}`,
      },
    },
    pdfCardHeader: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      backgroundColor: c.surfaceAlt,
      borderBottom: `1px solid ${c.border}`,
    },
    pdfIcon: {
      flex: "none",
      width: 34,
      height: 34,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      color: theme.palette.error.main,
      backgroundColor: alpha(theme.palette.error.main, isDark ? 0.16 : 0.1),
      "& svg": { fontSize: 20 },
    },
    pdfMeta: { overflow: "hidden", flexGrow: 1, minWidth: 0 },
    pdfTitle: {
      fontWeight: 600,
      fontSize: "0.82rem",
      color: c.text,
      display: "block",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    pdfSubtitle: { color: c.textMuted, fontSize: "0.72rem", display: "block" },
    pdfPreviewWrapper: {
      position: "relative",
      height: 160,
      width: "100%",
      backgroundColor: c.surfaceHover,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    pdfMiniIframe: {
      width: "100%",
      height: "100%",
      border: "none",
      pointerEvents: "none",
    },
    pdfOverlayHover: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15,18,34,0.08)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background .2s ease",
      "& $pdfOverlayLabel": { opacity: 0.9, transition: "opacity .2s" },
      "&:hover": {
        backgroundColor: "rgba(15,18,34,0.38)",
        "& $pdfOverlayLabel": { opacity: 1 },
      },
    },
    pdfOverlayLabel: {
      color: "#FFFFFF",
      fontWeight: 650,
      backgroundColor: "rgba(15,18,34,0.7)",
      padding: "4px 12px",
      borderRadius: 999,
      fontSize: "0.75rem",
    },
  };
});

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const MessagesList = ({ ticketId, isGroup }) => {
  const classes = useStyles();

  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef();

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [activeMedia, setActiveMedia] = useState({ url: "", type: "", title: "" });

  const handleOpenMediaModal = (url, type, title) => {
    setActiveMedia({ url, type, title });
    setMediaModalOpen(true);
  };

  const handleCloseMediaModal = () => {
    setMediaModalOpen(false);
    setActiveMedia({ url: "", type: "", title: "" });
  };

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);

    currentTicketId.current = ticketId;
  }, [ticketId]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: { pageNumber },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
          }

          if (pageNumber === 1 && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", () => socket.emit("joinChatBox", ticketId));

    socket.on("appMessage", (data) => {
      if (data.action === "create") {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        scrollToBottom();
      }

      if (data.action === "update") {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId]);

  const loadMore = () => {
    setPageNumber((prevPageNumber) => prevPageNumber + 1);
  };

  const scrollToBottom = () => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({});
    }
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const checkMessageMedia = (message) => {
    if (message.mediaType === "location" && message.body.split('|').length >= 2) {
      let locationParts = message.body.split('|')
      let imageLocation = locationParts[0]
      let linkLocation = locationParts[1]

      let descriptionLocation = null

      if (locationParts.length > 2)
        descriptionLocation = message.body.split('|')[2]

      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />
    }
    else if (message.mediaType === "vcard") {
      //console.log("vcard")
      //console.log(message)
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0]?.number} />
    }
    /*else if (message.mediaType === "multi_vcard") {
      console.log("multi_vcard")
      console.log(message)
    	
      if(message.body !== null && message.body !== "") {
        let newBody = JSON.parse(message.body)
        return (
          <>
            {
            newBody.map(v => (
              <VcardPreview contact={v.name} numbers={v.number} />
            ))
            }
          </>
        )
      } else return (<></>)
    }*/
    else if ( /^.*\.(jpe?g|png|gif|webp)?$/i.exec(message.mediaUrl) && message.mediaType === "image") {
      return <ModalImageCors imageUrl={message.mediaUrl} />;
    } else if (message.mediaType === "audio") {
      return <Audio url={message.mediaUrl} />
    } else if (message.mediaType === "video") {
      return (
        <video
          className={classes.messageMedia}
          src={message.mediaUrl}
          controls
          onClick={() => handleOpenMediaModal(message.mediaUrl, "video", message.body)}
        />
      );
    } else if (message.mediaUrl && message.mediaUrl.toLowerCase().includes(".pdf")) {
      return (
        <div
          className={classes.pdfCard}
          onClick={() => handleOpenMediaModal(message.mediaUrl, "application/pdf", message.body)}
        >
          <div className={classes.pdfCardHeader}>
            <span className={classes.pdfIcon}>
              <PictureAsPdfIcon />
            </span>
            <div className={classes.pdfMeta}>
              <span className={classes.pdfTitle}>
                {message.body && message.body !== message.mediaUrl ? message.body : message.mediaUrl.split("/").pop()}
              </span>
              <span className={classes.pdfSubtitle}>
                Documento PDF • Clique para expandir
              </span>
            </div>
          </div>
          <div className={classes.pdfPreviewWrapper}>
            <iframe
              src={`${message.mediaUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title="PDF Preview"
              className={classes.pdfMiniIframe}
            />
            <div className={classes.pdfOverlayHover}>
              <span className={classes.pdfOverlayLabel}>
                🔍 Visualizar em Popup
              </span>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              color="primary"
              variant="outlined"
              onClick={() => handleOpenMediaModal(message.mediaUrl, message.mediaType, message.body)}
            >
              {message.body && message.body !== message.mediaUrl ? message.body : "Visualizar Arquivo"}
            </Button>
          </div>
          <Divider />
        </>
      );
    }
  };

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3 || message.ack === 4) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
  };

  const renderDailyTimestamps = (message, index) => {
    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    }
    if (index < messagesList.length - 1) {
      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
    if (index === messagesList.length - 1) {
      return (
        <div
          key={`ref-${message.createdAt}`}
          ref={lastMessageRef}
          style={{ float: "left", clear: "both" }}
        />
      );
    }
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 12 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}
          {message.quotedMsg?.body}
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageLeft}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {getContactDisplayName(message.contact)}
                  </span>
                )}
                {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard"
                  //|| message.mediaType === "multi_vcard" 
                ) && checkMessageMedia(message)}
                <div className={classes.textContentItem}>
                  {message.quotedMsg && renderQuotedMessage(message)}
                  <MarkdownWrapper>{message.body}</MarkdownWrapper>
                  <span className={classes.timestamp}>
                    {format(parseISO(message.createdAt), "HH:mm")}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageRight}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard"
                  //|| message.mediaType === "multi_vcard" 
                ) && checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >
                  {message.isDeleted && (
                    <Block
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  <MarkdownWrapper>{message.body}</MarkdownWrapper>
                  <span className={classes.timestamp}>
                    {format(parseISO(message.createdAt), "HH:mm")}
                    {renderMessageAck(message)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>Say hello to your new contact!</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />
      <MediaViewerModal
        open={mediaModalOpen}
        onClose={handleCloseMediaModal}
        mediaUrl={activeMedia.url}
        mediaType={activeMedia.type}
        title={activeMedia.title}
      />
      <div
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {messagesList.length > 0 ? renderMessages() : []}
      </div>
      {loading && (
        <div>
          <CircularProgress size={32} className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

export default MessagesList;