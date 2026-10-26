import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import { Checkbox, ListItemText } from "@material-ui/core";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	root: {
		width: 132,
		flex: "none",
	},
	select: {
		height: 38,
		borderRadius: 10,
		fontSize: "0.82rem",
		fontWeight: 600,
		color: theme.palette.text.secondary,
	},
	selectInput: {
		paddingTop: 0,
		paddingBottom: 0,
		paddingLeft: 12,
		display: "flex",
		alignItems: "center",
		height: 38,
		boxSizing: "border-box",
	},
	count: {
		marginLeft: 6,
		minWidth: 18,
		height: 18,
		padding: "0 5px",
		borderRadius: 999,
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: "0.68rem",
		fontWeight: 700,
		color: theme.palette.primary.main,
		backgroundColor: theme.custom.primarySoft,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: "50%",
		marginRight: 10,
		flex: "none",
	},
}));

const TicketsQueueSelect = ({
	userQueues,
	selectedQueueIds = [],
	onChange,
}) => {
	const classes = useStyles();

	const handleChange = e => {
		onChange(e.target.value);
	};

	return (
		<div className={classes.root}>
			<FormControl fullWidth>
				<Select
					multiple
					displayEmpty
					variant="outlined"
					value={selectedQueueIds}
					onChange={handleChange}
					className={classes.select}
					classes={{ select: classes.selectInput }}
					MenuProps={{
						anchorOrigin: {
							vertical: "bottom",
							horizontal: "left",
						},
						transformOrigin: {
							vertical: "top",
							horizontal: "left",
						},
						getContentAnchorEl: null,
					}}
					renderValue={() => (
						<>
							{i18n.t("ticketsQueueSelect.placeholder")}
							{selectedQueueIds.length > 0 && (
								<span className={classes.count}>{selectedQueueIds.length}</span>
							)}
						</>
					)}
				>
					{userQueues?.length > 0 &&
						userQueues.map(queue => (
							<MenuItem dense key={queue.id} value={queue.id}>
								<Checkbox
									size="small"
									color="primary"
									checked={selectedQueueIds.indexOf(queue.id) > -1}
								/>
								<span
									className={classes.dot}
									style={{ backgroundColor: queue.color }}
								/>
								<ListItemText primary={queue.name} />
							</MenuItem>
						))}
				</Select>
			</FormControl>
		</div>
	);
};

export default TicketsQueueSelect;
