import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Link,
  makeStyles,
} from "@material-ui/core";
import { Visibility, VisibilityOff, MailOutline, LockOutlined } from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import AuthShell from "../../components/AuthShell";

const useStyles = makeStyles((theme) => ({
  form: { display: "flex", flexDirection: "column", gap: theme.spacing(2) },
  adornIcon: { color: theme.custom.textSubtle, fontSize: 20 },
  submit: { height: 46, fontSize: "0.95rem", marginTop: theme.spacing(1) },
  alt: { textAlign: "center", fontSize: "0.86rem", color: theme.custom.textMuted, marginTop: theme.spacing(1) },
}));

const Login = () => {
  const classes = useStyles();
  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const { handleLogin } = useContext(AuthContext);

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handlSubmit = (e) => {
    e.preventDefault();
    handleLogin(user);
  };

  return (
    <AuthShell title="Bem-vindo de volta" subtitle="Entre com sua conta para acessar o painel.">
      <form className={classes.form} noValidate onSubmit={handlSubmit}>
        <TextField
          variant="outlined"
          required
          fullWidth
          id="email"
          label={i18n.t("login.form.email")}
          name="email"
          value={user.email}
          onChange={handleChangeInput}
          autoComplete="email"
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <MailOutline className={classes.adornIcon} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          variant="outlined"
          required
          fullWidth
          name="password"
          label={i18n.t("login.form.password")}
          id="password"
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
        <Button type="submit" fullWidth variant="contained" color="primary" className={classes.submit}>
          {i18n.t("login.buttons.submit")}
        </Button>
        <div className={classes.alt}>
          <Link component={RouterLink} to="/signup" style={{ fontWeight: 600 }}>
            {i18n.t("login.buttons.register")}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
};

export default Login;
