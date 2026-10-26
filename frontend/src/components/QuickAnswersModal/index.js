import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
  makeStyles,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  CircularProgress,
  IconButton,
  Typography,
} from "@material-ui/core";
import { alpha } from "@material-ui/core/styles";
import FlashOnOutlinedIcon from "@material-ui/icons/FlashOnOutlined";
import CloseIcon from "@material-ui/icons/Close";
import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    flexWrap: "wrap",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1.5),
    padding: theme.spacing(2.5, 2, 2, 3),
    borderBottom: `1px solid ${theme.custom.border}`,
  },
  headerIcon: {
    flex: "none",
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    color: theme.palette.primary.main,
    backgroundColor: theme.custom.primarySoft,
    "& svg": { fontSize: 20 },
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontWeight: 700, fontSize: "1.08rem", lineHeight: 1.3 },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: "0.83rem",
    marginTop: 2,
  },
  content: {
    padding: theme.spacing(2.5, 3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  hint: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    padding: theme.spacing(1, 1.5),
    borderRadius: 10,
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
  },
  textField: {
    width: "100%",
    margin: 0,
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: theme.palette.primary.main,
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  textQuickAnswerContainer: {
    width: "100%",
  },
}));

const QuickAnswerSchema = Yup.object().shape({
  shortcut: Yup.string()
    .min(2, "Too Short!")
    .max(15, "Too Long!")
    .required("Required"),
  message: Yup.string()
    .min(8, "Too Short!")
    .max(30000, "Too Long!")
    .required("Required"),
});

const QuickAnswersModal = ({
  open,
  onClose,
  quickAnswerId,
  initialValues,
  onSave,
}) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const initialState = {
    shortcut: "",
    message: "",
  };

  const [quickAnswer, setQuickAnswer] = useState(initialState);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchQuickAnswer = async () => {
      if (initialValues) {
        setQuickAnswer((prevState) => {
          return { ...prevState, ...initialValues };
        });
      }

      if (!quickAnswerId) return;

      try {
        const { data } = await api.get(`/quickAnswers/${quickAnswerId}`);
        if (isMounted.current) {
          setQuickAnswer(data);
        }
      } catch (err) {
        toastError(err);
      }
    };

    fetchQuickAnswer();
  }, [quickAnswerId, open, initialValues]);

  const handleClose = () => {
    onClose();
    setQuickAnswer(initialState);
  };

  const handleSaveQuickAnswer = async (values) => {
    try {
      if (quickAnswerId) {
        await api.put(`/quickAnswers/${quickAnswerId}`, values);
        handleClose();
      } else {
        const { data } = await api.post("/quickAnswers", values);
        if (onSave) {
          onSave(data);
        }
        handleClose();
      }
      toast.success(i18n.t("quickAnswersModal.success"));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        scroll="paper"
      >
        <div className={classes.header}>
          <div className={classes.headerIcon}>
            <FlashOnOutlinedIcon />
          </div>
          <div className={classes.headerText}>
            <Typography id="form-dialog-title" component="h2" className={classes.title}>
              {quickAnswerId
                ? `${i18n.t("quickAnswersModal.title.edit")}`
                : `${i18n.t("quickAnswersModal.title.add")}`}
            </Typography>
            <Typography className={classes.subtitle}>
              Mensagens prontas que o atendente insere digitando o atalho.
            </Typography>
          </div>
          <IconButton size="small" onClick={handleClose} aria-label="Fechar">
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
        <Formik
          initialValues={quickAnswer}
          enableReinitialize={true}
          validationSchema={QuickAnswerSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveQuickAnswer(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ values, errors, touched, isSubmitting }) => (
            <Form>
              <DialogContent className={classes.content}>
                <div className={classes.textQuickAnswerContainer}>
                  <Field
                    as={TextField}
                    label={i18n.t("quickAnswersModal.form.shortcut")}
                    name="shortcut"
                    autoFocus
                    error={touched.shortcut && Boolean(errors.shortcut)}
                    helperText={touched.shortcut && errors.shortcut}
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                    fullWidth
                  />
                </div>
                <div className={classes.textQuickAnswerContainer}>
                  <Field
                    as={TextField}
                    label={i18n.t("quickAnswersModal.form.message")}
                    name="message"
                    error={touched.message && Boolean(errors.message)}
                    helperText={touched.message && errors.message}
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                    multiline
                    rows={6}
                    fullWidth
                  />
                </div>
                <div className={classes.hint}>
                  Dica: no chat, digite <strong>/</strong> seguido do atalho para inserir esta mensagem.
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("quickAnswersModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {quickAnswerId
                    ? `${i18n.t("quickAnswersModal.buttons.okEdit")}`
                    : `${i18n.t("quickAnswersModal.buttons.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default QuickAnswersModal;
