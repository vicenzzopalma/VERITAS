import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import Skeleton from "@material-ui/lab/Skeleton";

const useStyles = makeStyles(theme => ({
	row: {
		display: "flex",
		alignItems: "flex-start",
		gap: theme.spacing(1.5),
		padding: theme.spacing(1.25, 1.25, 1.25, 1.75),
		margin: "2px 0",
	},
	body: {
		flex: 1,
		minWidth: 0,
	},
	line: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
	},
}));

const widths = [
	[110, 170],
	[140, 120],
	[90, 190],
];

const TicketsSkeleton = () => {
	const classes = useStyles();
	return (
		<>
			{widths.map(([name, msg], i) => (
				<div className={classes.row} key={i}>
					<Skeleton animation="wave" variant="circle" width={42} height={42} />
					<div className={classes.body}>
						<div className={classes.line}>
							<Skeleton animation="wave" height={18} width={name} />
							<Skeleton animation="wave" height={14} width={32} />
						</div>
						<Skeleton animation="wave" height={16} width={msg} />
						<Skeleton
							animation="wave"
							variant="rect"
							height={16}
							width={64}
							style={{ borderRadius: 999, marginTop: 4 }}
						/>
					</div>
				</div>
			))}
		</>
	);
};

export default TicketsSkeleton;
