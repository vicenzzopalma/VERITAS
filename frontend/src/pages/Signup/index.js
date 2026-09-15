import React, { useState } from "react";
import * as Yup from "yup";
import { useHistory, Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(() => ({
  pageContainer: {
    minHeight: "100vh",
    width: "100vw",
    margin: 0,
    padding: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "radial-gradient(circle at top right, #1a1c29, #0e1017)",
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxSizing: "border-box",
  },
  signupContainer: {
    width: "100%",
    maxWidth: "460px",
    padding: "40px",
    background: "rgba(20, 22, 37, 0.92)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "16px",
    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
    contain: "content",
    boxSizing: "border-box",
    fontFamily: "'Outfit', sans-serif",
    animation: "$fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  "@keyframes fadeIn": {
    from: {
      opacity: 0,
      transform: "translateY(10px) scale(0.98)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0) scale(1)",
    },
  },
  header: {
    textAlign: "center",
    marginBottom: "26px",
  },
  logoIcon: {
    fontSize: "2.6rem",
    marginBottom: "8px",
    userSelect: "none",
    filter: "drop-shadow(0 4px 12px rgba(88, 101, 242, 0.35))",
  },
  title: {
    fontSize: "1.7rem",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    marginBottom: "4px",
    color: "#f8f9fa",
    fontFamily: "'Outfit', sans-serif",
    margin: 0,
  },
  subtitle: {
    color: "#a0aec0",
    fontSize: "0.9rem",
    marginTop: "4px",
    marginBottom: 0,
    fontFamily: "'Outfit', sans-serif",
  },
  inputGroup: {
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "0.82rem",
    fontWeight: 600,
    color: "#a0aec0",
    marginBottom: "6px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    fontFamily: "'Outfit', sans-serif",
  },
  input: {
    padding: "12px 16px",
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "8px",
    color: "#f8f9fa",
    fontSize: "0.95rem",
    fontFamily: "'Outfit', sans-serif",
    transition: "all 0.2s ease",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    "&:focus": {
      borderColor: "#5865f2",
      boxShadow: "0 0 0 3px rgba(88, 101, 242, 0.2)",
    },
    "&::placeholder": {
      color: "rgba(160, 174, 192, 0.5)",
    },
  },
  inputError: {
    borderColor: "#d63031 !important",
  },
  errorText: {
    color: "#d63031",
    fontSize: "0.78rem",
    marginTop: "4px",
    fontFamily: "'Outfit', sans-serif",
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  passwordInput: {
    padding: "12px 46px 12px 16px",
    background: "rgba(0, 0, 0, 0.25)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "8px",
    color: "#f8f9fa",
    fontSize: "0.95rem",
    fontFamily: "'Outfit', sans-serif",
    transition: "all 0.2s ease",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    "&:focus": {
      borderColor: "#5865f2",
      boxShadow: "0 0 0 3px rgba(88, 101, 242, 0.2)",
    },
    "&::placeholder": {
      color: "rgba(160, 174, 192, 0.5)",
    },
  },
  togglePasswordBtn: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#a0aec0",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px",
    borderRadius: "6px",
    transition: "color 0.2s ease",
    outline: "none",
    "&:hover": {
      color: "#f8f9fa",
    },
  },
  btnPrimary: {
    width: "100%",
    padding: "12px 20px",
    background: "#5865f2",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease",
    fontFamily: "'Outfit', sans-serif",
    marginTop: "10px",
    boxShadow: "0 4px 14px rgba(88, 101, 242, 0.35)",
    "&:hover": {
      background: "#4752c4",
      boxShadow: "0 6px 20px rgba(88, 101, 242, 0.5)",
    },
    "&:active": {
      transform: "scale(0.98)",
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },
  footer: {
    textAlign: "center",
    marginTop: "24px",
    fontSize: "0.82rem",
    color: "#a0aec0",
    fontFamily: "'Outfit', sans-serif",
  },
  link: {
    color: "#5865f2",
    textDecoration: "none",
    fontWeight: 600,
    transition: "color 0.2s ease",
    "&:hover": {
      color: "#818cf8",
      textDecoration: "underline",
    },
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

  return (
    <div className={classes.pageContainer}>
      <div className={classes.signupContainer}>
        <div className={classes.header}>
          <div className={classes.logoIcon}>📱</div>
          <h1 className={classes.title}>VERITAS</h1>
          <p className={classes.subtitle}>Crie sua conta no sistema</p>
        </div>

        <Formik
          initialValues={user}
          enableReinitialize={true}
          validationSchema={UserSchema}
          onSubmit={(values, actions) => {
            handleSignUp(values);
            actions.setSubmitting(false);
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form>
              <div className={classes.inputGroup}>
                <label className={classes.label} htmlFor="name">
                  Nome Completo
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Seu nome"
                  value={values.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`${classes.input} ${touched.name && errors.name ? classes.inputError : ""}`}
                  autoFocus
                />
                {touched.name && errors.name && (
                  <div className={classes.errorText}>{errors.name}</div>
                )}
              </div>

              <div className={classes.inputGroup}>
                <label className={classes.label} htmlFor="email">
                  E-mail
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="seuemail@empresa.com"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`${classes.input} ${touched.email && errors.email ? classes.inputError : ""}`}
                />
                {touched.email && errors.email && (
                  <div className={classes.errorText}>{errors.email}</div>
                )}
              </div>

              <div className={classes.inputGroup}>
                <label className={classes.label} htmlFor="password">
                  Senha
                </label>
                <div className={classes.passwordWrapper}>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    placeholder="Sua senha secreta"
                    value={values.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${classes.passwordInput} ${touched.password && errors.password ? classes.inputError : ""}`}
                  />
                  <button
                    type="button"
                    className={classes.togglePasswordBtn}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="toggle password visibility"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </button>
                </div>
                {touched.password && errors.password && (
                  <div className={classes.errorText}>{errors.password}</div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={classes.btnPrimary}
              >
                Cadastrar
              </button>
            </Form>
          )}
        </Formik>

        <div className={classes.footer}>
          Já possui conta?{" "}
          <RouterLink to="/login" className={classes.link}>
            Entrar
          </RouterLink>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
