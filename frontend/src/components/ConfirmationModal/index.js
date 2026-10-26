import React from "react";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import Typography from "@material-ui/core/Typography";
import { makeStyles, alpha } from "@material-ui/core/styles";
import ReportProblemOutlinedIcon from "@material-ui/icons/ReportProblemOutlined";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
	content: {
		display: "flex",
		alignItems: "flex-start",
		gap: theme.spacing(2),
		padding: theme.spacing(3, 3, 1),
	},
	icon: {
		flex: "none",
		width: 44,
		height: 44,
		borderRadius: 12,
		display: "grid",
		placeItems: "center",
		color: theme.palette.warning.main,
		backgroundColor: alpha(
			theme.palette.warning.main,
			theme.palette.type === "dark" ? 0.16 : 0.12
		),
		"& svg": { fontSize: 22 },
	},
	title: {
		fontWeight: 700,
		fontSize: "1.05rem",
		lineHeight: 1.35,
		color: theme.palette.text.primary,
		wordBreak: "break-word",
	},
	message: {
		marginTop: theme.spacing(0.75),
		color: theme.palette.text.secondary,
		fontSize: "0.88rem",
	},
}));

const ConfirmationModal = ({ title, children, open, onClose, onConfirm }) => {
	const classes = useStyles();
	return (
		<Dialog
			open={open}
			onClose={() => onClose(false)}
			aria-labelledby="confirm-dialog"
			maxWidth="xs"
			fullWidth
		>
			<DialogContent className={classes.content}>
				<div className={classes.icon}>
					<ReportProblemOutlinedIcon />
				</div>
				<div>
					<Typography id="confirm-dialog" component="h2" className={classes.title}>
						{title}
					</Typography>
					<Typography component="div" className={classes.message}>
						{children}
					</Typography>
				</div>
			</DialogContent>
			<DialogActions>
				<Button variant="outlined" onClick={() => onClose(false)}>
					{i18n.t("confirmationModal.buttons.cancel")}
				</Button>
				<Button
					variant="contained"
					color="primary"
					onClick={() => {
						onClose(false);
						onConfirm();
					}}
				>
					{i18n.t("confirmationModal.buttons.confirm")}
				</Button>
			</DialogActions>
		</Dialog>
	);
};

export default ConfirmationModal;
