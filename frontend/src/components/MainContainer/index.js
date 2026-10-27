import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    flex: 1,
    height: "100%",
    width: "100%",
    maxWidth: 1440,
    margin: "0 auto",
    padding: theme.spacing(0, 3, 3),
    [theme.breakpoints.down("xs")]: { padding: theme.spacing(0, 1.5, 1.5) },
  },
  contentWrapper: {
    height: "100%",
    overflowY: "hidden",
    display: "flex",
    flexDirection: "column",
  },
}));

const MainContainer = ({ children }) => {
  const classes = useStyles();
  return (
    <div className={`${classes.mainContainer} gisaio-page-enter`}>
      <div className={classes.contentWrapper}>{children}</div>
    </div>
  );
};

export default MainContainer;
