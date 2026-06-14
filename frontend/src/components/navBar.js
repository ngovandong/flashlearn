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
import { ListItemIcon, ListItemText } from "@mui/material";
import FolderCopyOutlinedIcon from "@mui/icons-material/FolderCopyOutlined";
import AutoAwesomeMotionOutlinedIcon from "@mui/icons-material/AutoAwesomeMotionOutlined";
import SearchDeckInput from "./searchDeck";

const links = [
  { link: "", name: "Home" },
  // { link: "folder", name: "Folder" },
  { link: "deck", name: "Deck" },
  { link: "number-test", name: "Number Listening" },
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
      position="static"
      color="white"
      sx={{ borderBottom: ".0625rem solid #edeff4" }}
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
              sx={{
                background: COLORS.PURPLE,
                "&:hover": { background: COLORS.DARK_PURPLE },
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
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt="my avartar" src={user.image_url} />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: "45px" }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              <MenuItem
                onClick={() =>
                {
                  navigate("deck");
                  handleCloseUserMenu();
                }}
              >
                <Typography textAlign="center">My decks</Typography>
              </MenuItem>
              <MenuItem
                onClick={() =>
                {
                  navigate("settings");
                  handleCloseUserMenu();
                }}
              >
                <Typography textAlign="center">Settings</Typography>
              </MenuItem>
              <MenuItem onClick={() => dispatch(logout())}>
                <Typography textAlign="center">Logout</Typography>
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
