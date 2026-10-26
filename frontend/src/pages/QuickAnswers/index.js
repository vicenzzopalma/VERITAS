import React, { useState, useEffect, useReducer } from "react";
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
import {
  EditOutlined,
  DeleteOutline,
  Add,
  FlashOnOutlined,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import { PageHeader, SearchField, EmptyState } from "../../components/ui";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import QuickAnswersModal from "../../components/QuickAnswersModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const reducer = (state, action) => {
  if (action.type === "LOAD_QUICK_ANSWERS") {
    const quickAnswers = action.payload;
    const newQuickAnswers = [];

    quickAnswers.forEach((quickAnswer) => {
      const quickAnswerIndex = state.findIndex((q) => q.id === quickAnswer.id);
      if (quickAnswerIndex !== -1) {
        state[quickAnswerIndex] = quickAnswer;
      } else {
        newQuickAnswers.push(quickAnswer);
      }
    });

    return [...state, ...newQuickAnswers];
  }

  if (action.type === "UPDATE_QUICK_ANSWERS") {
    const quickAnswer = action.payload;
    const quickAnswerIndex = state.findIndex((q) => q.id === quickAnswer.id);

    if (quickAnswerIndex !== -1) {
      state[quickAnswerIndex] = quickAnswer;
      return [...state];
    } else {
      return [quickAnswer, ...state];
    }
  }

  if (action.type === "DELETE_QUICK_ANSWERS") {
    const quickAnswerId = action.payload;

    const quickAnswerIndex = state.findIndex((q) => q.id === quickAnswerId);
    if (quickAnswerIndex !== -1) {
      state.splice(quickAnswerIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  tableCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
  shortcut: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 8,
    fontFamily: "monospace",
    fontSize: "0.8rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
    color: theme.palette.primary.main,
    backgroundColor: theme.custom.primarySoft,
  },
  message: {
    color: theme.palette.text.secondary,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    whiteSpace: "pre-line",
    wordBreak: "break-word",
    maxWidth: 720,
  },
  actions: {
    whiteSpace: "nowrap",
    "& > *:not(:first-child)": { marginLeft: 4 },
  },
  deleteBtn: {
    "&:hover": { color: theme.palette.error.main },
  },
}));

const QuickAnswers = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [quickAnswers, dispatch] = useReducer(reducer, []);
  const [selectedQuickAnswers, setSelectedQuickAnswers] = useState(null);
  const [quickAnswersModalOpen, setQuickAnswersModalOpen] = useState(false);
  const [deletingQuickAnswers, setDeletingQuickAnswers] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchQuickAnswers = async () => {
        try {
          const { data } = await api.get("/quickAnswers/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_QUICK_ANSWERS", payload: data.quickAnswers });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchQuickAnswers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("quickAnswer", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUICK_ANSWERS", payload: data.quickAnswer });
      }

      if (data.action === "delete") {
        dispatch({
          type: "DELETE_QUICK_ANSWERS",
          payload: +data.quickAnswerId,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenQuickAnswersModal = () => {
    setSelectedQuickAnswers(null);
    setQuickAnswersModalOpen(true);
  };

  const handleCloseQuickAnswersModal = () => {
    setSelectedQuickAnswers(null);
    setQuickAnswersModalOpen(false);
  };

  const handleEditQuickAnswers = (quickAnswer) => {
    setSelectedQuickAnswers(quickAnswer);
    setQuickAnswersModalOpen(true);
  };

  const handleDeleteQuickAnswers = async (quickAnswerId) => {
    try {
      await api.delete(`/quickAnswers/${quickAnswerId}`);
      toast.success(i18n.t("quickAnswers.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingQuickAnswers(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingQuickAnswers &&
          `${i18n.t("quickAnswers.confirmationModal.deleteTitle")} ${
            deletingQuickAnswers.shortcut
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteQuickAnswers(deletingQuickAnswers.id)}
      >
        {i18n.t("quickAnswers.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QuickAnswersModal
        open={quickAnswersModalOpen}
        onClose={handleCloseQuickAnswersModal}
        aria-labelledby="form-dialog-title"
        quickAnswerId={selectedQuickAnswers && selectedQuickAnswers.id}
      ></QuickAnswersModal>
      <PageHeader
        icon={<FlashOnOutlined />}
        title={i18n.t("quickAnswers.title")}
        subtitle="Respostas prontas para agilizar o atendimento com atalhos."
        actions={
          <>
            <SearchField
              placeholder={i18n.t("quickAnswers.searchPlaceholder")}
              type="search"
              value={searchParam}
              onChange={handleSearch}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={handleOpenQuickAnswersModal}
            >
              {i18n.t("quickAnswers.buttons.add")}
            </Button>
          </>
        }
      />
      <Paper className={classes.tableCard} onScroll={handleScroll}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell style={{ width: 200 }}>
                {i18n.t("quickAnswers.table.shortcut")}
              </TableCell>
              <TableCell>{i18n.t("quickAnswers.table.message")}</TableCell>
              <TableCell align="right" style={{ width: 120 }}>
                {i18n.t("quickAnswers.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {quickAnswers.map((quickAnswer) => (
                <TableRow key={quickAnswer.id} hover>
                  <TableCell>
                    <span className={classes.shortcut}>
                      {quickAnswer.shortcut}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" className={classes.message}>
                      {quickAnswer.message}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" className={classes.actions}>
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => handleEditQuickAnswers(quickAnswer)}
                      >
                        <EditOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton
                        size="small"
                        className={classes.deleteBtn}
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingQuickAnswers(quickAnswer);
                        }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {loading && (
                <TableRowSkeleton
                  columns={3}
                  rows={quickAnswers.length ? 1 : 5}
                />
              )}
            </>
          </TableBody>
        </Table>
        {!loading && quickAnswers.length === 0 && (
          <EmptyState
            icon={<FlashOnOutlined />}
            title={
              searchParam
                ? "Nenhuma resposta encontrada"
                : "Nenhuma resposta rápida ainda"
            }
            description={
              searchParam
                ? "Tente buscar por outro atalho ou trecho da mensagem."
                : "Crie mensagens prontas e use-as no chat digitando / seguido do atalho."
            }
            action={
              !searchParam && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Add />}
                  onClick={handleOpenQuickAnswersModal}
                >
                  {i18n.t("quickAnswers.buttons.add")}
                </Button>
              )
            }
          />
        )}
      </Paper>
    </MainContainer>
  );
};

export default QuickAnswers;
