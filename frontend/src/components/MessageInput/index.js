import React, { useState, useEffect, useContext, useRef } from "react";
import "emoji-mart/css/emoji-mart.css";
import { useParams } from "react-router-dom";
import { Picker } from "emoji-mart";
import clsx from "clsx";

import { makeStyles, alpha, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import InsertDriveFileOutlinedIcon from "@material-ui/icons/InsertDriveFileOutlined";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import IconButton from "@material-ui/core/IconButton";
import MoreVert from "@material-ui/icons/MoreVert";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import CancelIcon from "@material-ui/icons/Cancel";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import {
  FormControlLabel,
  Hidden,
  Menu,
  MenuItem,
  Switch,
} from "@material-ui/core";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import RecordingTimer from "./RecordingTimer";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import toastError from "../../errors/toastError";

let Mp3Recorder = null;

const initRecorder = async () => {
  if (!Mp3Recorder) {
    try {
      const MicRecorder = (await import("mic-recorder-to-mp3")).default;
      Mp3Recorder = new MicRecorder({ bitRate: 128 });
    } catch (error) {
      console.error("Failed to initialize recorder:", error);
      return null;
    }
  }
  return Mp3Recorder;
};

const useStyles = makeStyles(theme => {
  const c = theme.custom;
  return {
    mainWrapper: {
      position: "relative",
      background: c.surface,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      borderTop: `1px solid ${c.border}`,
      padding: theme.spacing(1.25, 1.5),
      [theme.breakpoints.down("sm")]: {
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        zIndex: 2,
        padding: theme.spacing(1),
      },
    },

    newMessageBox: {
      width: "100%",
      display: "flex",
      alignItems: "flex-end",
      gap: 2,
      padding: 4,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      transition: "border-color .15s, box-shadow .15s",
      "&:focus-within": {
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 3px ${c.primarySoft}`,
      },
    },

    messageInputWrapper: {
      padding: "8px 6px",
      display: "flex",
      flex: 1,
      minWidth: 0,
      position: "relative",
      alignSelf: "center",
    },

    messageInput: {
      paddingLeft: 4,
      flex: 1,
      border: "none",
      fontSize: "0.92rem",
      lineHeight: 1.45,
      color: c.text,
    },

    sendMessageIcons: {
      color: c.textMuted,
    },

    iconButton: {
      width: 40,
      height: 40,
      padding: 0,
      borderRadius: 12,
    },

    sendButton: {
      width: 40,
      height: 40,
      padding: 0,
      borderRadius: 12,
      color: theme.palette.primary.contrastText,
      backgroundColor: theme.palette.primary.main,
      boxShadow: `0 4px 12px -4px ${alpha(theme.palette.primary.main, 0.6)}`,
      "&:hover": { backgroundColor: theme.palette.primary.dark },
      "&.Mui-disabled": {
        color: theme.palette.primary.contrastText,
        backgroundColor: alpha(theme.palette.primary.main, 0.45),
      },
    },

    sendIcon: {
      fontSize: 19,
      color: "inherit",
    },

    uploadInput: {
      display: "none",
    },

    signLabel: {
      marginLeft: 4,
      marginRight: 8,
      alignSelf: "center",
      "& .MuiFormControlLabel-label": {
        fontSize: "0.76rem",
        fontWeight: 600,
        color: c.textMuted,
        whiteSpace: "nowrap",
      },
    },

    viewMediaInputWrapper: {
      display: "flex",
      gap: theme.spacing(1),
      padding: theme.spacing(1.25, 1.5),
      position: "relative",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.surface,
      borderTop: `1px solid ${c.border}`,
    },

    mediaFile: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px",
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      color: c.text,
      fontSize: "0.86rem",
      fontWeight: 500,
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis",
      "& svg": { fontSize: 18, color: theme.palette.primary.main, flex: "none" },
    },

    emojiBox: {
      position: "absolute",
      bottom: "calc(100% + 6px)",
      left: 12,
      zIndex: 10,
      "& .emoji-mart": {
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        boxShadow: c.shadowLg,
      },
    },

    circleLoading: {
      color: theme.palette.primary.main,
      opacity: "80%",
      position: "absolute",
      top: "20%",
      left: "50%",
      marginLeft: -12,
    },

    audioLoading: {
      color: theme.palette.primary.main,
      opacity: "80%",
    },

    recorderWrapper: {
      display: "flex",
      alignItems: "center",
      alignContent: "middle",
      gap: 2,
      padding: "0 2px 0 4px",
      borderRadius: 12,
      color: theme.palette.error.main,
      fontWeight: 600,
      fontVariantNumeric: "tabular-nums",
      backgroundColor: alpha(theme.palette.error.main, 0.08),
    },

    cancelAudioIcon: {
      color: theme.palette.error.main,
    },

    sendAudioIcon: {
      color: theme.palette.success.main,
    },

    replyginMsgWrapper: {
      display: "flex",
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },

    replyginMsgContainer: {
      flex: 1,
      minWidth: 0,
      overflowY: "hidden",
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      display: "flex",
      position: "relative",
      fontSize: "0.84rem",
      color: c.textMuted,
    },

    replyginMsgBody: {
      padding: "8px 12px",
      height: "auto",
      maxHeight: 96,
      display: "block",
      whiteSpace: "pre-wrap",
      overflow: "hidden",
    },

    replyginContactMsgSideColor: {
      flex: "none",
      width: "3px",
      backgroundColor: theme.palette.primary.main,
    },

    replyginSelfMsgSideColor: {
      flex: "none",
      width: "3px",
      backgroundColor: theme.palette.secondary.main,
    },

    messageContactName: {
      display: "flex",
      color: theme.palette.secondary.main,
      fontWeight: 650,
    },

    messageQuickAnswersWrapper: {
      margin: 0,
      position: "absolute",
      bottom: "calc(100% + 10px)",
      left: -6,
      width: "calc(100% + 12px)",
      maxHeight: 260,
      overflowY: "auto",
      background: c.surface,
      padding: 6,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      boxShadow: c.shadowLg,
      zIndex: 10,
      ...theme.scrollbarStyles,
      "& li": {
        listStyle: "none",
        "& a": {
          display: "block",
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: "0.85rem",
          color: c.text,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          overflow: "hidden",
          "&:hover": {
            background: c.surfaceHover,
            cursor: "pointer",
          },
        },
      },
    },
  };
});

const MessageInput = ({ ticketStatus }) => {
  const classes = useStyles();
  const theme = useTheme();
  const { ticketId } = useParams();

  const [medias, setMedias] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [typeBar, setTypeBar] = useState(false);
  const inputRef = useRef();
  const [anchorEl, setAnchorEl] = useState(null);
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);
  const { user } = useContext(AuthContext);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  useEffect(() => {
    inputRef.current.focus();
  }, [replyingMessage]);

  useEffect(() => {
    inputRef.current.focus();
    return () => {
      setInputMessage("");
      setShowEmoji(false);
      setMedias([]);
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage]);

  const handleChangeInput = e => {
    setInputMessage(e.target.value);
    handleLoadQuickAnswer(e.target.value);
  };

  const handleQuickAnswersClick = value => {
    setInputMessage(value);
    setTypeBar(false);
  };

  const handleAddEmoji = e => {
    let emoji = e.native;
    setInputMessage(prevState => prevState + emoji);
  };

  const handleChangeMedias = e => {
    if (!e.target.files) {
      return;
    }

    const selectedMedias = Array.from(e.target.files);
    setMedias(selectedMedias);
  };

  const handleInputPaste = e => {
    if (e.clipboardData.files[0]) {
      setMedias([e.clipboardData.files[0]]);
    }
  };

  const handleUploadMedia = async e => {
    setLoading(true);
    e.preventDefault();

    const formData = new FormData();
    formData.append("fromMe", true);
    medias.forEach(media => {
      formData.append("medias", media);
      formData.append("body", media.name);
    });

    try {
      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setLoading(false);
    setMedias([]);
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;
    setLoading(true);

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${user?.name}:*\n${inputMessage.trim()}`
        : inputMessage.trim(),
      quotedMsg: replyingMessage,
    };
    try {
      await api.post(`/messages/${ticketId}`, message);
    } catch (err) {
      toastError(err);
    }

    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
  };

  const handleStartRecording = async () => {
    setLoading(true);
    try {
      const recorder = await initRecorder();
      if (!recorder) {
        throw new Error("Recorder not available");
      }
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  const handleLoadQuickAnswer = async value => {
    if (value && value.indexOf("/") === 0) {
      try {
        const { data } = await api.get("/quickAnswers/", {
          params: { searchParam: inputMessage.substring(1) },
        });
        setQuickAnswer(data.quickAnswers);
        if (data.quickAnswers.length > 0) {
          setTypeBar(true);
        } else {
          setTypeBar(false);
        }
      } catch (err) {
        setTypeBar(false);
      }
    } else {
      setTypeBar(false);
    }
  };

  const handleUploadAudio = async () => {
    setLoading(true);
    try {
      const recorder = await initRecorder();
      if (!recorder) {
        throw new Error("Recorder not available");
      }
      const [, blob] = await recorder.stop().getMp3();
      if (blob.size < 10000) {
        setLoading(false);
        setRecording(false);
        return;
      }

      const formData = new FormData();
      const filename = `${new Date().getTime()}.mp3`;
      formData.append("medias", blob, filename);
      formData.append("body", filename);
      formData.append("fromMe", true);

      await api.post(`/messages/${ticketId}`, formData);
    } catch (err) {
      toastError(err);
    }

    setRecording(false);
    setLoading(false);
  };

  const handleCancelAudio = async () => {
    try {
      const recorder = await initRecorder();
      if (recorder) {
        await recorder.stop().getMp3();
      }
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenMenuClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = event => {
    setAnchorEl(null);
  };

  const renderReplyingMessage = message => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe,
            })}
          ></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && (
              <span className={classes.messageContactName}>
                {message.contact?.name}
              </span>
            )}
            {message.body}
          </div>
        </div>
        <IconButton
          aria-label="showRecorder"
          component="span"
          disabled={loading || ticketStatus !== "open"}
          onClick={() => setReplyingMessage(null)}
        >
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (medias.length > 0)
    return (
      <Paper elevation={0} square className={classes.viewMediaInputWrapper}>
        <IconButton
          aria-label="cancel-upload"
          component="span"
          onClick={e => setMedias([])}
        >
          <CancelIcon className={classes.sendMessageIcons} />
        </IconButton>

        {loading ? (
          <div>
            <CircularProgress size={24} className={classes.circleLoading} />
          </div>
        ) : (
          <span className={classes.mediaFile}>
            <InsertDriveFileOutlinedIcon />
            {medias[0]?.name}
            {/* <img src={media.preview} alt=""></img> */}
          </span>
        )}
        <IconButton
          aria-label="send-upload"
          component="span"
          className={classes.sendButton}
          onClick={handleUploadMedia}
          disabled={loading}
        >
          <SendIcon className={classes.sendIcon} />
        </IconButton>
      </Paper>
    );
  else {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        <div className={classes.newMessageBox}>
          <Hidden only={["sm", "xs"]}>
            <IconButton
              aria-label="emojiPicker"
              component="span"
              className={classes.iconButton}
              disabled={loading || recording || ticketStatus !== "open"}
              onClick={e => setShowEmoji(prevState => !prevState)}
            >
              <MoodIcon className={classes.sendMessageIcons} />
            </IconButton>
            {showEmoji ? (
              <div className={classes.emojiBox}>
                <ClickAwayListener onClickAway={e => setShowEmoji(false)}>
                  <Picker
                    perLine={16}
                    theme={theme.palette.type === "dark" ? "dark" : "light"}
                    showPreview={false}
                    showSkinTones={false}
                    onSelect={handleAddEmoji}
                  />
                </ClickAwayListener>
              </div>
            ) : null}

            <input
              multiple
              type="file"
              id="upload-button"
              disabled={loading || recording || ticketStatus !== "open"}
              className={classes.uploadInput}
              onChange={handleChangeMedias}
            />
            <label htmlFor="upload-button">
              <IconButton
                aria-label="upload"
                component="span"
                className={classes.iconButton}
                disabled={loading || recording || ticketStatus !== "open"}
              >
                <AttachFileIcon className={classes.sendMessageIcons} />
              </IconButton>
            </label>
            <FormControlLabel
              className={classes.signLabel}
              label={i18n.t("messagesInput.signMessage")}
              labelPlacement="start"
              control={
                <Switch
                  size="small"
                  checked={signMessage}
                  onChange={e => {
                    setSignMessage(e.target.checked);
                  }}
                  name="showAllTickets"
                  color="primary"
                />
              }
            />
          </Hidden>
          <Hidden only={["md", "lg", "xl"]}>
            <IconButton
              aria-controls="simple-menu"
              aria-haspopup="true"
              className={classes.iconButton}
              onClick={handleOpenMenuClick}
            >
              <MoreVert className={classes.sendMessageIcons}></MoreVert>
            </IconButton>
            <Menu
              id="simple-menu"
              keepMounted
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuItemClick}
            >
              <MenuItem onClick={handleMenuItemClick}>
                <IconButton
                  aria-label="emojiPicker"
                  component="span"
                  disabled={loading || recording || ticketStatus !== "open"}
                  onClick={e => setShowEmoji(prevState => !prevState)}
                >
                  <MoodIcon className={classes.sendMessageIcons} />
                </IconButton>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <input
                  multiple
                  type="file"
                  id="upload-button"
                  disabled={loading || recording || ticketStatus !== "open"}
                  className={classes.uploadInput}
                  onChange={handleChangeMedias}
                />
                <label htmlFor="upload-button">
                  <IconButton
                    aria-label="upload"
                    component="span"
                    disabled={loading || recording || ticketStatus !== "open"}
                  >
                    <AttachFileIcon className={classes.sendMessageIcons} />
                  </IconButton>
                </label>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <FormControlLabel
                  className={classes.signLabel}
                  label={i18n.t("messagesInput.signMessage")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={signMessage}
                      onChange={e => {
                        setSignMessage(e.target.checked);
                      }}
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              </MenuItem>
            </Menu>
          </Hidden>
          <div className={classes.messageInputWrapper}>
            <InputBase
              inputRef={input => {
                input && input.focus();
                input && (inputRef.current = input);
              }}
              className={classes.messageInput}
              placeholder={
                ticketStatus === "open"
                  ? i18n.t("messagesInput.placeholderOpen")
                  : i18n.t("messagesInput.placeholderClosed")
              }
              multiline
              maxRows={5}
              value={inputMessage}
              onChange={handleChangeInput}
              disabled={recording || loading || ticketStatus !== "open"}
              onPaste={e => {
                ticketStatus === "open" && handleInputPaste(e);
              }}
              onKeyPress={e => {
                if (loading || e.shiftKey) return;
                else if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
            />
            {typeBar ? (
              <ul className={classes.messageQuickAnswersWrapper}>
                {quickAnswers.map((value, index) => {
                  return (
                    <li
                      className={classes.messageQuickAnswersWrapperItem}
                      key={index}
                    >
                      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                      <a onClick={() => handleQuickAnswersClick(value.message)}>
                        {`${value.shortcut} - ${value.message}`}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div></div>
            )}
          </div>
          {inputMessage ? (
            <IconButton
              aria-label="sendMessage"
              component="span"
              className={classes.sendButton}
              onClick={handleSendMessage}
              disabled={loading}
            >
              <SendIcon className={classes.sendIcon} />
            </IconButton>
          ) : recording ? (
            <div className={classes.recorderWrapper}>
              <IconButton
                aria-label="cancelRecording"
                component="span"
                fontSize="large"
                disabled={loading}
                onClick={handleCancelAudio}
              >
                <HighlightOffIcon className={classes.cancelAudioIcon} />
              </IconButton>
              {loading ? (
                <div>
                  <CircularProgress size={24} className={classes.audioLoading} />
                </div>
              ) : (
                <RecordingTimer />
              )}

              <IconButton
                aria-label="sendRecordedAudio"
                component="span"
                onClick={handleUploadAudio}
                disabled={loading}
              >
                <CheckCircleOutlineIcon className={classes.sendAudioIcon} />
              </IconButton>
            </div>
          ) : (
            <IconButton
              aria-label="showRecorder"
              component="span"
              className={classes.iconButton}
              disabled={loading || ticketStatus !== "open"}
              onClick={handleStartRecording}
            >
              <MicIcon className={classes.sendMessageIcons} />
            </IconButton>
          )}
        </div>
      </Paper>
    );
  }
};

export default MessageInput;
