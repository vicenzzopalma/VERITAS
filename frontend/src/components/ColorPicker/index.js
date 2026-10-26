import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, IconButton, Typography } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import CheckIcon from "@material-ui/icons/Check";
import CloseIcon from "@material-ui/icons/Close";

const colors = [
  "#B80000",
  "#DB3E00",
  "#FCCB00",
  "#008B02",
  "#006B76",
  "#1273DE",
  "#004DCF",
  "#5300EB",
  "#EB9694",
  "#FAD0C3",
  "#FEF3BD",
  "#C1E1C5",
  "#BEDADC",
  "#C4DEF6",
  "#BED3F3",
  "#D4C4FB",
  "#4D4D4D",
  "#999999",
  "#FFFFFF",
  "#F44E3B",
  "#FE9200",
  "#FCDC00",
  "#DBDF00",
  "#A4DD00",
  "#68CCCA",
  "#73D8FF",
  "#AEA1FF",
  "#FDA1FF",
  "#333333",
  "#808080",
  "#cccccc",
  "#D33115",
  "#E27300",
  "#FCC400",
  "#B0BC00",
  "#68BC00",
  "#16A5A5",
  "#009CE0",
  "#7B64FF",
  "#FA28FF",
  "#666666",
  "#B3B3B3",
  "#9F0500",
  "#C45100",
  "#FB9E00",
  "#808900",
  "#194D33",
  "#0C797D",
  "#0062B1",
  "#653294",
  "#AB149E",
];

// Perceived luminance, used to pick a readable check-mark color.
const isLight = (hex) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substr(0, 2), 16);
  const g = parseInt(h.substr(2, 2), 16);
  const b = parseInt(h.substr(4, 2), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
};

const useStyles = makeStyles((theme) => ({
  header: {
    display: "flex",
    alignItems: "flex-start",
    padding: theme.spacing(2.5, 2, 1, 3),
  },
  title: { fontWeight: 700, fontSize: "1.05rem" },
  subtitle: { color: theme.palette.text.secondary, fontSize: "0.82rem", marginTop: 2 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(30px, 1fr))",
    gap: 10,
    padding: theme.spacing(1, 0, 2),
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: `1px solid ${theme.custom.border}`,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    padding: 0,
    outline: "none",
    transition: "transform .12s, box-shadow .12s",
    "&:hover": { transform: "scale(1.12)" },
    "&:focus-visible": { boxShadow: `0 0 0 3px ${theme.custom.primarySoft}` },
    "& svg": { fontSize: 16 },
  },
  selected: {
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 4px ${theme.palette.primary.main}`,
  },
}));

const ColorPicker = ({ onChange, currentColor, handleClose, open }) => {
  const classes = useStyles();
  const [selectedColor, setSelectedColor] = useState(currentColor);

  useEffect(() => {
    if (open) setSelectedColor(currentColor);
  }, [open, currentColor]);

  const handleChange = (hex) => {
    setSelectedColor(hex);
    handleClose();
    onChange(hex);
  };

  return (
    <Dialog
      onClose={handleClose}
      aria-labelledby="color-picker-title"
      open={open}
      maxWidth="xs"
      fullWidth
    >
      <div className={classes.header}>
        <div style={{ flex: 1 }}>
          <Typography id="color-picker-title" component="h2" className={classes.title}>
            Escolha uma cor
          </Typography>
          <Typography className={classes.subtitle}>
            Usada para identificar a fila nos atendimentos.
          </Typography>
        </div>
        <IconButton size="small" onClick={handleClose} aria-label="Fechar">
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <DialogContent>
        <div className={classes.grid}>
          {colors.map((hex) => {
            const active =
              selectedColor && selectedColor.toLowerCase() === hex.toLowerCase();
            return (
              <button
                type="button"
                key={hex}
                title={hex}
                aria-label={hex}
                className={`${classes.swatch} ${active ? classes.selected : ""}`}
                style={{ backgroundColor: hex, color: isLight(hex) ? "#111" : "#fff" }}
                onClick={() => handleChange(hex)}
              >
                {active && <CheckIcon />}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColorPicker;
