import React, { useState } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
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
];

function ResponsiveAppBar() {
  const [anchorElUser, setAnchorElUser] = useState(null);
  const [ancharElCreate, setAncharElCreate] = useState(null);
  const navigate = useNavigate();
  const open = Boolean(ancharElCreate);
  const dispatch = useDispatch();
  const user = useSelector(selectUser);

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleClickDeck = () => {
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
                onClick={() => {
                  navigate("deck");
                  handleCloseUserMenu();
                }}
              >
                <Typography textAlign="center">My decks</Typography>
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
