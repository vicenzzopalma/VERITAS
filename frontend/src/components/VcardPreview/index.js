import React, { useEffect, useState, useContext } from 'react';
import { useHistory } from "react-router-dom";
import toastError from "../../errors/toastError";
import api from "../../services/api";

import Avatar from "@material-ui/core/Avatar";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";

import { AuthContext } from "../../context/Auth/AuthContext";

import { Button, Divider, } from "@material-ui/core";

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
        alignItems: "center",
        gap: 12,
        padding: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        flex: "none",
    },
    name: {
        fontWeight: 650,
        fontSize: "0.9rem",
        color: theme.palette.text.primary,
        minWidth: 0,
    },
    action: {
        borderRadius: 0,
    },
}));

const VcardPreview = ({ contact, numbers }) => {
    const history = useHistory();
    const { user } = useContext(AuthContext);
    const classes = useStyles();

    const [selectedContact, setContact] = useState({
        name: "",
        number: 0,
        profilePicUrl: ""
    });

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            const fetchContacts = async () => {
                try {
                    let contactObj = {
                        name: contact,
                        // number: numbers.replace(/\D/g, ""),
                        number: numbers !== undefined && numbers.replace(/\D/g, ""),
                        email: ""
                    }
                    const { data } = await api.post("/contact", contactObj);
                    setContact(data)

                } catch (err) {
                    console.log(err)
                    toastError(err);
                }
            };
            fetchContacts();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [contact, numbers]);

    const handleNewChat = async () => {
        try {
            const { data: ticket } = await api.post("/tickets", {
                contactId: selectedContact.id,
                userId: user.id,
                status: "open",
            });
            history.push(`/tickets/${ticket.id}`);
        } catch (err) {
            toastError(err);
        }
    }

    return (
        <div className={classes.card}>
            <div className={classes.body}>
                <Avatar className={classes.avatar} src={selectedContact.profilePicUrl} />
                <Typography className={classes.name} noWrap>
                    {selectedContact.name}
                </Typography>
            </div>
            <Divider />
            <Button
                fullWidth
                color="primary"
                startIcon={<ChatBubbleOutlineIcon fontSize="small" />}
                className={classes.action}
                onClick={handleNewChat}
                disabled={!selectedContact.number}
            >Conversar</Button>
        </div>
    );

};

export default VcardPreview;