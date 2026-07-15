import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import LockIcon from "@mui/icons-material/Lock";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { GAMES } from "@flashlearn/core";
import { LocalLoadingWrapper } from "@components/loading";
import { competitionService } from "@api-services/competitionService";
import { useCompetitionPool } from "./useCompetitionPool";
import { GAME_ICONS, REQUIREMENT_INFO } from "./gameIcons";
import Leaderboard from "./Leaderboard";

export default function Competition() {
  const { deckID } = useParams();
  const { data, isLoading, error } = useCompetitionPool(deckID);
  const [board, setBoard] = useState(null); // { game, loading, data }

  const openLeaderboard = async (game) => {
    setBoard({ game, loading: true, data: null });
    const res = await competitionService.getLeaderboard(deckID, game.key);
    setBoard({ game, loading: false, data: res.error ? null : res.data });
  };

  const available = data?.pool?.available;

  return (
    <div className="cmp-hub">
      <LocalLoadingWrapper open={isLoading} />
      <div className="cmp-hub__header" data-tour="competition-games">
        <h2>Competition</h2>
        <p>Play against bots, beat your ghost, and climb the leaderboards.</p>
      </div>

      {error && (
        <p className="cmp-hub__error">
          Could not load this deck's games. Please try again.
        </p>
      )}

      {data && (
        <div className="cmp-hub__grid">
          {GAMES.map((game) => {
            const Icon = GAME_ICONS[game.key];
            const info = REQUIREMENT_INFO[game.requires];
            const unlocked = available?.[info.flag];
            const card = (
              <div
                className={`cmp-card accent-${game.accent}${
                  unlocked ? "" : " locked"
                }`}
              >
                <div className="cmp-card__icon">
                  <Icon fontSize="inherit" />
                </div>
                <div className="cmp-card__body">
                  <h3>{game.title}</h3>
                  <p>{unlocked ? game.tagline : info.reason}</p>
                </div>
                {unlocked ? (
                  <button
                    type="button"
                    className="cmp-card__board"
                    aria-label={`${game.title} leaderboard`}
                    onClick={(e) => {
                      e.preventDefault();
                      openLeaderboard(game);
                    }}
                  >
                    <EmojiEventsIcon fontSize="small" />
                  </button>
                ) : (
                  <span className="cmp-card__lock">
                    <LockIcon fontSize="small" />
                  </span>
                )}
              </div>
            );
            return unlocked ? (
              <Link key={game.key} to={game.key} className="cmp-card__link">
                {card}
              </Link>
            ) : (
              <div key={game.key} className="cmp-card__link is-locked">
                {card}
              </div>
            );
          })}
        </div>
      )}

      <Leaderboard
        open={Boolean(board)}
        onClose={() => setBoard(null)}
        title={board?.game?.title ?? ""}
        data={board?.data}
        loading={board?.loading}
      />
    </div>
  );
}
