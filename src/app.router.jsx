import React, { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import FeatureModule from "./feature-module/feature-module";
import { authRoutes, posPages, unAuthRoutes } from "./routes/path";
import { base_path } from "./environment";

const TillFlowApp = lazy(() => import("./tillflow/TillFlowApp"));

const AppRouter = () => {
  const RouterContent = React.memo(() => {
    const renderRoutes = (routeList, _isProtected) =>
    routeList?.map((item) =>
    <Route
      key={`route-${item?.id}`}
      path={item?.path}
      element={item?.element} />

    );

    return (
      <Routes>
        <Route
          path="/*"
          element={
            <Suspense fallback={<div className="tillflow-root" style={{ padding: "2rem" }}>Loading TillFlow…</div>}>
              <TillFlowApp />
            </Suspense>
          }
        />
        <Route path="/" element={<FeatureModule />}>
          {renderRoutes(unAuthRoutes, false)}
          {renderRoutes(authRoutes, true)}
          {renderRoutes(posPages, true)}
        </Route>
      </Routes>
    );

  });

  return (
    <BrowserRouter basename={base_path}>
      <RouterContent />
    </BrowserRouter>);

};

export default AppRouter;