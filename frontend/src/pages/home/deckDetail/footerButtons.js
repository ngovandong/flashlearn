import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CircleButton from "@components/circleButton";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import IosShareIcon from "@mui/icons-material/IosShare";
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
      console.log(error);
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
        console.log(error);
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
      console.error(err);
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
      console.log(error);
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
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <>
      <div className="footer-group-btn">
        {!role ? (
          <div className="join-btn" onClick={handleJoinDeck}>
            Join deck
          </div>
        ) : (
          <>
            {(role === ROLES.EDIT || role === ROLES.OWNER) && (
              <CircleButton onClick={() => navigate("edit")}>
                <EditIcon />
              </CircleButton>
            )}
            {role === ROLES.OWNER && (
              <CircleButton
                id="share-button"
                onClick={(e) => {
                  setAnchorShareEl(e.currentTarget);
                }}
              >
                <IosShareIcon />
              </CircleButton>
            )}
            <CircleButton
              id="more-button"
              onClick={(e) => {
                setAnchorEl(e.currentTarget);
              }}
            >
              <MoreHorizIcon />
            </CircleButton>
          </>
        )}
        <Menu
          id="basic-menu"
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          MenuListProps={{
            "aria-labelledby": "more-button",
          }}
        >
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              setIsOpenDeleteDialog(true);
            }}
          >
            {role === ROLES.OWNER ? "Delete" : "Remove"}
          </MenuItem>
          <MenuItem onClick={handleReset}>Reset</MenuItem>
        </Menu>
        <Menu
          id="basic-menu"
          anchorEl={anchorShareEl}
          open={Boolean(anchorShareEl)}
          onClose={() => setAnchorShareEl(null)}
          MenuListProps={{
            "aria-labelledby": "share-button",
          }}
        >
          <MenuItem
            onClick={() => {
              handleShareClick(ROLES.VIEWONLY);
            }}
          >
            Share with view only permission
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleShareClick(ROLES.EDIT);
            }}
          >
            Share with edit permission
          </MenuItem>
        </Menu>
      </div>
      <Dialog
        open={isOpenDeleteDialog}
        onClose={() => setIsOpenDeleteDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Comfirm delete deck"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to{" "}
            {role === ROLES.OWNER
              ? "delete the deck?"
              : "remove deck from your deck?"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsOpenDeleteDialog(false)}>Disagree</Button>
          <Button
            onClick={() => {
              if (role === ROLES.OWNER) handleDeleteDeck();
              else handleLeaveDeck();
            }}
            autoFocus
          >
            Agree
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default FooterBTNs;
