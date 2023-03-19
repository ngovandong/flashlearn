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

import { styled } from "@mui/material/styles";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";
import { logout, selectUser } from "@app/store/authSlice";
import { useDispatch, useSelector } from "react-redux";
import { NavLink, useNavigate } from "react-router-dom";
import { ListItemIcon, ListItemText } from "@mui/material";
import FolderCopyOutlinedIcon from "@mui/icons-material/FolderCopyOutlined";
import AutoAwesomeMotionOutlinedIcon from "@mui/icons-material/AutoAwesomeMotionOutlined";

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: COLORS.APP_BACKGROUND,
  marginLeft: 0,
  marginRight: "2rem",
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(1),
    width: "auto",
  },
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: COLORS.MINOR_TEXT,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    "::placeholder": {
      color: COLORS.MINOR_TEXT,
    },
    "&:focus": {
      border: `0.5px solid ${COLORS.MINOR_TEXT}`,
      borderRadius: theme.shape.borderRadius,
    },
    [theme.breakpoints.up("sm")]: {
      width: "12ch",
      "&:focus": {
        width: "20ch",
      },
    },
  },
}));

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

  const handleClickDeck=()=>{
    setAncharElCreate(null);
    navigate('create-deck');
  }

  return (
    <AppBar
      position="static"
      color="white"
      sx={{ borderBottom: ".0625rem solid #edeff4" }}
    >
      <Container maxWidth="xxl">
        <Toolbar disableGutters>
          <img
            src="icons/flashlearn.svg"
            alt="flash learn logo"
            className="flash-learn-icon"
          ></img>

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
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="Search…"
              inputProps={{ "aria-label": "search" }}
            />
          </Search>
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
              <MenuItem onClick={handleCloseUserMenu}>
                <Typography textAlign="center">Profile</Typography>
              </MenuItem>
              <MenuItem onClick={() => dispatch(logout())}>
                <Typography textAlign="center">Logout</Typography>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
export default ResponsiveAppBar;
