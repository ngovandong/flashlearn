import { Avatar } from "@mui/material";
import { Link } from "react-router-dom";

function DeckCard({ id, name, owner, terms, background }) {
  return (
    <Link className="set-card" to={`/deck/${id}`}>
      <div className="set-card__header">
        <div className="card-info">
          <div className="card-info__title">{name}</div>
          <div className="card-info__meta">{terms} terms</div>
        </div>
        <img
          className="card-thumbnail"
          src={background}
          alt="set-thumbnail"
        ></img>
      </div>
      <div className="set-card__footer">
        <div className="footer-user">
          <Avatar
            alt="user avartar"
            src={owner.image_url}
            sx={{
              height: 24,
              width: 24,
            }}
          />
          <span>{owner.email}</span>
        </div>
      </div>
    </Link>
  );
}

export default DeckCard;
