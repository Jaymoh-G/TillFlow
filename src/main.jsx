import { PrimeReactProvider } from "primereact/api";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from "react-redux";
import AppRouter from "./app.router";
import store from "./core/redux/store";
// Single Bootstrap ESM instance: `bootstrap.bundle.min` + `import { Modal } from "bootstrap"`
// use separate JS heaps and break programmatic hide() after data-bs-toggle open (stuck backdrop).
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import * as bootstrap from "bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import "primeicons/primeicons.css";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/saga-blue/theme.css";
import "slick-carousel/slick/slick-theme.css";
import "slick-carousel/slick/slick.css";
import "../node_modules/@fortawesome/fontawesome-free/css/all.min.css";
import "../node_modules/@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "../src/assets/css/feather.css";
import "../src/assets/icons/boxicons/css/boxicons.min.css";
import "./assets/icons/feather/css/iconfont.css";
import { LazyWrapper } from "./components/lazy-loading";
import "./customStyle.scss";
if (typeof window !== "undefined") {
  window.bootstrap = bootstrap;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
        <PrimeReactProvider
        value={{
          unstyled: false,
          ripple: true,
          hideOverlaysOnDocumentScrolling: true
        }}>

          <LazyWrapper>
            <AppRouter />
          </LazyWrapper>
        </PrimeReactProvider>
      </Provider>
  </StrictMode>
);
