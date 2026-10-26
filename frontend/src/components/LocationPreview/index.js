import React, { useEffect } from 'react';
import toastError from "../../errors/toastError";

import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";

import { Button, Divider, } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import RoomOutlinedIcon from "@material-ui/icons/RoomOutlined";

const useStyles = makeStyles(theme => ({
	card: {
		minWidth: 250,
		maxWidth: 320,
		marginBottom: 6,
		borderRadius: 12,
		overflow: "hidden",
		border: `1px solid ${theme.custom.border}`,
		backgroundColor: theme.custom.surface,
	},
	body: {
		display: "flex",
		alignItems: "flex-start",
		gap: 12,
		padding: 10,
	},
	image: {
		width: 96,
		height: 96,
		objectFit: "cover",
		borderRadius: 8,
		cursor: "pointer",
		flex: "none",
	},
	description: {
		fontSize: "0.84rem",
		fontWeight: 600,
		color: theme.palette.text.primary,
		minWidth: 0,
		wordBreak: "break-word",
	},
	action: {
		borderRadius: 0,
	},
}));

const LocationPreview = ({ image, link, description }) => {
    const classes = useStyles();
    useEffect(() => {}, [image, link, description]);

    const handleLocation = async() => {
        try {
            window.open(link);
        } catch (err) {
            toastError(err);
        }
    }

    return (
		<div className={classes.card}>
			<div className={classes.body}>
				<img
					src={image}
					onClick={handleLocation}
					className={classes.image}
					alt=""
				/>
				{ description && (
					<Typography component="div" className={classes.description}>
						<div dangerouslySetInnerHTML={{ __html: description.replace('\\n', '<br />') }}></div>
					</Typography>
				)}
			</div>
			<Divider />
			<Button
				fullWidth
				color="primary"
				startIcon={<RoomOutlinedIcon fontSize="small" />}
				className={classes.action}
				onClick={handleLocation}
				disabled={!link}
			>Visualizar</Button>
		</div>
	);

};

export default LocationPreview;