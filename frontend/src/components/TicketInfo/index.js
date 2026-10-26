import React from "react";

import { Avatar, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

import { getContactDisplayName } from "../../helpers/contactHelper";

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
		root: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing(1.5),
			minWidth: 0,
			padding: theme.spacing(0.5, 1, 0.5, 0.5),
			borderRadius: 12,
			cursor: "pointer",
			transition: "background-color .12s",
			"&:hover": { backgroundColor: c.surfaceHover },
		},
		avatar: {
			width: 40,
			height: 40,
			flex: "none",
			border: `1px solid ${c.border}`,
		},
		text: {
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
		},
		titleRow: {
			display: "flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0,
		},
		name: {
			fontWeight: 700,
			fontSize: "0.95rem",
			lineHeight: 1.3,
			minWidth: 0,
		},
		idPill: {
			flex: "none",
			padding: "0 7px",
			borderRadius: 999,
			fontSize: "0.68rem",
			fontWeight: 700,
			lineHeight: "18px",
			color: c.textMuted,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
		},
		sub: {
			display: "flex",
			alignItems: "center",
			gap: 6,
			minWidth: 0,
			fontSize: "0.78rem",
			color: c.textMuted,
		},
		queueDot: {
			width: 7,
			height: 7,
			borderRadius: "50%",
			flex: "none",
		},
	};
});

const TicketInfo = ({ contact, ticket, onClick }) => {
	const classes = useStyles();

	return (
		<div className={classes.root} onClick={onClick}>
			<Avatar
				className={classes.avatar}
				src={contact?.profilePicUrl}
				alt="contact_image"
			/>
			<div className={classes.text}>
				<div className={classes.titleRow}>
					<Typography noWrap component="span" className={classes.name}>
						{getContactDisplayName(contact)}
					</Typography>
					{ticket.id && <span className={classes.idPill}>#{ticket.id}</span>}
				</div>
				{(ticket.user || ticket.queue) && (
					<Typography noWrap component="span" className={classes.sub}>
						{ticket.queue && (
							<>
								<span
									className={classes.queueDot}
									style={{ backgroundColor: ticket.queue.color }}
								/>
								<span>{ticket.queue.name}</span>
								{ticket.user && <span>·</span>}
							</>
						)}
						{ticket.user && (
							<span>
								{`${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`}
							</span>
						)}
					</Typography>
				)}
			</div>
		</div>
	);
};

export default TicketInfo;
