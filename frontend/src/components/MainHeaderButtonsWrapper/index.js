import React from "react";

import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
	MainHeaderButtonsWrapper: {
		flex: "none",
		marginLeft: "auto",
		"& > *": {
			margin: theme.spacing(1),
		},
		[theme.breakpoints.down("sm")]: {
			display: "flex",
			flexWrap: "wrap",
			width: "100%",
			marginLeft: 0,
			justifyContent: "flex-start",
			alignItems: "center",
			gap: 6,
			"& > *": {
				margin: "2px 0",
			},
		},
	},
}));

const MainHeaderButtonsWrapper = ({ children }) => {
	const classes = useStyles();

	return <div className={classes.MainHeaderButtonsWrapper}>{children}</div>;
};

export default MainHeaderButtonsWrapper;
