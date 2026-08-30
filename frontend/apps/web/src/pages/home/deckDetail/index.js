import { deckService } from "@api-services/deckService";
import { DeckPageSkeleton } from "@components/skeletons";
import { getFirstError } from "@utils/errorHandler";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import TimerIcon from "@mui/icons-material/Timer";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import CircularProgressWithLabel from "@components/progress";
import FooterBTNs from "./footerButtons";

function MenuButton({ icon, text, link, isDisabled, disabledReason, tour })
{
  const IconName = icon;
  return (
    <div
      className={`menu-btn${isDisabled ? " lock" : ""}`}
      data-tour={tour}
      title={isDisabled ? disabledReason : undefined}
    >
      <Link
        to={link}
        className="menu-link"
        aria-disabled={isDisabled || undefined}
        tabIndex={isDisabled ? -1 : undefined}
      >
        <IconName color={isDisabled ? "grey" : "purple"} />
        <span>{text}</span>
      </Link>
    </div>
  );
}

function DeckDetail()
{
  const [deck, setDeck] = useState();
  const [isLoading, setIsLoading] = useState(true);
  const { deckID } = useParams();
  const navigate = useNavigate();

  const fetchDeck = async () =>
  {
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
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() =>
  {
    if (deckID) {
      fetchDeck();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckID]);

  // Every study mode builds its questions from the deck's terms, so an empty
  // deck locks them all — same treatment as a deck you may only read.
  const isEmpty = deck?.number_of_term === 0;
  const isStudyLocked = !deck?.my_permission || isEmpty;
  const studyLockReason = isEmpty
    ? "Add at least one term to start studying this deck."
    : "You don't have permission to study this deck.";

  return isLoading ? (
    <DeckPageSkeleton />
  ) : (
    deck && (
        <div className="deck-page">
          <div className="deck-header">
            <h2>{deck.name}</h2>
          </div>
          {isEmpty && (
            <div className="deck-empty-note">
              <span>
                This deck has no terms yet, so there is nothing to study. Add at
                least one term to unlock Learn, Revise and the games.
              </span>
              <Link to="edit" className="deck-empty-note__cta">
                Add terms
              </Link>
            </div>
          )}
          <div className="deck-menu">
            <MenuButton
              link="learn"
              text="Learn"
              tour="deck-learn"
              isDisabled={isStudyLocked}
              disabledReason={studyLockReason}
              icon={LocalLibraryIcon}
            />
            <MenuButton
              link="revise"
              text="Revise"
              tour="deck-revise"
              isDisabled={isStudyLocked}
              disabledReason={studyLockReason}
              icon={CollectionsBookmarkIcon}
            />
            <MenuButton
              link="quick-revise"
              text="Quick Revise"
              tour="deck-quick-revise"
              isDisabled={isStudyLocked}
              disabledReason={studyLockReason}
              icon={TimerIcon}
            />
            <MenuButton
              link="competition"
              text="Competition"
              tour="deck-competition"
              isDisabled={isStudyLocked}
              disabledReason={studyLockReason}
              icon={SportsEsportsIcon}
            />
          </div>
          <div className="deck-progress">
            <div className="quote-card">
              <div className="quote">
                Way to go! You’ve reviewed {deck.learning_progress.learned_today} words today.
              </div>
              <img src="/imgs/trumpet.svg" alt="trumpet" />
            </div>
            <div className="progress-card">
              <h4>Learning progress</h4>
              <div className="result-card">
                {deck.number_of_term > 0 &&
                  deck.learning_progress.completed > 0 && (
                    <CircularProgressWithLabel
                      value={parseInt(
                        (deck.learning_progress.completed /
                          deck.number_of_term) *
                        100
                      )}
                      size={120}
                    />
                  )}
                <div className="progress-detail">
                  <div className="detail-row">
                    <div className="progress-title c-b">Learning:</div>
                    <div className="detail-number c-b">
                      {deck.learning_progress.learning}
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="progress-title c-p">Mastered:</div>
                    <div className="detail-number c-p">
                      {deck.learning_progress.completed}
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="progress-title c-y">Left:</div>
                    <div className="detail-number c-y">
                      {deck.learning_progress.left}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <FooterBTNs
            setIsLoading={setIsLoading}
            fetchDeck={fetchDeck}
            deck={deck}
          />
        </div>
    )
  );
}

export default DeckDetail;
