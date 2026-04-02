import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { SidebarData } from "../../core/json/siderbar_data";
import { useSelector } from "react-redux";
import { all_routes } from "../../routes/all_routes";
import {
  customer15,
  logo,
  logoSmall,
  logoSmallWhite,
  logoWhite,
} from "../../utils/imagepath";

function buildInitialSectionOpen() {
  const o = {};
  SidebarData.forEach((m) => {
    if (m.collapsible) {
      o[m.label] = m.submenuOpen !== false;
    }
  });
  return o;
}

const Sidebar = () => {
  const route = all_routes;
  const Location = useLocation();

  /* ================= STATE ================= */

  const [subOpen, setSubopen] = useState("");
  const [subsidebar, setSubsidebar] = useState("");
  const [toggle, SetToggle] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(buildInitialSectionOpen);

  /* ================= REDUX ================= */

  const expandMenus = useSelector(
    (state) => state.themeSetting?.expandMenus
  );
  const dataLayout = useSelector(
    (state) => state.themeSetting?.dataLayout
  );

  /* ================= HELPERS ================= */

  const getAllLinks = (item) => {
    const links = [];
    if (item?.link) links.push(item.link);
    if (item?.submenuItems?.length) {
      item.submenuItems.forEach((sub) => {
        links.push(...getAllLinks(sub));
      });
    }
    return links;
  };

  const isItemActive = (item) =>
    getAllLinks(item).includes(Location.pathname);

  const shouldMenuBeOpen = (item) => {
    if (isItemActive(item)) return true;
    if (item?.submenuItems?.length) {
      return item.submenuItems.some(shouldMenuBeOpen);
    }
    return false;
  };

  /* ================= AUTO OPEN ACTIVE ================= */

  useEffect(() => {
    let openTitle = "";
    let openSub = "";

    SidebarData?.forEach((main) => {
      main?.submenuItems?.forEach((title) => {
        if (shouldMenuBeOpen(title)) {
          openTitle = title?.label;
          title?.submenuItems?.forEach((item) => {
            if (shouldMenuBeOpen(item)) {
              openSub = item?.label;
            }
          });
        }
      });
    });

    setSubopen(openTitle);
    setSubsidebar(openSub);

    setSectionOpen((prev) => {
      const next = { ...prev };
      SidebarData.forEach((main) => {
        if (!main.collapsible) {
          return;
        }
        const hasActive = main.submenuItems?.some((title) =>
          shouldMenuBeOpen(title)
        );
        if (hasActive) {
          next[main.label] = true;
        }
      });
      return next;
    });
  }, [Location.pathname]);

  /* ================= TOGGLES ================= */

  const toggleSidebar = (title) => {
    setSubopen((prev) => (prev === title ? "" : title));
  };

  const toggleSubsidebar = (subitem) => {
    setSubsidebar((prev) => (prev === subitem ? "" : subitem));
  };

  const toggleSection = (label) => {
    setSectionOpen((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handlesidebar = () => {
    document.body.classList.toggle("mini-sidebar");
    SetToggle((prev) => !prev);
  };

  const expandMenu = () => {
    document.body.classList.remove("expand-menu");
  };

  const expandMenuOpen = () => {
    document.body.classList.add("expand-menu");
  };

  /* ================= LINK RENDER ================= */

  const renderLinkProps = (item) =>
    item?.external
      ? {
          href: item.link,
          target: "_blank",
          rel: "noopener noreferrer",
        }
      : {
          to: item.link || "#",
        };

  /* ================= RENDER ================= */

  return (
    <div>
      <div
        className={`sidebar ${toggle ? "" : "active"} ${
          expandMenus || dataLayout === "layout-hovered"
            ? "expand-menu"
            : ""
        }`}
        id="sidebar"
        onMouseLeave={expandMenu}
        onMouseOver={expandMenuOpen}
      >
        <>
          {/* LOGO */}
          <div className="sidebar-logo">
            <Link to={route.newdashboard} className="logo logo-normal">
              <img src={logo} alt="Img" />
            </Link>
            <Link to={route.newdashboard} className="logo logo-white">
              <img src={logoWhite} alt="Img" />
            </Link>
            <Link to={route.newdashboard} className="logo-small">
              <img src={logoSmall} alt="Img" />
            </Link>
            <Link to={route.newdashboard} className="logo-small-white">
              <img src={logoSmallWhite} alt="Img" />
            </Link>

            <Link id="toggle_btn" to="#" onClick={handlesidebar}>
              <i className="feather icon-chevrons-left feather-16" />
            </Link>
          </div>
        </>

        <div data-simplebar="">
          <div className="sidebar-inner">
            <div id="sidebar-menu" className="sidebar-menu">
              <ul>
                {SidebarData?.map((mainLabel, index) => {
                  const isCollapsible = Boolean(mainLabel.collapsible);
                  const sectionExpanded =
                    !isCollapsible || sectionOpen[mainLabel.label];
                  return (
                  <li
                    className={`submenu-open${
                      isCollapsible && !sectionExpanded
                        ? " section-collapsed"
                        : ""
                    }`}
                    key={index}
                  >
                    {isCollapsible ? (
                      <button
                        type="button"
                        className={`submenu-hdr submenu-hdr--toggle${
                          sectionExpanded ? " subdrop" : ""
                        }`}
                        onClick={() =>
                          toggleSection(mainLabel.label)
                        }
                        aria-expanded={sectionExpanded}
                      >
                        <span>{mainLabel.label}</span>
                        <span className="menu-arrow" aria-hidden />
                      </button>
                    ) : (
                      <h6 className="submenu-hdr">{mainLabel?.label}</h6>
                    )}

                    <ul>
                      {mainLabel?.submenuItems?.map((title, i) => {
                        const isTitleActive = isItemActive(title);
                        const isTitleOpen = subOpen === title?.label;

                        const TitleTag = title?.external ? "a" : Link;

                        return (
                          <li
                            key={i}
                            className={`submenu ${
                              !title?.submenu &&
                              Location.pathname === title?.link
                                ? "custom-active-hassubroute-false"
                                : ""
                            }`}
                          >
                            <TitleTag
                              {...renderLinkProps(title)}
                              onClick={() =>
                                !title?.external &&
                                toggleSidebar(title?.label)
                              }
                              className={`${isTitleOpen ? "subdrop" : ""} ${
                                isTitleActive ? "active" : ""
                              }`}
                            >
                              <i className={`ti ti-${title.icon} me-2`} />
                              <span className="custom-active-span">
                                {title?.label}
                              </span>
                              {title?.submenu && (
                                <span className="menu-arrow" />
                              )}
                            </TitleTag>

                            <ul
                              style={{
                                display:
                                  subOpen === title?.label ? "block" : "none",
                              }}
                            >
                              {title?.submenuItems?.map((item, j) => {
                                const isItemOpen =
                                  subsidebar === item?.label;
                                const isItemActiveState =
                                  isItemActive(item);

                                const ItemTag = item?.external ? "a" : Link;

                                return (
                                  <li
                                    className="submenu submenu-two"
                                    key={j}
                                  >
                                    <ItemTag
                                      {...renderLinkProps(item)}
                                      onClick={() =>
                                        !item?.external &&
                                        toggleSubsidebar(item?.label)
                                      }
                                      className={`${isItemActiveState ? "active" : ""} ${
                                        isItemOpen ? "subdrop" : ""
                                      }`}
                                    >
                                      {item?.label}
                                      {item?.submenu && (
                                        <span className="menu-arrow inside-submenu" />
                                      )}
                                    </ItemTag>

                                    <ul
                                      style={{
                                        display: isItemOpen
                                          ? "block"
                                          : "none",
                                      }}
                                    >
                                      {item?.submenuItems?.map(
                                        (child, k) => {
                                          const ChildTag = child?.external
                                            ? "a"
                                            : Link;

                                          return (
                                            <li key={k}>
                                              <ChildTag
                                                {...renderLinkProps(child)}
                                                className={
                                                  isItemActive(child)
                                                    ? "active"
                                                    : ""
                                                }
                                              >
                                                {child?.label}
                                              </ChildTag>
                                            </li>
                                          );
                                        }
                                      )}
                                    </ul>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
