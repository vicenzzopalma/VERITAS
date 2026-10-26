import React, { useState } from "react";
import * as Yup from "yup";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import {
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Link,
  makeStyles,
} from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import AuthShell from "../../components/AuthShell";

const useStyles = makeStyles((theme) => ({
  form: { display: "flex", flexDirection: "column", gap: theme.spacing(2) },
  submit: { height: 46, fontSize: "0.95rem", marginTop: theme.spacing(1) },
  alt: { textAlign: "center", fontSize: "0.86rem", marginTop: theme.spacing(1) },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string().min(2, "Too Short!").max(50, "Too Long!").required("Required"),
  password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
  email: Yup.string().email("Invalid email").required("Required"),
});

const SignUp = () => {
  const classes = useStyles();
  const history = useHistory();

  const initialState = { name: "", email: "", password: "" };
  const [showPassword, setShowPassword] = useState(false);
  const [user] = useState(initialState);

  const handleSignUp = async (values) => {
    try {
      await api.post("/auth/signup", values);
      toast.success(i18n.t("signup.toasts.success"));
      history.push("/login");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <AuthShell title="Criar conta" subtitle="Leva menos de um minuto para começar.">
      <Formik
        initialValues={user}
        enableReinitialize={true}
        validationSchema={UserSchema}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            handleSignUp(values);
            actions.setSubmitting(false);
          }, 400);
        }}
      >
        {({ touched, errors, isSubmitting }) => (
          <Form className={classes.form}>
            <Field
              as={TextField}
              autoComplete="name"
              name="name"
              error={touched.name && Boolean(errors.name)}
              helperText={touched.name && errors.name}
              variant="outlined"
              fullWidth
              id="name"
              label={i18n.t("signup.form.name")}
              autoFocus
            />
            <Field
              as={TextField}
              variant="outlined"
              fullWidth
              id="email"
              label={i18n.t("signup.form.email")}
              name="email"
              error={touched.email && Boolean(errors.email)}
              helperText={touched.email && errors.email}
              autoComplete="email"
            />
            <Field
              as={TextField}
              variant="outlined"
              fullWidth
              name="password"
              id="password"
              autoComplete="new-password"
              error={touched.password && Boolean(errors.password)}
              helperText={touched.password && errors.password}
              label={i18n.t("signup.form.password")}
              type={showPassword ? "text" : "password"}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Mostrar ou ocultar senha"
                      onClick={() => setShowPassword((e) => !e)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              className={classes.submit}
              disabled={isSubmitting}
            >
              {i18n.t("signup.buttons.submit")}
            </Button>
            <div className={classes.alt}>
              <Link component={RouterLink} to="/login" style={{ fontWeight: 600 }}>
                {i18n.t("signup.buttons.login")}
              </Link>
            </div>
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
};

export default SignUp;
