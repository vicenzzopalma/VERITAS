import React, { useState, useEffect, useRef, useContext } from "react";

import clsx from "clsx";
import { makeStyles, alpha } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsList";
import TabPanel from "../TabPanel";
import { SearchField } from "../ui";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";

const useStyles = makeStyles((theme) => {
  const c = theme.custom;
  return {
    ticketsWrapper: {
      position: "relative",
      display: "flex",
      height: "100%",
      flexDirection: "column",
      overflow: "hidden",
      borderRadius: 16,
      backgroundColor: c.surface,
      color: theme.palette.text.primary,
    },
    panel: {
      position: "relative",
      display: "flex",
      flex: 1,
      minHeight: 0,
      flexDirection: "column",
      overflow: "hidden",
    },
    listArea: {
      position: "relative",
      display: "flex",
      flex: 1,
      minHeight: 0,
      flexDirection: "column",
      overflow: "hidden",
      border: "none",
      borderRadius: 0,
      backgroundColor: "transparent",
    },
    header: {
      flex: "none",
      padding: theme.spacing(1.5, 1.5, 1),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.25),
      borderBottom: `1px solid ${c.border}`,
    },
    // Segmented / pill style tabs
    pillTabs: {
      minHeight: 0,
      padding: 4,
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      border: `1px solid ${c.border}`,
    },
    pillIndicator: {
      display: "none",
    },
    pillTab: {
      minHeight: 34,
      minWidth: 0,
      padding: "4px 10px",
      borderRadius: 9,
      fontSize: "0.82rem",
      fontWeight: 600,
      color: c.textMuted,
      opacity: 1,
      transition: "background-color .15s, color .15s, box-shadow .15s",
      "@media (min-width: 600px)": { minWidth: 0 },
      "&:hover": { color: theme.palette.text.primary },
      "&$pillSelected": {
        color: theme.palette.primary.main,
        backgroundColor: c.surface,
        boxShadow: c.shadow,
      },
    },
    pillSelected: {},
    pillLabelIcon: {
      minHeight: 34,
      paddingTop: 4,
    },
    pillWrapper: {
      flexDirection: "row",
      gap: 6,
      "& > *:first-child": { marginBottom: "0 !important", fontSize: 17 },
    },
    toolbar: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing(1),
    },
    search: {
      flex: 1,
      minWidth: 0,
      height: 38,
    },
    filtersRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing(1),
      minHeight: 32,
    },
    showAllLabel: {
      marginLeft: 0,
      marginRight: 0,
      "& .MuiFormControlLabel-label": {
        fontSize: "0.8rem",
        fontWeight: 600,
        color: c.textMuted,
      },
    },
    subTabsWrap: {
      flex: "none",
      padding: theme.spacing(1, 1.5),
      borderBottom: `1px solid ${c.border}`,
    },
    count: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 20,
      height: 20,
      padding: "0 6px",
      borderRadius: 999,
      fontSize: "0.7rem",
      fontWeight: 700,
      backgroundColor: c.surfaceHover,
      color: c.textMuted,
    },
    countPrimary: {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
    },
    countAccent: {
      backgroundColor: alpha(theme.palette.secondary.main, 0.16),
      color: theme.palette.secondary.main,
    },
    tabLabel: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    show: {
      display: "block",
    },
    hide: {
      display: "none !important",
    },
  };
});

const TicketsManager = () => {
  const classes = useStyles();
  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);

  useEffect(() => {
    if (["ADMIN", "ADMIN_MASTER", "ADMIN_OPERATIONAL"].includes(String(user?.profile || "").toUpperCase())) {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchTimeoutRef = useRef(null);

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchedTerm === "") {
      setSearchParam("");
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 400);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const pillTabClasses = {
    root: classes.pillTab,
    selected: classes.pillSelected,
    labelIcon: classes.pillLabelIcon,
    wrapper: classes.pillWrapper,
  };

  const pillTabsClasses = {
    root: classes.pillTabs,
    indicator: classes.pillIndicator,
  };

  return (
    <Paper elevation={0} className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={() => setNewTicketModalOpen(false)}
      />
      <div className={classes.header}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          classes={pillTabsClasses}
          aria-label="icon label tabs example"
        >
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={pillTabClasses}
          />
          <Tab
            value={"closed"}
            icon={<CheckBoxIcon />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={pillTabClasses}
          />
          <Tab
            value={"search"}
            icon={<SearchIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={pillTabClasses}
          />
        </Tabs>
        <div className={classes.toolbar}>
          <SearchField
            className={classes.search}
            inputRef={searchInputRef}
            placeholder={i18n.t("tickets.search.placeholder")}
            type="search"
            onChange={handleSearch}
          />
          <TicketsQueueSelect
            selectedQueueIds={selectedQueueIds}
            userQueues={user?.queues}
            onChange={(values) => setSelectedQueueIds(values)}
          />
        </div>
        {tab === "open" && (
          <Can
            role={user.profile}
            perform="tickets-manager:showall"
            yes={() => (
              <div className={classes.filtersRow}>
                <FormControlLabel
                  className={classes.showAllLabel}
                  label={i18n.t("tickets.buttons.showAll")}
                  labelPlacement="end"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() =>
                        setShowAllTickets((prevState) => !prevState)
                      }
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              </div>
            )}
          />
        )}
      </div>
      <TabPanel value={tab} name="open" className={classes.panel}>
        <div className={classes.subTabsWrap}>
          <Tabs
            value={tabOpen}
            onChange={handleChangeTabOpen}
            variant="fullWidth"
            classes={pillTabsClasses}
          >
            <Tab
              label={
                <span className={classes.tabLabel}>
                  {i18n.t("ticketsList.assignedHeader")}
                  <span
                    className={clsx(classes.count, {
                      [classes.countPrimary]: openCount > 0,
                    })}
                  >
                    {openCount}
                  </span>
                </span>
              }
              value={"open"}
              classes={pillTabClasses}
            />
            <Tab
              label={
                <span className={classes.tabLabel}>
                  {i18n.t("ticketsList.pendingHeader")}
                  <span
                    className={clsx(classes.count, {
                      [classes.countAccent]: pendingCount > 0,
                    })}
                  >
                    {pendingCount}
                  </span>
                </span>
              }
              value={"pending"}
              classes={pillTabClasses}
            />
          </Tabs>
        </div>
        <Paper elevation={0} className={classes.listArea}>
          <TicketsList
            status="open"
            searchParam={searchParam}
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle("open")}
          />
          <TicketsList
            status="pending"
            searchParam={searchParam}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle("pending")}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.panel}>
        <TicketsList
          status="closed"
          searchParam={searchParam}
          showAll={true}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.panel}>
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
    </Paper>
  );
};

export default TicketsManager;
