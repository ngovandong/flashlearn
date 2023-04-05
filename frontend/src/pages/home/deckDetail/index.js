import { deckService } from "@api-services/deckService";
import { LocalLoadingWrapper } from "@components/loading";
import { getFirstError } from "@utils/errorHandler";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import TimerIcon from "@mui/icons-material/Timer";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CircularProgressWithLabel from "@components/progress";
import EditIcon from "@mui/icons-material/Edit";
import CircleButton from "@components/circleButton";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import IosShareIcon from "@mui/icons-material/IosShare";
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
function DeckDetail() {
  const [deck, setDeck] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const { deckID } = useParams();
  const [anchorEl, setAnchorEl] = useState();
  const [isOpenDeleteDialog, setIsOpenDeleteDialog] = useState(false);
  const open = Boolean(anchorEl);

  const navigate = useNavigate();

  const handleDeleteDeck = async () => {
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
  };

  const fetchDeck = async () => {
    try {
      setIsLoading(true);
      const res = await deckService.retrieve(deckID);
      if (!res.error) {
        setDeck(res.data);
      } else {
        const errorMessage = getFirstError(res.error);
        if (
          errorMessage === "You do not have permission to perform this action."
        ) {
          navigate("/denied");
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (deckID) {
      fetchDeck();
    }
  }, []);
  return (
    <>
      <LocalLoadingWrapper open={isLoading} />
      {deck && (
        <div className="deck-page">
          <div className="deck-header">
            <h2>{deck.name}</h2>
          </div>
          <div className="deck-menu">
            <div className="menu-btn">
              <LocalLibraryIcon color="purple" />
              <span>Learn</span>
            </div>
            <div className="menu-btn">
              <CollectionsBookmarkIcon color="purple" />
              <span>Revise </span>
            </div>
            <div className="menu-btn">
              <TimerIcon color="purple" />
              <span>Quick Revise </span>
            </div>
            <div className="menu-btn">
              <SportsEsportsIcon color="purple" />
              <span>Competition </span>
            </div>
          </div>
          <div className="deck-progress">
            <div className="quote-card">
              <div className="quote">
                Way to go! You’ve reviewed all the cards.
              </div>
              <img src="/imgs/trumpet.svg" alt="trumpet" />
            </div>
            <div className="progress-card">
              <h4>Learning progress</h4>
              <div className="result-card">
                <CircularProgressWithLabel value={70} size={120} />
                <div className="progress-detail">
                  <div className="detail-row">
                    <div className="completed">Completed:</div>
                    <div className="completed-number">34</div>
                  </div>
                  <div className="detail-row">
                    <div className="left">Left:</div>
                    <div className="left-number">20</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="footer-group-btn">
            <CircleButton onClick={() => navigate("edit")}>
              <EditIcon />
            </CircleButton>
            <CircleButton onClick={() => {}}>
              <IosShareIcon />
            </CircleButton>
            <CircleButton
              id="more-button"
              onClick={(e) => {
                setAnchorEl(e.currentTarget);
              }}
            >
              <MoreHorizIcon />
            </CircleButton>
            <Menu
              id="basic-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={() => setAnchorEl(null)}
              MenuListProps={{
                "aria-labelledby": "more-button",
              }}
            >
              <MenuItem
                onClick={() => {
                  setIsOpenDeleteDialog(true);
                }}
              >
                Delete
              </MenuItem>
              <MenuItem onClick={() => {}}>Reset</MenuItem>
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
                Are you sure you want to delete the deck?
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsOpenDeleteDialog(false)}>
                Disagree
              </Button>
              <Button onClick={handleDeleteDeck} autoFocus>
                Agree
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      )}
    </>
  );
}

export default DeckDetail;
