import { useGoogleOneTapLogin } from "@react-oauth/google";
import React from "react";
import { useDispatch } from "react-redux";
import { setError, setToken } from "@app/store/authSlice";
import authService from "@api-services/authService";
import { getFirstError } from "@utils/errorHandler";
import { toast } from "react-toastify";
import { sendTokenToExtension } from "@utils/extensionLogin";
const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function CustomPopupGoogleLoginBT() {
  const dispatch = useDispatch();

  const scope = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");
  const handleUserInit = (res) => {
    if (!res.error) {
      sendTokenToExtension(res.data);
      dispatch(setToken(res.data));
    } else {
      const errorMessage = getFirstError(res.error);
      dispatch(setError(errorMessage));
    }
  };
  const onPopupSuccess = async (response) => {
    const id_token = response.credential;
    await authService
      .initUser(id_token)
      .then(handleUserInit)
      .catch((err) => {
        toast.error(getFirstError(err) || "Google login failed.");
      });
  };
  const openGoogleLoginPage = () => {
    const googleAuthUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const redirectUri = "users/google_login/";

    const params = {
      response_type: "code",
      client_id: clientId,
      redirect_uri: `${process.env.REACT_APP_BASE_URL}${redirectUri}`,
      prompt: "select_account",
      access_type: "offline",
      scope,
    };

    const urlParams = new URLSearchParams(params).toString();

    window.location = `${googleAuthUrl}?${urlParams}`;
  };
  useGoogleOneTapLogin({
    onSuccess: onPopupSuccess,
    onError: () => {
      dispatch(setError("Google login failed."));
    },
  });
  return (
    <button onClick={openGoogleLoginPage} className="loginBT">
      <img src="icons/google.svg" alt="google login" className="icon"></img>
      <span className="buttonText">Continue with Google</span>
    </button>
  );
}

export default CustomPopupGoogleLoginBT;
