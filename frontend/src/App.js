import React from "react";
import Routes from "./routes";
import "react-toastify/dist/ReactToastify.css";
import "./theme/app.css";
import MaintenanceScreen from "./components/MaintenanceScreen";
import ErrorBoundary from "./components/ErrorBoundary";

// Theme (light/dark, locale, design tokens) lives in context/DarkMode.
const App = () => (
  <>
    <ErrorBoundary>
      <Routes />
    </ErrorBoundary>
    <MaintenanceScreen />
  </>
);

export default App;
