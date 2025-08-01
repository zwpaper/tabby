import "todomvc-app-css/index.css";
import "./index.css";
import ReactDOM from "react-dom/client";

import { App } from "./app";

const rootElement = document.getElementById("react-app");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}

// ReactDOM.createRoot(document.getElementById('react-app')!).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>,
// )
