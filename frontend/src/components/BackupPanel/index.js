import React, { useState, useEffect, useCallback } from "react";
import { makeStyles, useTheme, alpha } from "@material-ui/core/styles";
import {
  Grid,
  LinearProgress,
  IconButton,
  Tooltip,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from "@material-ui/core";
import RefreshIcon from "@material-ui/icons/Refresh";
import StorageIcon from "@material-ui/icons/Storage";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import ErrorOutlineIcon from "@material-ui/icons/ErrorOutline";
import WarningIcon from "@material-ui/icons/Warning";
import ScheduleIcon from "@material-ui/icons/Schedule";
import FolderSpecialIcon from "@material-ui/icons/FolderSpecial";
import HistoryIcon from "@material-ui/icons/History";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { parseISO, format } from "date-fns";
import { SectionCard, StatusPill, EmptyState, toneColor } from "../ui";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const useStyles = makeStyles(theme => {
  const c = theme.custom;
  return {
    root: {
      marginBottom: theme.spacing(2)
    },
    headIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      display: "grid",
      placeItems: "center",
      flex: "none",
      color: theme.palette.primary.main,
      backgroundColor: c.primarySoft,
      marginRight: theme.spacing(0.5),
      "& svg": { fontSize: 18 }
    },
    pathText: { fontFamily: MONO, fontSize: "0.76rem" },
    healthBanner: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: theme.spacing(1.75),
      padding: theme.spacing(1.75, 2),
      borderRadius: 12,
      border: "1px solid",
      marginBottom: theme.spacing(2)
    },
    healthIcon: {
      width: 40,
      height: 40,
      borderRadius: 11,
      display: "grid",
      placeItems: "center",
      flex: "none",
      "& svg": { fontSize: 22 }
    },
    healthText: { flex: 1, minWidth: 140 },
    healthLabel: { fontWeight: 700, fontSize: "0.95rem", color: c.text },
    healthSub: { fontSize: "0.8rem", color: c.textMuted, marginTop: 2 },
    card: {
      padding: theme.spacing(1.75, 2),
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      gap: 4
    },
    cardLabel: {
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: c.textSubtle,
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
      "& svg": { fontSize: 15 }
    },
    cardValue: {
      fontWeight: 700,
      fontSize: "1.02rem",
      color: c.text,
      letterSpacing: "-0.01em"
    },
    cardFoot: { fontSize: "0.78rem", color: c.textMuted },
    progressContainer: {
      marginTop: theme.spacing(0.75),
      marginBottom: theme.spacing(0.25)
    },
    progressDanger: {
      backgroundColor: alpha(theme.palette.error.main, 0.15),
      "& .MuiLinearProgress-bar": { backgroundColor: theme.palette.error.main }
    },
    errorBox: {
      marginTop: theme.spacing(2),
      padding: theme.spacing(1.5, 2),
      backgroundColor: alpha(theme.palette.error.main, theme.palette.type === "dark" ? 0.12 : 0.06),
      border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
      borderLeft: `3px solid ${theme.palette.error.main}`,
      borderRadius: 10
    },
    errorTitle: {
      fontWeight: 700,
      fontSize: "0.82rem",
      color: theme.palette.error.main,
      marginBottom: 4
    },
    errorText: {
      whiteSpace: "pre-wrap",
      fontFamily: MONO,
      fontSize: "0.78rem",
      color: c.text
    },
    historyHead: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
      marginTop: theme.spacing(3),
      marginBottom: theme.spacing(1.25),
      fontWeight: 700,
      fontSize: "0.9rem",
      color: c.text,
      "& svg": { fontSize: 18, color: c.textMuted }
    },
    historyCount: {
      marginLeft: "auto",
      fontSize: "0.76rem",
      fontWeight: 600,
      color: c.textSubtle
    },
    tableContainer: {
      maxHeight: 320,
      overflow: "auto",
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      ...theme.scrollbarStyles
    },
    table: {
      "& tbody tr:last-child td": { borderBottom: "none" }
    },
    dateCell: { whiteSpace: "nowrap", fontWeight: 600, color: c.text },
    mutedCell: { color: c.textMuted, whiteSpace: "nowrap" },
    pathCell: { fontSize: "0.75rem", fontFamily: MONO, color: c.textMuted }
  };
});

