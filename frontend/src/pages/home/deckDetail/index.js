import { deckService } from "@api-services/deckService";
import { LocalLoadingWrapper } from "@components/loading";
import { getFirstError } from "@utils/errorHandler";
import React, { useEffect, useState } from "react";
import
  {
    Link,
    useNavigate,
    useParams,
    useSearchParams,
  } from "react-router-dom";
import { toast } from "react-toastify";
import LocalLibraryIcon from "@mui/icons-material/LocalLibrary";
import CollectionsBookmarkIcon from "@mui/icons-material/CollectionsBookmark";
import TimerIcon from "@mui/icons-material/Timer";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import HearingIcon from "@mui/icons-material/Hearing";
import CircularProgressWithLabel from "@components/progress";
import FooterBTNs from "./footerButtons";

function MenuButton({ icon, text, link, isDisabled })
{
  const IconName = icon;
  return (
    <div className={`menu-btn${isDisabled ? " lock" : ""}`}>
      <Link to={link} className="menu-link">
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
  const [searchParams] = useSearchParams();

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

  useEffect(() =>
  {
    const notnavigate = searchParams.get("notnavigate");
    if (!notnavigate && deck && deck.number_of_term === 0) {
      navigate("edit?tab=1");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);
  return (
    <>
      <LocalLoadingWrapper open={isLoading} />
      {deck && (
        <div className="deck-page">
          <div className="deck-header">
            <h2>{deck.name}</h2>
          </div>
          <div className="deck-menu">
            {/* <div className="menu-btn lock">
              <Link to="learn">
                <LocalLibraryIcon
                  color={deck.my_permission ? "purple" : "grey"}
                />
                <span>Learn</span>
              </Link>
            </div> */}
            <MenuButton
              link="learn"
              text="Learn"
              isDisabled={!deck.my_permission}
              icon={LocalLibraryIcon}
            />
            <MenuButton
              link="revise"
              text="Revise"
              isDisabled={!deck.my_permission}
              icon={CollectionsBookmarkIcon}
            />
            <MenuButton
              link="quick-revise"
              text="Quick Revise"
              isDisabled={!deck.my_permission}
              icon={TimerIcon}
            />
            <MenuButton
              link="number-test"
              text="Number Test"
              isDisabled={!deck.my_permission}
              icon={HearingIcon}
            />
            <MenuButton
              link="competition"
              text="Competition"
              isDisabled={true}
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
      )}
    </>
  );
}

export default DeckDetail;
