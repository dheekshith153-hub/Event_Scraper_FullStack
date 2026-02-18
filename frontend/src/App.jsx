// App.jsx is no longer the main entry point for routing.
// All routing is handled by AppRoutes.jsx which is rendered from main.jsx.
// This file is kept for compatibility but simply re-exports AppRoutes.
import AppRoutes from "./routes/AppRoutes";
export default AppRoutes;
