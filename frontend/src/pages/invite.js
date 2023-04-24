import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { roleService } from "@api-services/roleService";

function Invite() {
  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  useEffect(() => {
    if (token) {
      roleService
        .invite(token)
        .then((res) => {
          if (!res.error) navigate(`/deck/${res.data.deck_id}`);
          else navigate("/notfound");
        })
        .catch((error) => {
          navigate("/notfound");
        });
    } else {
      navigate("/notfound");
    }
  }, []);
  return <>{token}</>;
}

export default Invite;
