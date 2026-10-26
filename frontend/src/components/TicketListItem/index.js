import React, { useState, useEffect, useRef, useContext } from "react";

import { useHistory, useParams } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import clsx from "clsx";

import { makeStyles, alpha, useTheme } from "@material-ui/core/styles";
import ListItem from "@material-ui/core/ListItem";
import Typography from "@material-ui/core/Typography";
import Avatar from "@material-ui/core/Avatar";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import MarkdownWrapper from "../MarkdownWrapper";
import { Tooltip } from "@material-ui/core";
import { AuthContext } from "../../context/Auth/AuthContext";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
		ticket: {
			position: "relative",
			alignItems: "flex-start",
			gap: theme.spacing(1.5),
			borderRadius: 12,
			margin: "2px 0",
			padding: theme.spacing(1.25, 1.25, 1.25, 1.75),
			transition: "background-color .12s",
			"&$selected, &$selected:hover": {
				backgroundColor: c.primarySoft,
			},
		},
		selected: {},

		pendingTicket: {
			cursor: "unset",
		},

		avatarWrap: {
			position: "relative",
			flex: "none",
		},

		avatar: {
			width: 42,
			height: 42,
			border: `1px solid ${c.border}`,
		},

		body: {
			flex: 1,
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
			gap: 2,
		},

		row: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing(1),
			minWidth: 0,
		},

		contactName: {
			flex: 1,
			minWidth: 0,
			fontWeight: 600,
			fontSize: "0.88rem",
			color: theme.palette.text.primary,
		},

		lastMessageTime: {
			flex: "none",
			fontSize: "0.72rem",
			fontWeight: 500,
			color: c.textSubtle,
		},

		lastMessageTimeUnread: {
			color: theme.palette.primary.main,
			fontWeight: 700,
		},

		contactLastMessage: {
			flex: 1,
			minWidth: 0,
			fontSize: "0.8rem",
			color: c.textMuted,
		},

		unreadText: {
			color: theme.palette.text.primary,
			fontWeight: 600,
		},

		newMessagesCount: {
			flex: "none",
			minWidth: 20,
			height: 20,
			padding: "0 6px",
			borderRadius: 999,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			fontSize: "0.7rem",
			fontWeight: 700,
			color: theme.palette.primary.contrastText,
			backgroundColor: theme.palette.primary.main,
		},

		metaRow: {
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 6,
			marginTop: 4,
		},

		pill: {
			display: "inline-flex",
			alignItems: "center",
			gap: 5,
			maxWidth: "100%",
			padding: "1px 8px",
			borderRadius: 999,
			fontSize: "0.68rem",
			fontWeight: 600,
			lineHeight: 1.6,
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis",
			color: c.textMuted,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
		},

		pillDot: {
			width: 6,
			height: 6,
			borderRadius: "50%",
			flex: "none",
		},

		closedPill: {
			color: theme.palette.success.main,
			backgroundColor: alpha(theme.palette.success.main, 0.1),
			borderColor: "transparent",
		},

		acceptButton: {
			marginLeft: "auto",
			padding: "2px 12px",
			minHeight: 0,
			fontSize: "0.75rem",
		},

		ticketQueueColor: {
			position: "absolute",
			left: 4,
			top: 12,
			bottom: 12,
			width: 3,
			borderRadius: 3,
		},
	};
});

import { getContactDisplayName, formatPhoneNumber } from "../../helpers/contactHelper";

const TicketListItem = ({ ticket }) => {
	const classes = useStyles();
	const theme = useTheme();
	const history = useHistory();
	const [loading, setLoading] = useState(false);
	const { ticketId } = useParams();
	const isMounted = useRef(true);
	const { user } = useContext(AuthContext);

	useEffect(() => {
		return () => {
			isMounted.current = false;
		};
	}, []);

	const handleAcepptTicket = async id => {
		setLoading(true);
		try {
			await api.put(`/tickets/${id}`, {
				status: "open",
				userId: user?.id,
			});
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
		if (isMounted.current) {
			setLoading(false);
		}
		history.push(`/tickets/${id}`);
	};

	const handleSelectTicket = id => {
		history.push(`/tickets/${id}`);
	};

	const hasUnread = ticket.unreadMessages > 0;
	const queueColor = ticket.queue?.color || theme.custom.textSubtle;

	return (
		<React.Fragment key={ticket.id}>
			<ListItem
				button
				onClick={e => {
					if (ticket.status === "pending") return;
					handleSelectTicket(ticket.id);
				}}
				selected={ticketId && +ticketId === ticket.id}
				classes={{ selected: classes.selected }}
				className={clsx(classes.ticket, {
					[classes.pendingTicket]: ticket.status === "pending",
				})}
			>
				<Tooltip
					arrow
					placement="right"
					title={ticket.queue?.name || "Sem fila"}
				>
					<span
						style={{ backgroundColor: queueColor }}
						className={classes.ticketQueueColor}
					></span>
				</Tooltip>
				<div className={classes.avatarWrap}>
					<Avatar
						className={classes.avatar}
						src={ticket?.contact?.profilePicUrl}
					/>
				</div>
				<div className={classes.body}>
					<div className={classes.row}>
						<Typography
							noWrap
							component="span"
							className={classes.contactName}
						>
							{getContactDisplayName(ticket.contact)}
						</Typography>
						{ticket.lastMessage && (
							<Typography
								component="span"
								className={clsx(classes.lastMessageTime, {
									[classes.lastMessageTimeUnread]: hasUnread,
								})}
							>
								{isSameDay(parseISO(ticket.updatedAt), new Date()) ? (
									<>{format(parseISO(ticket.updatedAt), "HH:mm")}</>
								) : (
									<>{format(parseISO(ticket.updatedAt), "dd/MM/yyyy")}</>
								)}
							</Typography>
						)}
					</div>
					<div className={classes.row}>
						<Typography
							className={clsx(classes.contactLastMessage, {
								[classes.unreadText]: hasUnread,
							})}
							noWrap
							component="span"
						>
							{ticket.lastMessage ? (
								<MarkdownWrapper>{ticket.lastMessage}</MarkdownWrapper>
							) : (
								<br />
							)}
						</Typography>
						{hasUnread && (
							<span className={classes.newMessagesCount}>
								{ticket.unreadMessages}
							</span>
						)}
					</div>
					{(ticket.queue ||
						ticket.whatsappId ||
						ticket.status === "closed" ||
						ticket.status === "pending") && (
						<div className={classes.metaRow}>
							{ticket.queue && (
								<span className={classes.pill}>
									<span
										className={classes.pillDot}
										style={{ backgroundColor: queueColor }}
									/>
									{ticket.queue.name}
								</span>
							)}
							{ticket.whatsappId && (
								<span
									className={classes.pill}
									title={i18n.t("ticketsList.connectionTitle")}
								>
									{ticket.whatsapp?.name}
								</span>
							)}
							{ticket.status === "closed" && (
								<span className={clsx(classes.pill, classes.closedPill)}>
									closed
								</span>
							)}
							{ticket.status === "pending" && (
								<ButtonWithSpinner
									color="primary"
									variant="contained"
									className={classes.acceptButton}
									size="small"
									loading={loading}
									onClick={e => handleAcepptTicket(ticket.id)}
								>
									{i18n.t("ticketsList.buttons.accept")}
								</ButtonWithSpinner>
							)}
						</div>
					)}
				</div>
			</ListItem>
		</React.Fragment>
	);
};

export default TicketListItem;
