import React, { useState, useContext } from "react";

import MenuItem from "@material-ui/core/MenuItem";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import { Menu, ListItemIcon } from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import ReplyIcon from "@material-ui/icons/Reply";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";

const MessageOptionsMenu = ({ message, menuOpen, handleClose, anchorEl }) => {
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const theme = useTheme();

  const handleDeleteMessage = async () => {
    try {
      await api.delete(`/messages/${message.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const hanldeReplyMessage = () => {
    setReplyingMessage(message);
    handleClose();
  };

  const handleOpenConfirmationModal = (e) => {
    setConfirmationOpen(true);
    handleClose();
  };

  return (
    <>
      <ConfirmationModal
        title={i18n.t("messageOptionsMenu.confirmationModal.title")}
        open={confirmationOpen}
        onClose={setConfirmationOpen}
        onConfirm={handleDeleteMessage}
      >
        {i18n.t("messageOptionsMenu.confirmationModal.message")}
      </ConfirmationModal>
      <Menu
        anchorEl={anchorEl}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={menuOpen}
        onClose={handleClose}
      >
        {message.fromMe && (
          <MenuItem
            onClick={handleOpenConfirmationModal}
            style={{ color: theme.palette.error.main }}
          >
            <ListItemIcon
              style={{ minWidth: 32, color: theme.palette.error.main }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </ListItemIcon>
            {i18n.t("messageOptionsMenu.delete")}
          </MenuItem>
        )}
        <MenuItem onClick={hanldeReplyMessage}>
          <ListItemIcon style={{ minWidth: 32 }}>
            <ReplyIcon fontSize="small" />
          </ListItemIcon>
          {i18n.t("messageOptionsMenu.reply")}
        </MenuItem>
      </Menu>
    </>
  );
};

export default MessageOptionsMenu;
