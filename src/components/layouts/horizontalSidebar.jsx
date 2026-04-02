import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SidebarData1 } from "../../core/json/sidebar_dataone";

const HorizontalSidebar = () => {
  const [opendSubMenu, setOpendSubMenu] = useState([null, null, null]);
  const sidebarRef = useRef(null);
  const location = useLocation();

  /* ================= TOGGLES ================= */

  const showMenu = (title) => {
    setOpendSubMenu((prev) =>
      prev[0] === title ? [null, null, null] : [title, null, null]
    );
  };

  const showSubMenu = (title) => {
    setOpendSubMenu((prev) =>
      prev[1] === title ? [prev[0], null, null] : [prev[0], title, null]
    );
  };

  const showInnerMenu = (title) => {
    setOpendSubMenu((prev) =>
      prev[2] === title ? [prev[0], prev[1], null] : [prev[0], prev[1], title]
    );
  };

  /* ================= CLICK OUTSIDE ================= */

  const handleClickOutside = (event) => {
    if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
      setOpendSubMenu([null, null, null]);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ================= ACTIVE ================= */

  const isActiveRoute = (route) => {
    if (!route) return false;
    return location.pathname.split("/")[1] === route.split("/")[1];
  };

  const isActiveMenu = (menu) =>
    isActiveRoute(menu.route) ||
    menu.subRoutes?.some((sub) => isActiveMenu(sub));

  /* ================= LINK RENDER ================= */

  const renderLink = (item, children, className = "") => {
    if (item?.external) {
      return (
        <a
          href={item.route}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
        >
          {children}
        </a>
      );
    }

    return (
      <Link to={item.route || "#"} className={className}>
        {children}
      </Link>
    );
  };

  /* ================= RENDER ================= */

  return (
    <div
      className="sidebar sidebar-horizontal"
      id="horizontal-menu"
      ref={sidebarRef}
    >
      <div className="sidebar-menu" id="sidebar-menu-3">
        <div className="main-menu">
          <ul className="nav">
            {SidebarData1.map((main, mainIndex) => (
              <li className="submenu" key={mainIndex}>
                <a
                  className={
                    opendSubMenu[0] === main.tittle || isActiveMenu(main)
                      ? "active"
                      : ""
                  }
                  onClick={() => showMenu(main.tittle)}
                >
                  <i className={`ti ti-${main.icon} me-2`} />
                  <span>{main.tittle}</span>
                  <span className="menu-arrow"></span>
                </a>

                {/* ===== LEVEL 2 ===== */}
                <ul
                  className={`submenus-two ${
                    opendSubMenu[0] === main.tittle
                      ? "d-block"
                      : "d-none"
                  }`}
                >
                  {main.subRoutes.map((menu, i) => (
                    <React.Fragment key={i}>
                      {!menu.hasSubRoute && (
                        <li>
                          {renderLink(
                            menu,
                            <span>{menu.tittle}</span>,
                            isActiveRoute(menu.route) ? "active" : ""
                          )}
                        </li>
                      )}

                      {menu.hasSubRoute && (
                        <li className="submenu">
                          <a
                            className={isActiveMenu(menu) ? "active" : ""}
                            onClick={() => showSubMenu(menu.tittle)}
                          >
                            <span>{menu.tittle}</span>
                            <span className="menu-arrow"></span>
                          </a>

                          {/* ===== LEVEL 3 ===== */}
                          <ul
                            className={`submenus-three ${
                              opendSubMenu[1] === menu.tittle
                                ? "d-block"
                                : "d-none"
                            }`}
                          >
                            {menu.subRoutes.map((inner, j) => (
                              <React.Fragment key={j}>
                                {!inner.hasSubRoute && (
                                  <li>
                                    {renderLink(
                                      inner,
                                      inner.tittle,
                                      isActiveRoute(inner.route)
                                        ? "active"
                                        : ""
                                    )}
                                  </li>
                                )}

                                {inner.hasSubRoute && (
                                  <li className="submenu">
                                    <a
                                      className={
                                        isActiveMenu(inner) ? "active" : ""
                                      }
                                      onClick={() =>
                                        showInnerMenu(inner.tittle)
                                      }
                                    >
                                      <span>{inner.tittle}</span>
                                      <span className="menu-arrow"></span>
                                    </a>

                                    {/* ===== LEVEL 4 (OPTIONAL) ===== */}
                                    <ul
                                      className={`submenus-three ${
                                        opendSubMenu[2] === inner.tittle
                                          ? "d-block"
                                          : "d-none"
                                      }`}
                                    >
                                      {inner.subRoutes?.map(
                                        (deep, k) => (
                                          <li key={k}>
                                            {renderLink(
                                              deep,
                                              deep.tittle,
                                              isActiveRoute(deep.route)
                                                ? "active"
                                                : ""
                                            )}
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </li>
                                )}
                              </React.Fragment>
                            ))}
                          </ul>
                        </li>
                      )}
                    </React.Fragment>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HorizontalSidebar;
