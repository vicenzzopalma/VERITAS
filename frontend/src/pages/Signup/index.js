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
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
  Visibility,
  VisibilityOff,
  PersonOutline,
  MailOutline,
  LockOutlined,
} from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import AuthShell from "../../components/AuthShell";

const useStyles = makeStyles((theme) => ({
  form: { display: "flex", flexDirection: "column", gap: theme.spacing(2) },
  adornIcon: { color: theme.custom.textSubtle, fontSize: 20 },
  submit: { height: 46, fontSize: "0.95rem", marginTop: theme.spacing(1) },
  alt: {
    textAlign: "center",
    fontSize: "0.86rem",
    color: theme.custom.textMuted,
    marginTop: theme.spacing(1),
  },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Muito curto")
    .max(50, "Muito longo")
    .required("Nome é obrigatório"),
  password: Yup.string().min(5, "Mínimo 5 caracteres").max(50, "Muito longo").required("Senha é obrigatória"),
  email: Yup.string().email("E-mail inválido").required("E-mail é obrigatório"),
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

  const adorn = (Icon) => (
    <InputAdornment position="start">
      <Icon className={classes.adornIcon} />
    </InputAdornment>
  );

  return (
    <AuthShell title="Criar conta" subtitle="Crie sua conta no sistema.">
      <Formik
        initialValues={user}
        enableReinitialize={true}
        validationSchema={UserSchema}
        onSubmit={(values, actions) => {
          handleSignUp(values);
          actions.setSubmitting(false);
        }}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className={classes.form} noValidate>
            <Field
              as={TextField}
              variant="outlined"
              fullWidth
              type="text"
              id="name"
              name="name"
              label="Nome Completo"
              placeholder="Seu nome"
              autoComplete="name"
              autoFocus
              error={touched.name && Boolean(errors.name)}
              helperText={touched.name && errors.name}
              InputProps={{ startAdornment: adorn(PersonOutline) }}
            />
            <Field
              as={TextField}
              variant="outlined"
              fullWidth
              type="email"
              id="email"
              name="email"
              label="E-mail"
              placeholder="seuemail@empresa.com"
              autoComplete="email"
              error={touched.email && Boolean(errors.email)}
              helperText={touched.email && errors.email}
              InputProps={{ startAdornment: adorn(MailOutline) }}
            />
            <Field
              as={TextField}
              variant="outlined"
              fullWidth
              id="password"
              name="password"
              label="Senha"
              placeholder="Sua senha secreta"
              autoComplete="new-password"
              type={showPassword ? "text" : "password"}
              error={touched.password && Boolean(errors.password)}
              helperText={touched.password && errors.password}
              InputProps={{
                startAdornment: adorn(LockOutlined),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword((v) => !v)}
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
              Cadastrar
            </Button>
            <div className={classes.alt}>
              Já possui conta?{" "}
              <Link component={RouterLink} to="/login" style={{ fontWeight: 600 }}>
                Entrar
              </Link>
            </div>
          </Form>
        )}
      </Formik>
    </AuthShell>
  );
};

export default SignUp;
