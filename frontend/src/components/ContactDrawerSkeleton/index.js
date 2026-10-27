import React from "react";
import Skeleton from "@material-ui/lab/Skeleton";
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import { i18n } from "../../translate/i18n";

const ContactDrawerSkeleton = ({ classes }) => {
	return (
		<div className={classes.content}>
			<Paper elevation={0} className={classes.contactHeader}>
				<Skeleton
					animation="wave"
					variant="circle"
					width={96}
					height={96}
					className={classes.contactAvatar}
				/>
				<Skeleton animation="wave" height={24} width={120} />
				<Skeleton animation="wave" height={20} width={100} />
				<Skeleton
					animation="wave"
					variant="rect"
					height={30}
					width={90}
					style={{ borderRadius: 10, marginTop: 8 }}
				/>
			</Paper>
			<Paper elevation={0} className={classes.contactDetails}>
				<Typography className={classes.sectionTitle}>
					{i18n.t("contactDrawer.extraInfo")}
				</Typography>
				{[0, 1, 2].map(i => (
					<Paper key={i} elevation={0} className={classes.contactExtraInfo}>
						<Skeleton animation="wave" height={16} width={60} />
						<Skeleton animation="wave" height={20} width={160} />
					</Paper>
				))}
			</Paper>
		</div>
	);
};

export default ContactDrawerSkeleton;
