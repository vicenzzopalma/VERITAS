import React from "react";
import { useParams } from "react-router-dom";
import Paper from "@material-ui/core/Paper";
import Hidden from "@material-ui/core/Hidden";
import { makeStyles } from "@material-ui/core/styles";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";

import TicketsManager from "../../components/TicketsManager/";
import Ticket from "../../components/Ticket/";
import { EmptyState } from "../../components/ui";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  chatContainer: {
    flex: 1,
    height: `calc(100% - 48px)`,
    overflow: "hidden",
    backgroundColor: theme.custom.bg,
    padding: theme.spacing(2),
    [theme.breakpoints.down("sm")]: {
      padding: theme.spacing(1),
    },
  },

  chatPapper: {
    display: "flex",
    height: "100%",
    gap: theme.spacing(2),
    minHeight: 0,
  },

  contactsWrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minWidth: 0,
    overflow: "hidden",
    flex: "0 0 380px",
    maxWidth: "36%",
    [theme.breakpoints.down("sm")]: {
      flex: "1 1 100%",
      maxWidth: "100%",
    },
  },
  contactsWrapperSmall: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  messagessWrapper: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 0,
    height: "100%",
  },
  messagessWrapperHiddenSmall: {
    [theme.breakpoints.down("sm")]: {
      display: "none",
    },
  },
  welcomeMsg: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    borderRadius: 16,
    border: `1px solid ${theme.custom.border}`,
    ...theme.custom.dotGrid,
  },
  welcomeInner: {
    maxWidth: 380,
    padding: theme.spacing(2),
    borderRadius: 16,
    backgroundColor: theme.custom.surface,
    border: `1px solid ${theme.custom.border}`,
    boxShadow: theme.custom.shadow,
  },
}));

const Chat = () => {
  const classes = useStyles();
  const { ticketId } = useParams();

  return (
    <div className={classes.chatContainer}>
      <div className={classes.chatPapper}>
        <div
          className={`${classes.contactsWrapper} ${
            ticketId ? classes.contactsWrapperSmall : ""
          }`}
        >
          <TicketsManager />
        </div>
        <div
          className={`${classes.messagessWrapper} ${
            ticketId ? "" : classes.messagessWrapperHiddenSmall
          }`}
        >
          {ticketId ? (
            <Ticket />
          ) : (
            <Hidden only={["sm", "xs"]}>
              <Paper elevation={0} className={classes.welcomeMsg}>
                <div className={classes.welcomeInner}>
                  <EmptyState
                    icon={<ForumOutlinedIcon />}
                    title={i18n.t("chat.noTicketMessage")}
                  />
                </div>
              </Paper>
            </Hidden>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
