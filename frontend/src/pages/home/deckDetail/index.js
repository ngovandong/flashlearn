import { useNavigate, useParams } from "react-router-dom";

function DeckDetail() {
  const { deckID } = useParams();
  const navigate = useNavigate();
  return (
    <>
      <div>Deck {deckID}</div>
      <button onClick={() => navigate("edit")}>Edit</button>
    </>
  );
}

export default DeckDetail;
