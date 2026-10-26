import React, { useState } from "react";

import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import EditOutlinedIcon from "@material-ui/icons/EditOutlined";
import Drawer from "@material-ui/core/Drawer";
import Link from "@material-ui/core/Link";
import InputLabel from "@material-ui/core/InputLabel";
import Avatar from "@material-ui/core/Avatar";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";

import { i18n } from "../../translate/i18n";

import ContactModal from "../ContactModal";
import ContactDrawerSkeleton from "../ContactDrawerSkeleton";
import MarkdownWrapper from "../MarkdownWrapper";

const drawerWidth = 320;

const useStyles = makeStyles(theme => {
	const c = theme.custom;
	return {
		drawer: {
			width: drawerWidth,
			flexShrink: 0,
		},
		drawerPaper: {
			width: drawerWidth,
			height: "100%",
			display: "flex",
			borderRadius: 16,
			border: `1px solid ${c.border}`,
			backgroundColor: c.surface,
			overflow: "hidden",
		},
		header: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing(1),
			borderBottom: `1px solid ${c.border}`,
			padding: theme.spacing(0, 1.5, 0, 2),
			minHeight: 68,
			flex: "none",
		},
		headerTitle: {
			flex: 1,
			fontWeight: 700,
			fontSize: "0.95rem",
		},
		closeButton: {
			width: 34,
			height: 34,
			padding: 0,
		},
		content: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing(1.5),
			padding: theme.spacing(2),
			flex: 1,
			minHeight: 0,
			overflowY: "auto",
			...theme.scrollbarStyles,
		},

		contactAvatar: {
			width: 96,
			height: 96,
			marginBottom: theme.spacing(0.5),
			border: `3px solid ${c.surface}`,
			boxShadow: `0 0 0 1px ${c.border}, ${c.shadow}`,
		},

		contactHeader: {
			display: "flex",
			padding: theme.spacing(3, 2, 2),
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			textAlign: "center",
			gap: 4,
			borderRadius: 14,
			border: `1px solid ${c.border}`,
			background: `linear-gradient(180deg, ${c.primarySoft} 0%, ${c.surface} 75%)`,
		},
		contactName: {
			fontWeight: 700,
			fontSize: "1.02rem",
			wordBreak: "break-word",
		},
		contactNumber: {
			fontSize: "0.85rem",
			fontWeight: 500,
		},
		editButton: {
			marginTop: theme.spacing(1),
		},

		contactDetails: {
			padding: theme.spacing(1.5),
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing(1),
			borderRadius: 14,
			border: `1px solid ${c.border}`,
			backgroundColor: c.surface,
		},
		sectionTitle: {
			fontSize: "0.7rem",
			fontWeight: 700,
			textTransform: "uppercase",
			letterSpacing: "0.08em",
			color: c.textSubtle,
			padding: theme.spacing(0, 0.5),
		},
		contactExtraInfo: {
			padding: theme.spacing(1, 1.25),
			borderRadius: 10,
			backgroundColor: c.surfaceAlt,
			border: `1px solid ${c.border}`,
			"& label": {
				fontSize: "0.72rem",
				fontWeight: 600,
				color: c.textMuted,
			},
		},
	};
});

const ContactDrawer = ({ open, handleDrawerClose, contact, loading }) => {
	const classes = useStyles();

	const [modalOpen, setModalOpen] = useState(false);

	return (
		<Drawer
			className={classes.drawer}
			variant="persistent"
			anchor="right"
			open={open}
			PaperProps={{ style: { position: "absolute" } }}
			BackdropProps={{ style: { position: "absolute" } }}
			ModalProps={{
				container: document.getElementById("drawer-container"),
				style: { position: "absolute" },
			}}
			classes={{
				paper: classes.drawerPaper,
			}}
		>
			<div className={classes.header}>
				<Typography className={classes.headerTitle}>
					{i18n.t("contactDrawer.header")}
				</Typography>
				<IconButton
					size="small"
					className={classes.closeButton}
					onClick={handleDrawerClose}
				>
					<CloseIcon fontSize="small" />
				</IconButton>
			</div>
			{loading ? (
				<ContactDrawerSkeleton classes={classes} />
			) : (
				<div className={classes.content}>
					<Paper elevation={0} className={classes.contactHeader}>
						<Avatar
							alt={contact.name}
							src={contact.profilePicUrl}
							className={classes.contactAvatar}
						></Avatar>

						<Typography className={classes.contactName}>
							{contact.name}
						</Typography>
						<Typography className={classes.contactNumber}>
							<Link href={`tel:${contact.number}`}>{contact.number}</Link>
						</Typography>
						<Button
							variant="outlined"
							color="primary"
							size="small"
							startIcon={<EditOutlinedIcon fontSize="small" />}
							className={classes.editButton}
							onClick={() => setModalOpen(true)}
						>
							{i18n.t("contactDrawer.buttons.edit")}
						</Button>
					</Paper>
					<Paper elevation={0} className={classes.contactDetails}>
						<ContactModal
							open={modalOpen}
							onClose={() => setModalOpen(false)}
							contactId={contact.id}
						></ContactModal>
						<Typography className={classes.sectionTitle}>
							{i18n.t("contactDrawer.extraInfo")}
						</Typography>
						{contact?.extraInfo?.map(info => (
							<Paper
								key={info.id}
								elevation={0}
								className={classes.contactExtraInfo}
							>
								<InputLabel>{info.name}</InputLabel>
								<Typography component="div" noWrap style={{ paddingTop: 2 }}>
									<MarkdownWrapper>{info.value}</MarkdownWrapper>
								</Typography>
							</Paper>
						))}
					</Paper>
				</div>
			)}
		</Drawer>
	);
};

export default ContactDrawer;
