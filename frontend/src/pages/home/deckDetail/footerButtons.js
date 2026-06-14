import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import IosShareIcon from "@mui/icons-material/IosShare";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { ROLES } from "@constants/role";
import { useState } from "react";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import { deckService } from "@api-services/deckService";
import { getFirstError } from "@utils/errorHandler";
function FooterBTNs({ deck, setIsLoading, fetchDeck }) {
  const [anchorEl, setAnchorEl] = useState();
  const [anchorShareEl, setAnchorShareEl] = useState();
  const [isOpenDeleteDialog, setIsOpenDeleteDialog] = useState(false);
  const role = deck.my_permission;

  const { deckID } = useParams();
  const navigate = useNavigate();

  const editBtnSx = {
    textTransform: "none",
    fontWeight: 700,
    borderRadius: "0.7rem",
    px: 2.25,
    py: 0.9,
    color: "var(--fl-on-primary)",
    backgroundColor: "var(--fl-primary)",
    "&:hover": {
      backgroundColor: "var(--fl-primary-dark)",
      boxShadow: "0 8px 18px rgba(var(--fl-primary-rgb), 0.32)",
    },
  };

  const shareBtnSx = {
    textTransform: "none",
    fontWeight: 600,
    borderRadius: "0.7rem",
    px: 2.25,
    py: 0.9,
    color: "var(--fl-text)",
    borderColor: "var(--fl-border-strong)",
    "&:hover": {
      borderColor: "var(--fl-primary)",
      backgroundColor: "rgba(var(--fl-primary-rgb), 0.06)",
    },
  };

  const moreBtnSx = {
    color: "var(--fl-text-minor)",
    border: "1px solid var(--fl-border-strong)",
    borderRadius: "0.7rem",
    width: 44,
    height: 44,
    "&:hover": { backgroundColor: "var(--fl-surface-2)", color: "var(--fl-text)" },
  };

  const menuPaperSx = {
    mt: 1,
    minWidth: 220,
    borderRadius: "0.85rem",
    border: "1px solid var(--fl-border)",
    backgroundColor: "var(--fl-surface)",
    boxShadow: "0 12px 32px rgba(40, 46, 62, 0.16)",
    "& .MuiList-root": { padding: "0.4rem" },
  };

  const menuItemSx = {
    borderRadius: "0.55rem",
    px: 1.25,
    py: 0.85,
    color: "var(--fl-text)",
    "& .MuiListItemIcon-root": { minWidth: 34, color: "var(--fl-text-minor)" },
    "&:hover": { backgroundColor: "rgba(var(--fl-primary-rgb), 0.08)" },
    "&:hover .MuiListItemIcon-root": { color: "var(--fl-primary)" },
  };

  const dangerItemSx = {
    borderRadius: "0.55rem",
    px: 1.25,
    py: 0.85,
    color: "#ef5350",
    "& .MuiListItemIcon-root": { minWidth: 34, color: "#ef5350" },
    "&:hover": { backgroundColor: "rgba(239, 83, 80, 0.1)" },
  };

  const handleReset = async () => {
    setAnchorEl(null);
    try {
      setIsLoading(true);
      const res = await deckService.clearLearningProgress(deckID);
      if (!res.error) {
        toast.success("Reset learning progress success!");
        fetchDeck();
      } else {
        const errorMessage = getFirstError(res.error);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Something went wrong!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDeck = async () => {
    setIsOpenDeleteDialog(false);
    if (role === ROLES.OWNER) {
      try {
        setIsLoading(true);
        const res = await deckService.delete(deckID);
        if (!res.error) {
          toast.success("Delete deck success!");
          navigate("/deck");
        } else {
          const errorMessage = getFirstError(res.error);
          toast.error(errorMessage);
        }
      } catch (error) {
        toast.error("Something went wrong!");
      } finally {
        setIsLoading(false);
      }
    } else {
    }
  };

  const handleShareClick = async (role) => {
    setAnchorShareEl(null);
    try {
      const res = await deckService.getInviteUrl(deckID, role);
      if (!res.error) {
        const url = res.data;
        await navigator.clipboard.writeText(url);
        toast.success("Invite link is copied to clipboard");
      } else {
        const errorMessage = getFirstError(res.error);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error("Getting invite link failed!");
    }
  };

  const handleJoinDeck = async () => {
    try {
      setIsLoading(true);
      const res = await deckService.joinDeck(deckID);
      if (!res.error) {
        toast.success("Join deck success!");
        fetchDeck();
      } else {
        const errorMessage = getFirstError(res.error);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Something went wrong!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneDeck = async () => {
    try {
      setIsLoading(true);
      const res = await deckService.cloneDeck(deckID);
      if (!res.error) {
        toast.success("Clone deck success!");
        navigate(`/deck/${res.data.id}`);
      } else {
        const errorMessage = getFirstError(res.error);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Something went wrong!");
    } finally {
      setIsLoading(false);
    }
  };
  const handleLeaveDeck = async () => {
    try {
      setIsLoading(true);
      const res = await deckService.leaveDeck(deckID);
      if (!res.error) {
        toast.success("Deck is removed from your deck!");
        navigate("/deck");
      } else {
        const errorMessage = getFirstError(res.error);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Something went wrong!");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <>
      <div className="footer-group-btn">
        {!role ? (
          <div className="join-clone-group">
            <div className="join-btn" onClick={handleJoinDeck}>
              Join deck
            </div>
            <div className="clone-btn" onClick={handleCloneDeck}>
              Clone deck
            </div>
          </div>
        ) : (
          <>
            {(role === ROLES.EDIT || role === ROLES.OWNER) && (
              <Tooltip title="Edit deck details & terms" arrow>
                <Button
                  data-tour="deck-edit-btn"
                  variant="contained"
                  disableElevation
                  startIcon={<EditIcon />}
                  onClick={() => navigate("edit")}
                  sx={editBtnSx}
                >
                  Edit
                </Button>
              </Tooltip>
            )}
            {role === ROLES.OWNER && (
              <Tooltip title="Invite others with a share link" arrow>
                <Button
                  id="share-button"
                  data-tour="deck-share-btn"
                  variant="outlined"
                  startIcon={<IosShareIcon />}
                  onClick={(e) => setAnchorShareEl(e.currentTarget)}
                  sx={shareBtnSx}
                >
                  Share
                </Button>
              </Tooltip>
            )}
            <Tooltip title="More options" arrow>
              <IconButton
                id="more-button"
                data-tour="deck-more-btn"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={moreBtnSx}
              >
                <MoreHorizIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          MenuListProps={{ "aria-labelledby": "more-button" }}
          slotProps={{ paper: { elevation: 0, sx: menuPaperSx } }}
        >
          <MenuItem onClick={handleReset} sx={menuItemSx}>
            <ListItemIcon>
              <RestartAltRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Reset progress"
              secondary="Clear your learning progress"
              primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
              secondaryTypographyProps={{ fontSize: "0.72rem", color: "var(--fl-text-muted)" }}
            />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              setIsOpenDeleteDialog(true);
            }}
            sx={dangerItemSx}
          >
            <ListItemIcon>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={role === ROLES.OWNER ? "Delete deck" : "Remove deck"}
              primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
            />
          </MenuItem>
        </Menu>
        <Menu
          id="basic-menu"
          anchorEl={anchorShareEl}
          open={Boolean(anchorShareEl)}
          onClose={() => setAnchorShareEl(null)}
          MenuListProps={{ "aria-labelledby": "share-button" }}
          slotProps={{ paper: { elevation: 0, sx: menuPaperSx } }}
        >
          <MenuItem onClick={() => handleShareClick(ROLES.VIEWONLY)} sx={menuItemSx}>
            <ListItemIcon>
              <VisibilityOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="View only"
              secondary="They can study, not edit"
              primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
              secondaryTypographyProps={{ fontSize: "0.72rem", color: "var(--fl-text-muted)" }}
            />
          </MenuItem>
          <MenuItem onClick={() => handleShareClick(ROLES.EDIT)} sx={menuItemSx}>
            <ListItemIcon>
              <EditOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Can edit"
              secondary="They can add & change terms"
              primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
              secondaryTypographyProps={{ fontSize: "0.72rem", color: "var(--fl-text-muted)" }}
            />
          </MenuItem>
        </Menu>
      </div>
      <Dialog
        open={isOpenDeleteDialog}
        onClose={() => setIsOpenDeleteDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        slotProps={{
          paper: {
            sx: {
              borderRadius: "1rem",
              backgroundColor: "var(--fl-surface)",
              border: "1px solid var(--fl-border)",
              minWidth: 360,
            },
          },
        }}
      >
        <DialogTitle
          id="alert-dialog-title"
          sx={{ color: "var(--fl-text)", fontWeight: 800 }}
        >
          {role === ROLES.OWNER ? "Delete this deck?" : "Remove this deck?"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText
            id="alert-dialog-description"
            sx={{ color: "var(--fl-text-minor)" }}
          >
            {role === ROLES.OWNER
              ? "This permanently deletes the deck and all of its terms. This can't be undone."
              : "This removes the deck from your library. You can join it again later."}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setIsOpenDeleteDialog(false)}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              color: "var(--fl-text-minor)",
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => {
              if (role === ROLES.OWNER) handleDeleteDeck();
              else handleLeaveDeck();
            }}
            autoFocus
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "0.55rem",
              backgroundColor: "#ef5350",
              "&:hover": { backgroundColor: "#e53935" },
            }}
          >
            {role === ROLES.OWNER ? "Delete" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default FooterBTNs;
