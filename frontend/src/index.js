import "./index.css";
import React from "react";
import ReactDOM from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";

import App from "./App";

const hardwareConcurrency = navigator.hardwareConcurrency || 8;
const deviceMemory = navigator.deviceMemory || 8;

if (hardwareConcurrency <= 4 || deviceMemory <= 4) {
	document.documentElement.classList.add("veritas-low-performance");
}

ReactDOM.render(
	<CssBaseline>
		<App />
	</CssBaseline>,
	document.getElementById("root")
);

// ReactDOM.render(
// 	<React.StrictMode>
// 		<CssBaseline>
// 			<App />
// 		</CssBaseline>,
//   </React.StrictMode>

// 	document.getElementById("root")
// );
