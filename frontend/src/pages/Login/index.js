import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
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
  LockOutlined,
  CheckCircle,
} from "@material-ui/icons";

import { AuthContext } from "../../context/Auth/AuthContext";
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
  copyright: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    width: "100%",
    margin: theme.spacing(1, 0, 0),
    fontSize: "0.78rem",
    color: theme.custom.textSubtle,
  },
  verificationBadge: {
    color: theme.palette.primary.main,
    fontSize: 16,
  },
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
    <AuthShell title="Bem-vindo de volta" subtitle="Acesse o painel do sistema." hideFooter>
      <form className={classes.form} noValidate onSubmit={handleSubmit}>
        <TextField
          variant="outlined"
          required
          fullWidth
          type="text"
          id="email"
          name="email"
          label="Usuário"
          placeholder="Seu nome de usuário ou email"
          value={user.email}
          onChange={handleChangeInput}
          autoComplete="username"
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutline className={classes.adornIcon} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          variant="outlined"
          required
          fullWidth
          id="password"
          name="password"
          label="Senha"
          placeholder="Sua senha secreta"
          value={user.password}
          onChange={handleChangeInput}
          autoComplete="current-password"
          type={showPassword ? "text" : "password"}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined className={classes.adornIcon} />
              </InputAdornment>
            ),
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
        <Button type="submit" fullWidth variant="contained" color="primary" className={classes.submit}>
          Entrar no Painel
        </Button>
        <div className={classes.alt}>
          Não possui acesso?{" "}
          <Link component={RouterLink} to="/signup" style={{ fontWeight: 600 }}>
            Cadastre-se
          </Link>
        </div>
        <p className={classes.copyright}>
          <span>Desenvolvido por Vicenzzo Palma Mastronikolis &copy; 2026</span>
          <CheckCircle className={classes.verificationBadge} titleAccess="Desenvolvedor verificado" />
        </p>
      </form>
    </AuthShell>
  );
};

export default Login;
