import React from "react";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  title: {
    fontWeight: 750,
    fontSize: "1.45rem",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    color: theme.palette.text.primary,
    margin: 0,
  },
}));

export default function Title(props) {
  const classes = useStyles();
  return (
    <Typography component="h1" className={classes.title}>
      {props.children}
    </Typography>
  );
}
