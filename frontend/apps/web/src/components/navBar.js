import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import Menu from "@mui/material/Menu";
import Container from "@mui/material/Container";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import { COLORS } from "@constants/colors";

import { logoutUser, selectUser } from "@app/store/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import { Divider, ListItemIcon, ListItemText } from "@mui/material";
import AutoAwesomeMotionOutlinedIcon from "@mui/icons-material/AutoAwesomeMotionOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import SchoolOutlinedIcon from "@mui/icons-material/SchoolOutlined";
import HeadphonesOutlinedIcon from "@mui/icons-material/HeadphonesOutlined";
import RecordVoiceOverOutlinedIcon from "@mui/icons-material/RecordVoiceOverOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import SearchDeckInput from "./searchDeck";

const userMenuItemSx = {
  borderRadius: "0.55rem",
  px: 1.25,
  py: 0.85,
  color: "var(--fl-text)",
  "& .MuiListItemIcon-root": { minWidth: 34, color: "var(--fl-text-minor)" },
  "&:hover": { backgroundColor: "rgba(var(--fl-primary-rgb), 0.08)" },
  "&:hover .MuiListItemIcon-root": { color: "var(--fl-primary)" },
};

const links = [
  { link: "", name: "Home", icon: HomeOutlinedIcon },
  { link: "deck", name: "Deck", tour: "decks", icon: AutoAwesomeMotionOutlinedIcon },
  { link: "course", name: "Course", tour: "course", icon: SchoolOutlinedIcon },
  { link: "listening", name: "Listening", tour: "listening", icon: HeadphonesOutlinedIcon },
  {
    link: "speaking-coach",
    name: "Speaking",
    tour: "speaking-coach",
    icon: RecordVoiceOverOutlinedIcon,
  },
  {
    link: "writing-coach",
    name: "Writing",
    tour: "writing-coach",
    icon: EditNoteOutlinedIcon,
  },
  {
    link: "grammar",
    name: "Grammar",
    tour: "grammar",
    icon: MenuBookOutlinedIcon,
  },
  {
    link: "revise",
    name: "Revise",
    tour: "revise",
    icon: AutoAwesomeOutlinedIcon,
  },
];

