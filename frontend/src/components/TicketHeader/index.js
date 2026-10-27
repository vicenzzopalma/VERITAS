import React from "react";

import { IconButton } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import TicketHeaderSkeleton from "../TicketHeaderSkeleton";
import ArrowBack from "@material-ui/icons/ArrowBack";
import { useHistory } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
  ticketHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flex: "none",
    minHeight: 68,
    padding: theme.spacing(1, 1.5, 1, 1),
    backgroundColor: theme.custom.surface,
    color: theme.custom.text,
    borderBottom: `1px solid ${theme.custom.border}`,
    [theme.breakpoints.down("sm")]: {
      flexWrap: "wrap",
    },
  },
  backButton: {
    flex: "none",
    width: 36,
    height: 36,
    padding: 0,
  },
}));

const TicketHeader = ({ loading, children }) => {
  const classes = useStyles();
  const history = useHistory();
  const handleBack = () => {
    history.push("/tickets");
  };

  return (
    <>
      {loading ? (
        <TicketHeaderSkeleton />
      ) : (
        <div id="ticket-header" className={classes.ticketHeader}>
          <IconButton
            id="ticket-header-back-button"
            size="small"
            className={classes.backButton}
            onClick={handleBack}
            aria-label="Voltar"
          >
            <ArrowBack fontSize="small" />
          </IconButton>
          {children}
        </div>
      )}
    </>
  );
};

export default TicketHeader;
