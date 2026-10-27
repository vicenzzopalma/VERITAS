import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  MainHeaderButtonsWrapper: {
    flex: "none",
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    "& .MuiOutlinedInput-root, & .MuiInput-root": { height: 40 },
    "& .MuiButton-root": { height: 40 },
    "& .MuiInput-underline:before, & .MuiInput-underline:after": { display: "none" },
    "& .MuiInput-root": {
      padding: "0 12px",
      borderRadius: 10,
      border: `1px solid ${theme.custom ? theme.custom.border : theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      minWidth: 220,
    },
    [theme.breakpoints.down("xs")]: { marginLeft: 0, width: "100%" },
  },
}));

const MainHeaderButtonsWrapper = ({ children }) => {
  const classes = useStyles();
  return <div className={classes.MainHeaderButtonsWrapper}>{children}</div>;
};

export default MainHeaderButtonsWrapper;