const formatBytes = bytes => {
  if (!bytes || isNaN(bytes) || bytes === 0) return "0 B";
  const num = Number(bytes);
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDuration = seconds => {
  if (!seconds || isNaN(seconds)) return "-";
  const sec = Number(seconds);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
};

const formatDate = dateString => {
  if (!dateString) return "-";
  try {
    return format(parseISO(dateString), "dd/MM/yyyy HH:mm:ss");
  } catch (e) {
    return dateString;
  }
};

const BackupPanel = () => {
  const classes = useStyles();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.all([
        api.get("/backups/status"),
        api.get("/backups/history")
      ]);
      setStatusData(statusRes.data);
      setHistory(historyRes.data.logs || []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const latest = statusData?.latest;
  const health = statusData?.health || "NO_BACKUP";

  const getHealthBadge = () => {
    switch (health) {
      case "HEALTHY":
        return {
          label: "Saudável / Atualizado",
          tone: "success",
          icon: <CheckCircleOutlineIcon />
        };
      case "OVERDUE":
        return {
          label: "Alerta: Backup Atrasado (> 24h)",
          tone: "error",
          icon: <WarningIcon />
        };
      case "DISK_LOW":
        return {
          label: "Atenção: Espaço em Disco Crítico",
          tone: "warning",
          icon: <WarningIcon />
        };
      case "CRITICAL":
        return {
          label: "Falha na Última Execução",
          tone: "error",
          icon: <ErrorOutlineIcon />
        };
      default:
        return {
          label: "Aguardando Primeira Execução",
          tone: "neutral",
          icon: <ScheduleIcon />
        };
    }
  };

  const badge = getHealthBadge();
  const badgeColor = toneColor(theme, badge.tone);
  const isDark = theme.palette.type === "dark";

  const logTone = status =>
    status === "SUCCESS" ? "success" : status === "WARNING" ? "warning" : "error";

  // Disk calculations
  const totalDisk = Number(latest?.diskTotalSpaceBytes || 0);
  const freeDisk = Number(latest?.diskFreeSpaceBytes || 0);
  const usedDisk = totalDisk > freeDisk ? totalDisk - freeDisk : 0;
  const usedPercent = totalDisk > 0 ? Math.min(100, Math.round((usedDisk / totalDisk) * 100)) : 0;

  return (
    <div className={classes.root}>
      <SectionCard
        title="Status dos Backups do Servidor (Master)"
        subtitle={
          <>
            Destino local autônomo: <span className={classes.pathText}>T:\DEV\BACKUP.VERITAS</span>
          </>
        }
        icon={
          <div className={classes.headIcon}>
            <StorageIcon />
          </div>
        }
        actions={
          <Tooltip title="Atualizar Informações">
            <span>
              <IconButton onClick={fetchData} disabled={loading} size="small">
                {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        }
      >
        {/* Status Geral */}
        <div
          className={classes.healthBanner}
          style={{
            backgroundColor: alpha(badgeColor, isDark ? 0.1 : 0.06),
            borderColor: alpha(badgeColor, 0.25)
          }}
        >
          <div
            className={classes.healthIcon}
            style={{ color: badgeColor, backgroundColor: alpha(badgeColor, isDark ? 0.18 : 0.12) }}
          >
            {badge.icon}
          </div>
          <div className={classes.healthText}>
            <div className={classes.healthLabel}>Saúde do Sistema</div>
            <div className={classes.healthSub}>
              {statusData?.hoursSinceLastBackup != null
                ? `Último registro há ${statusData.hoursSinceLastBackup}h`
                : "Nenhum registro ainda"}
            </div>
          </div>
          <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
        </div>

        <Grid container spacing={2}>
          {/* Última Execução */}
          <Grid item xs={12} sm={4}>
            <div className={classes.card}>
              <div className={classes.cardLabel}>
                <ScheduleIcon /> Última Execução
              </div>
              <div className={classes.cardValue}>
                {latest ? formatDate(latest.finishedAt || latest.createdAt) : "Nunca executado"}
              </div>
              <div className={classes.cardFoot}>
                Duração: {formatDuration(latest?.durationSeconds)}
              </div>
            </div>
          </Grid>

          {/* Dados do Snapshot */}
          <Grid item xs={12} sm={4}>
            <div className={classes.card}>
              <div className={classes.cardLabel}>
                <FolderSpecialIcon /> Tamanho do Backup
              </div>
              <div className={classes.cardValue}>
                Banco: {formatBytes(latest?.dbSizeBytes)}
              </div>
              <div className={classes.cardFoot}>
                Mídias sincronizadas: {latest?.mediaFilesCount ? `${latest.mediaFilesCount} arquivos` : "Incremental"}
              </div>
            </div>
          </Grid>

          {/* Espaço em Disco T: */}
          <Grid item xs={12} sm={4}>
            <div className={classes.card}>
              <div className={classes.cardLabel}>
                <StorageIcon /> Disco T: (Livre / Total)
              </div>
              <div className={classes.cardValue} style={{ fontSize: "0.92rem" }}>
                {formatBytes(freeDisk)} livres de {formatBytes(totalDisk)}
              </div>
              <div className={classes.progressContainer}>
                <LinearProgress
                  variant="determinate"
                  value={usedPercent}
                  color="primary"
                  className={usedPercent > 90 ? classes.progressDanger : undefined}
                />
              </div>
              <div className={classes.cardFoot}>
                {usedPercent}% ocupado
              </div>
            </div>
          </Grid>
        </Grid>

        {/* Mensagem de Erro (se houver na última execução) */}
        {latest?.errorMessage && (
          <div className={classes.errorBox}>
            <div className={classes.errorTitle}>
              Detalhes do erro na última execução:
            </div>
            <div className={classes.errorText}>
              {latest.errorMessage}
            </div>
          </div>
        )}

        {/* Tabela de Histórico Recente */}
        <div className={classes.historyHead}>
          <HistoryIcon />
          Histórico das Últimas Execuções
          {history.length > 0 && (
            <span className={classes.historyCount}>{history.length} registros</span>
          )}
        </div>
        <div className={classes.tableContainer}>
          {history.length === 0 ? (
            <EmptyState
              tone="neutral"
              icon={<HistoryIcon />}
              description="Nenhum histórico de backup registrado no servidor até o momento."
            />
          ) : (
            <Table size="small" stickyHeader className={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell>Data/Hora</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Duração</TableCell>
                  <TableCell>Dump MySQL</TableCell>
                  <TableCell>Espaço Livre T:</TableCell>
                  <TableCell>Destino</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map(item => (
                  <TableRow key={item.id} hover>
                    <TableCell className={classes.dateCell}>
                      {formatDate(item.finishedAt || item.createdAt)}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={logTone(item.status)}>{item.status}</StatusPill>
                    </TableCell>
                    <TableCell className={classes.mutedCell}>{formatDuration(item.durationSeconds)}</TableCell>
                    <TableCell className={classes.mutedCell}>{formatBytes(item.dbSizeBytes)}</TableCell>
                    <TableCell className={classes.mutedCell}>{formatBytes(item.diskFreeSpaceBytes)}</TableCell>
                    <TableCell className={classes.pathCell}>
                      {item.backupPath || "T:\\DEV\\BACKUP.VERITAS"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default BackupPanel;
