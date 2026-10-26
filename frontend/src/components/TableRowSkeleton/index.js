import React from "react";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import Skeleton from "@material-ui/lab/Skeleton";
import { makeStyles } from "@material-ui/core";

const useStyles = makeStyles(() => ({
	avatarCell: {
		display: "flex",
		alignItems: "center",
		gap: 12,
	},
}));

// Placeholder row(s) shown while a table is loading.
// `avatar` renders a leading cell with a circle + text line (people tables);
// `columns` is the number of additional plain cells; `rows` repeats the row.
const TableRowSkeleton = ({ avatar, columns = 0, rows = 1 }) => {
	const classes = useStyles();
	const widths = ["70%", "55%", "40%", "60%", "35%"];
	return (
		<>
			{Array.from({ length: rows }, (_, r) => (
				<TableRow key={r}>
					{avatar && (
						<TableCell>
							<div className={classes.avatarCell}>
								<Skeleton animation="wave" variant="circle" width={34} height={34} />
								<Skeleton animation="wave" height={18} width={120} />
							</div>
						</TableCell>
					)}
					{Array.from({ length: columns }, (_, index) => (
						<TableCell key={index}>
							<Skeleton
								animation="wave"
								height={18}
								width={widths[(index + r) % widths.length]}
							/>
						</TableCell>
					))}
				</TableRow>
			))}
		</>
	);
};

export default TableRowSkeleton;
