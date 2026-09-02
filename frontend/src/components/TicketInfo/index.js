import React from "react";

import { Avatar, CardHeader, Tooltip } from "@material-ui/core";

import { i18n } from "../../translate/i18n";

import { getContactDisplayName, isPendingResolution, PENDING_TOOLTIP } from "../../helpers/contactHelper";

const TicketInfo = ({ contact, ticket, onClick }) => {
	return (
		<CardHeader
			onClick={onClick}
			style={{ cursor: "pointer" }}
			titleTypographyProps={{ noWrap: true }}
			subheaderTypographyProps={{ noWrap: true }}
			avatar={<Avatar src={contact?.profilePicUrl} alt="contact_image" />}
			title={
			isPendingResolution(getContactDisplayName(contact))
				? <><Tooltip arrow title={PENDING_TOOLTIP}><span style={{ cursor: "help", color: "#999", fontStyle: "italic" }}>Nº pendente <span style={{ fontWeight: 700, color: "#666" }}>(?)</span></span></Tooltip>{` #${ticket.id}`}</>
				: `${getContactDisplayName(contact)} #${ticket.id}`
		}
			subheader={
				ticket.user &&
				`${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`
			}
		/>
	);
};

export default TicketInfo;
