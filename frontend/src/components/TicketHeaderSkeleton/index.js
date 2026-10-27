import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1.5),
		flex: "none",
		minHeight: 68,
		padding: theme.spacing(1, 2, 1, 1.5),
		backgroundColor: theme.custom.surface,
		borderBottom: `1px solid ${theme.custom.border}`,
	},
	text: {
		flex: 1,
		minWidth: 0,
	},
	actions: {
		display: "flex",
		gap: theme.spacing(1),
	},
}));

const TicketHeaderSkeleton = () => {
	const classes = useStyles();

	return (
		<div className={classes.ticketHeader}>
			<Skeleton animation="wave" variant="circle" width={40} height={40} />
			<div className={classes.text}>
				<Skeleton animation="wave" width={140} height={20} />
				<Skeleton animation="wave" width={200} height={16} />
			</div>
			<div className={classes.actions}>
				<Skeleton animation="wave" variant="rect" width={84} height={32} style={{ borderRadius: 10 }} />
				<Skeleton animation="wave" variant="rect" width={96} height={32} style={{ borderRadius: 10 }} />
			</div>
		</div>
	);
};

export default TicketHeaderSkeleton;
