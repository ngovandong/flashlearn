import { Avatar } from "@mui/material";

function SetCard() {
  return (
    <div className="set-card">
      <div className="set-card__header">
        <div className="card-info">
          <div className="card-info__title">IT Terminology</div>
          <div className="card-info__meta">12 terms</div>
        </div>
        <img
          className="card-thumbnail"
          src="https://www.e2studysolution.com/wp-content/uploads/2022/03/Article-Thumbnails-2022-16.png"
          alt="set-thumbnail"
        ></img>
      </div>
      <div className="set-card__footer">
        <div className="footer-user">
          <Avatar
            alt="user avartar"
            src="https://lh3.googleusercontent.com/a/AEdFTp6kYIoi-9ed4gAT_zqtr-qQOcu_Dt_JzaWn8NhN=s96-c"
            sx={{
              height: 24,
              width: 24,
            }}
          />
          <span>dongngo2001@gmail.com</span>
        </div>
      </div>
    </div>
  );
}

export default SetCard;
