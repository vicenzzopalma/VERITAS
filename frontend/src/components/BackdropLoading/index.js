import React from "react";
import Backdrop from "@material-ui/core/Backdrop";
import CircularProgress from "@material-ui/core/CircularProgress";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    backgroundColor: theme.custom ? theme.custom.bg : theme.palette.background.default,
    backdropFilter: "none",
  },
  box: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: theme.custom ? theme.custom.gradient : theme.palette.primary.main,
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontWeight: 800,
    fontSize: 20,
  },
}));

const BackdropLoading = () => {
  const classes = useStyles();
  return (
    <Backdrop className={classes.backdrop} open={true}>
      <div className={classes.box}>
        <div className={classes.logo}>V</div>
        <CircularProgress size={22} thickness={5} color="primary" />
      </div>
    </Backdrop>
  );
};

export default BackdropLoading;
