import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import MenuIcon from "@mui/icons-material/Menu";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import Container from "@mui/material/Container";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import { COLORS } from "@constants/colors";

import { logout, selectUser } from "@app/store/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import { Divider, ListItemIcon, ListItemText } from "@mui/material";
import FolderCopyOutlinedIcon from "@mui/icons-material/FolderCopyOutlined";
import AutoAwesomeMotionOutlinedIcon from "@mui/icons-material/AutoAwesomeMotionOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
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
  { link: "", name: "Home" },
  // { link: "folder", name: "Folder" },
  { link: "deck", name: "Deck", tour: "decks" },
  { link: "number-test", name: "Number Listening", tour: "number-test" },
];

function ResponsiveAppBar()
{
  const [anchorElNav, setAnchorElNav] = useState(null);
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

  const handleOpenNavMenu = (event) =>
  {
    setAnchorElNav(event.currentTarget);
  };

  const handleCloseNavMenu = () =>
  {
    setAnchorElNav(null);
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
      sx={{ borderBottom: ".0625rem solid #edeff4", top: 0, zIndex: 1100 }}
    >
      <Container maxWidth="xxl">
        <Toolbar disableGutters>
          <img
            src="/icons/flashlearn.svg"
            alt="flash learn logo"
            className="flash-learn-icon"
          />

          <Box
            sx={{
              flexGrow: 1,
              alignSelf: "stretch",
              display: { md: "flex" },
            }}
          >
            <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleOpenNavMenu}
                color="inherit"
              >
                <MenuIcon />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorElNav}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "left",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                open={Boolean(anchorElNav)}
                onClose={handleCloseNavMenu}
                sx={{
                  display: { xs: "block", md: "none" },
                }}
              >
                {links.map((link) => (
                  <MenuItem key={link.name} onClick={handleCloseNavMenu}>
                    <NavLink
                      to={link.link}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      <Typography textAlign="center">{link.name}</Typography>
                    </NavLink>
                  </MenuItem>
                ))}
              </Menu>
            </Box>
            <Box
              sx={{
                flexGrow: 1,
                alignSelf: "stretch",
                display: { md: "flex", xs: "none" },
              }}
            >
              {links.map((link) => (
                <NavLink
                  key={link.link}
                  data-tour={link.tour}
                  className={({ isActive }) =>
                    isActive ? "nav-item nav-item--active" : "nav-item"
                  }
                  to={link.link}
                >
                  {link.name}
                </NavLink>
              ))}
            </Box>
          </Box>
          <Box sx={{ flexGrow: 0, marginRight: "1.25rem" }}>
            <IconButton
              aria-label="add"
              data-tour="create-deck"
              sx={{
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
              <MenuItem
                sx={{
                  color: COLORS.GRAY_TEXT,
                  padding: ".25rem 3rem .25rem 1rem",
                  fontSize: "0.875",
                }}
              >
                <ListItemIcon sx={{ color: COLORS.GRAY_TEXT }}>
                  <FolderCopyOutlinedIcon />
                </ListItemIcon>
                <ListItemText>Folder</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
          <SearchDeckInput />
          <Box sx={{ flexGrow: 0 }}>
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
                  dispatch(logout());
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
                  Logout
                </ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  ) : (
    <></>
  );
}
export default ResponsiveAppBar;
