import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  contactsHeader: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing(1.5),
    padding: theme.spacing(3, 0, 2.5),
    flex: "none",
  },
}));

const MainHeader = ({ children }) => {
  const classes = useStyles();
  return <div className={classes.contactsHeader}>{children}</div>;
};

export default MainHeader;
