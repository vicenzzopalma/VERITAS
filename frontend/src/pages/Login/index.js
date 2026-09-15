import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";

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
  loginContainer: {
    width: "100%",
    maxWidth: "420px",
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
  loginHeader: {
    textAlign: "center",
    marginBottom: "30px",
  },
  logoIcon: {
    fontSize: "3rem",
    marginBottom: "10px",
    userSelect: "none",
    filter: "drop-shadow(0 4px 12px rgba(88, 101, 242, 0.35))",
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: 800,
    letterSpacing: "-0.5px",
    marginBottom: "5px",
    color: "#f8f9fa",
    fontFamily: "'Outfit', sans-serif",
    margin: 0,
  },
  subtitle: {
    color: "#a0aec0",
    fontSize: "0.95rem",
    marginTop: "6px",
    marginBottom: 0,
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 400,
  },
  form: {
    width: "100%",
  },
  inputGroup: {
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#a0aec0",
    marginBottom: "8px",
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
  },
  loginFooter: {
    textAlign: "center",
    marginTop: "26px",
    fontSize: "0.82rem",
    color: "#a0aec0",
    fontFamily: "'Outfit', sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  registerLink: {
    color: "#5865f2",
    textDecoration: "none",
    fontWeight: 600,
    transition: "color 0.2s ease",
    "&:hover": {
      color: "#818cf8",
      textDecoration: "underline",
    },
  },
  copyrightText: {
    color: "rgba(160, 174, 192, 0.6)",
    fontSize: "0.78rem",
    margin: 0,
  }
}));

const Login = () => {
  const classes = useStyles();
  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const { handleLogin } = useContext(AuthContext);

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleLogin(user);
  };

  return (
    <div className={classes.pageContainer}>
      <div className={classes.loginContainer}>
        <div className={classes.loginHeader}>
          <div className={classes.logoIcon}>📱</div>
          <h1 className={classes.title}>VERITAS</h1>
          <p className={classes.subtitle}>Acesse o painel do sistema</p>
        </div>

        <form className={classes.form} noValidate onSubmit={handleSubmit}>
          <div className={classes.inputGroup}>
            <label className={classes.label} htmlFor="email">
              Usuário
            </label>
            <input
              type="text"
              id="email"
              name="email"
              required
              autoComplete="username"
              placeholder="Seu nome de usuário ou email"
              value={user.email}
              onChange={handleChangeInput}
              autoFocus
              className={classes.input}
            />
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
                required
                autoComplete="current-password"
                placeholder="Sua senha secreta"
                value={user.password}
                onChange={handleChangeInput}
                className={classes.passwordInput}
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
          </div>

          <button type="submit" className={classes.btnPrimary}>
            Entrar no Painel
          </button>
        </form>

        <div className={classes.loginFooter}>
          <div>
            Não possui acesso?{" "}
            <RouterLink to="/signup" className={classes.registerLink}>
              Cadastre-se
            </RouterLink>
          </div>
          <p className={classes.copyrightText}>
            Desenvolvido para Realess &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
