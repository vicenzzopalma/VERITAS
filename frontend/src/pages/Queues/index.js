import React, { useEffect, useReducer, useState } from "react";

import openSocket from "../../services/socket-io";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@material-ui/core";

import MainContainer from "../../components/MainContainer";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import { PageHeader, EmptyState } from "../../components/ui";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import {
  DeleteOutline,
  EditOutlined,
  Add,
  AccountTreeOutlined,
} from "@material-ui/icons";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  tableCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  queueName: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    fontWeight: 600,
    color: theme.palette.text.primary,
  },
  queueDot: {
    flex: "none",
    width: 10,
    height: 10,
    borderRadius: "50%",
    boxShadow: `0 0 0 3px ${theme.custom.surfaceAlt}`,
  },
  colorChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 10px 3px 4px",
    borderRadius: 999,
    border: `1px solid ${theme.custom.border}`,
    backgroundColor: theme.custom.surfaceAlt,
    fontFamily: "monospace",
    fontSize: "0.76rem",
    color: theme.palette.text.secondary,
    textTransform: "uppercase",
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    border: `1px solid ${theme.custom.border}`,
  },
  greeting: {
    maxWidth: 420,
    color: theme.palette.text.secondary,
  },
  muted: { color: theme.custom.textSubtle },
  actions: {
    whiteSpace: "nowrap",
    "& > *:not(:first-child)": { marginLeft: 4 },
  },
  deleteBtn: {
    "&:hover": { color: theme.palette.error.main },
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_QUEUES") {
    const queues = action.payload;
    const newQueues = [];

    queues.forEach((queue) => {
      const queueIndex = state.findIndex((q) => q.id === queue.id);
      if (queueIndex !== -1) {
        state[queueIndex] = queue;
      } else {
        newQueues.push(queue);
      }
    });

    return [...state, ...newQueues];
  }

  if (action.type === "UPDATE_QUEUES") {
    const queue = action.payload;
    const queueIndex = state.findIndex((u) => u.id === queue.id);

    if (queueIndex !== -1) {
      state[queueIndex] = queue;
      return [...state];
    } else {
      return [queue, ...state];
    }
  }

  if (action.type === "DELETE_QUEUE") {
    const queueId = action.payload;
    const queueIndex = state.findIndex((q) => q.id === queueId);
    if (queueIndex !== -1) {
      state.splice(queueIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Queues = () => {
  const classes = useStyles();

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/queue");
        dispatch({ type: "LOAD_QUEUES", payload: data });

        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const socket = openSocket();

    socket.on("queue", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenQueueModal = () => {
    setQueueModalOpen(true);
    setSelectedQueue(null);
  };

  const handleCloseQueueModal = () => {
    setQueueModalOpen(false);
    setSelectedQueue(null);
  };

  const handleEditQueue = (queue) => {
    setSelectedQueue(queue);
    setQueueModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (queueId) => {
    try {
      await api.delete(`/queue/${queueId}`);
      toast.success(i18n.t("Queue deleted successfully!"));
    } catch (err) {
      toastError(err);
    }
    setSelectedQueue(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedQueue &&
          `${i18n.t("queues.confirmationModal.deleteTitle")} ${
            selectedQueue.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queues.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QueueModal
        open={queueModalOpen}
        onClose={handleCloseQueueModal}
        queueId={selectedQueue?.id}
      />
      <PageHeader
        icon={<AccountTreeOutlined />}
        title={i18n.t("queues.title")}
        subtitle="Organize os atendimentos por setor, com cor e saudação próprias."
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleOpenQueueModal}
          >
            {i18n.t("queues.buttons.add")}
          </Button>
        }
      />
      <Paper className={classes.tableCard}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("queues.table.name")}</TableCell>
              <TableCell>{i18n.t("queues.table.color")}</TableCell>
              <TableCell>{i18n.t("queues.table.greeting")}</TableCell>
              <TableCell align="right">
                {i18n.t("queues.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {queues.map((queue) => (
                <TableRow key={queue.id} hover>
                  <TableCell>
                    <div className={classes.queueName}>
                      <span
                        className={classes.queueDot}
                        style={{ backgroundColor: queue.color }}
                      />
                      {queue.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={classes.colorChip}>
                      <span
                        className={classes.colorSwatch}
                        style={{ backgroundColor: queue.color }}
                      />
                      {queue.color}
                    </span>
                  </TableCell>
                  <TableCell>
                    {queue.greetingMessage ? (
                      <Tooltip
                        title={queue.greetingMessage}
                        placement="bottom-start"
                        enterDelay={400}
                      >
                        <Typography
                          className={classes.greeting}
                          noWrap
                          variant="body2"
                        >
                          {queue.greetingMessage}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <span className={classes.muted}>Sem saudação</span>
                    )}
                  </TableCell>
                  <TableCell align="right" className={classes.actions}>
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => handleEditQueue(queue)}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        className={classes.deleteBtn}
                        onClick={() => {
                          setSelectedQueue(queue);
                          setConfirmModalOpen(true);
                        }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRowSkeleton columns={4} rows={queues.length ? 1 : 4} />
              )}
            </>
          </TableBody>
        </Table>
        {!loading && queues.length === 0 && (
          <EmptyState
            icon={<AccountTreeOutlined />}
            title="Nenhuma fila criada"
            description="Crie filas para direcionar os clientes ao setor certo, como Vendas ou Suporte."
            action={
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={handleOpenQueueModal}
              >
                {i18n.t("queues.buttons.add")}
              </Button>
            }
          />
        )}
      </Paper>
    </MainContainer>
  );
};

export default Queues;
