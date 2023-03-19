import { useGoogleOneTapLogin } from "@react-oauth/google";
import React from "react";
import { useDispatch } from "react-redux";
import { setError, setToken } from "@app/store/authSlice";
import authService from "@api-services/authService";
const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function CustomPopupGoogleLoginBT() {
  const dispatch = useDispatch();

  const scope = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");
  const handleUserInit = (res) => {
    if (res.data) {
      const { access, refresh } = res.data;
      dispatch(setToken({ access, refresh }));
    } else {
      const data = res.response.data;
      if (data.message) {
        throw new Error(data.message);
      } else {
        const data = res.response.data;
        const firstKeyError = Object.keys(data)[0];
        const error = Array.isArray(data[firstKeyError])
          ? data[firstKeyError][0]
          : data[firstKeyError];
        const errorMessage = firstKeyError + ": " + error;
        dispatch(setError(errorMessage));
      }
    }
  };
  const onPopupSuccess = (response) => {
    const id_token = response.credential;

    authService
      .initUser(id_token)
      .then(handleUserInit)
      .catch((notifyError) => console.log(notifyError));
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
      console.log("Login Failed");
    },
  });
  return (
    <button onClick={openGoogleLoginPage} className="loginBT">
      <img src="icons/google.svg" alt="google login" className="icon"></img>
      <span className="buttonText">Login with Google</span>
    </button>
  );
}

export default CustomPopupGoogleLoginBT;