function ResponsiveAppBar()
{
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [ancharElCreate, setAncharElCreate] = useState(null);
  const navigate = useNavigate();
  const open = Boolean(ancharElCreate);
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const handleOpenUserMenu = (event) =>
  {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () =>
  {
    setAnchorElUser(null);
  };

  const handleClickDeck = () =>
  {
    setAncharElCreate(null);
    navigate("create-deck");
  };

  return user ? (
    <AppBar
      position="sticky"
      color="white"
      elevation={0}
      sx={{ borderBottom: ".0625rem solid var(--fl-border)", top: 0, zIndex: 1100 }}
    >
      <Container maxWidth="xxl">
        <Toolbar disableGutters>
          <Box
            component="img"
            src="/icons/flashlearn.svg"
            alt="FlashLearn logo"
            className="flash-learn-icon"
            onClick={() => navigate("/")}
            sx={{ cursor: "pointer" }}
          />

          <Box
            sx={{
              flexGrow: 1,
              minWidth: 0,
              alignSelf: "stretch",
              flexWrap: "nowrap",
              display: { xs: "none", lg: "flex" },
            }}
          >
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.link}
                  data-tour={link.tour}
                  end={link.link === ""}
                  className={({ isActive }) =>
                    isActive ? "nav-item nav-item--active" : "nav-item"
                  }
                  to={link.link}
                >
                  {Icon && <Icon fontSize="small" />}
                  {link.name}
                </NavLink>
              );
            })}
          </Box>

          {/* Spacer pushes the action cluster right on mobile, where the
              horizontal nav row below replaces the inline links. */}
          <Box sx={{ flexGrow: 1, display: { xs: "block", lg: "none" } }} />
          <Box
            sx={{ flexGrow: 0, flexShrink: 0, mr: { xs: "0.5rem", sm: "1.25rem" } }}
          >
            <IconButton
              aria-label="add"
              data-tour="create-deck"
              sx={{
                width: 44,
                height: 44,
                background: "var(--fl-primary)",
                "&:hover": { background: "var(--fl-primary-dark)" },
              }}
              color="white"
              id="basic-button"
              aria-controls={open ? "basic-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={open ? "true" : undefined}
              onClick={(e) => setAncharElCreate(e.currentTarget)}
            >
              <AddIcon />
            </IconButton>
            <Menu
              id="basic-menu"
              anchorEl={ancharElCreate}
              open={open}
              onClose={() => setAncharElCreate(null)}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "center",
              }}
              transformOrigin={{
                vertical: -10,
                horizontal: "center",
              }}
            >
              <MenuItem
                sx={{
                  color: COLORS.GRAY_TEXT,
                  padding: ".25rem 3rem .25rem 1rem",
                  fontSize: "0.875",
                }}
                onClick={handleClickDeck}
              >
                <ListItemIcon sx={{ color: COLORS.GRAY_TEXT }}>
                  <AutoAwesomeMotionOutlinedIcon />
                </ListItemIcon>
                <ListItemText>Deck</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
          <Box
            sx={{
              flexShrink: 1,
              minWidth: 0,
              display: { xs: "none", sm: "block" },
            }}
          >
            <SearchDeckInput />
          </Box>
          <Box sx={{ flexGrow: 0, flexShrink: 0 }}>
            <Tooltip title="Account">
              <IconButton
                onClick={handleOpenUserMenu}
                data-tour="account"
                sx={{
                  p: 0.25,
                  border: "2px solid transparent",
                  transition: "border-color 0.18s ease",
                  "&:hover": { borderColor: "var(--fl-primary-hover)" },
                }}
              >
                <Avatar alt={user.name} src={user.image_url} />
              </IconButton>
            </Tooltip>
            <Menu
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
              slotProps={{
                paper: {
                  elevation: 0,
                  sx: {
                    mt: 1.25,
                    minWidth: 252,
                    borderRadius: "0.9rem",
                    overflow: "hidden",
                    border: "1px solid var(--fl-border)",
                    backgroundColor: "var(--fl-surface)",
                    boxShadow: "0 12px 32px rgba(40, 46, 62, 0.16)",
                    "& .MuiList-root": { padding: "0.5rem" },
                  },
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  px: 1.25,
                  py: 1,
                }}
              >
                <Avatar
                  alt={user.name}
                  src={user.image_url}
                  sx={{ width: 44, height: 44 }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      color: "var(--fl-text)",
                      lineHeight: 1.25,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user.name}
                  </Box>
                  <Box
                    sx={{
                      fontSize: "0.78rem",
                      color: "var(--fl-text-minor)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user.email}
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ borderColor: "var(--fl-border)", my: 0.5 }} />

              <MenuItem
                onClick={() => {
                  navigate("deck");
                  handleCloseUserMenu();
                }}
                sx={userMenuItemSx}
              >
                <ListItemIcon>
                  <AutoAwesomeMotionOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
                >
                  My decks
                </ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  navigate("settings");
                  handleCloseUserMenu();
                }}
                sx={userMenuItemSx}
              >
                <ListItemIcon>
                  <SettingsOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
                >
                  Settings
                </ListItemText>
              </MenuItem>

              <Divider sx={{ borderColor: "var(--fl-border)", my: 0.5 }} />

              <MenuItem
                onClick={() => {
                  handleCloseUserMenu();
                  dispatch(logoutUser());
                }}
                sx={{
                  borderRadius: "0.55rem",
                  px: 1.25,
                  py: 0.85,
                  color: "#ef5350",
                  "& .MuiListItemIcon-root": { minWidth: 34, color: "#ef5350" },
                  "&:hover": { backgroundColor: "rgba(239, 83, 80, 0.1)" },
                }}
              >
                <ListItemIcon>
                  <LogoutOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
                >
                  Log out
                </ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>

        {/* Mobile: an always-visible, scrollable icon bar so every section is
            discoverable at a glance instead of hidden behind a hamburger. */}
        <Box className="nav-mobile" sx={{ display: { xs: "flex", lg: "none" } }}>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.link}
                data-tour={link.tour}
                end={link.link === ""}
                className={({ isActive }) =>
                  isActive ? "nav-chip nav-chip--active" : "nav-chip"
                }
                to={link.link}
              >
                {Icon && <Icon fontSize="small" />}
                <span>{link.name}</span>
              </NavLink>
            );
          })}
        </Box>
      </Container>
    </AppBar>
  ) : (
    <></>
  );
}
export default ResponsiveAppBar;
