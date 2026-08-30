import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Alert from "@mui/material/Alert";
import {
  login,
  selectToken,
  selectError,
  setToken,
  setError,
} from "@app/store/authSlice";
import GoogleLoginBT from "@components/googleLoginBT";
import { sendTokenToExtension } from "@utils/extensionLogin";
import { Sentry } from "../config/sentry";
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const error = useSelector(selectError);
  const [redirectError, setRedirectError] = useState();
  const [redirectInfo, setRedirectInfo] = useState();
  const [searchParams] = useSearchParams();
  const handle_submit = async (e) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  if (token) {
    navigate("/");
  }

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.stopPropagation();
      event.preventDefault();
      if (email) {
        handle_submit(event);
      }
    }
  };

  useEffect(() => {
    const info = searchParams.get("info");
    if (info) {
      setRedirectInfo(info);
    }

    const errorMessage = searchParams.get("error");
    if (errorMessage) {
      Sentry.captureMessage(`Google redirect login failed: ${errorMessage}`, {
        tags: { authContext: "google-redirect" },
      });
      setRedirectError(errorMessage);
    }

    // Google OAuth / email-activation deliver tokens in the URL fragment (#),
    // not the query string, so they aren't sent to the server, logged, or
    // leaked via Referer. Read them from the hash and then strip them from the
    // address bar / history.
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const hashParams = new URLSearchParams(hash);
    const access = hashParams.get("access");
    const userParam = hashParams.get("user");
    if (access) {
      let user = null;
      if (userParam) {
        try {
          user = JSON.parse(atob(userParam));
        } catch {
          // ignore malformed user payload
        }
      }
      // Refresh token already arrived as an HttpOnly cookie on the redirect; we
      // only take the access token (+ user) from the fragment.
      const payload = user ? { access, user } : { access };
      sendTokenToExtension(payload);
      dispatch(setToken(payload));
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="signup-login-page">
      {error && (
        <Alert
          severity="error"
          onClose={() => {
            dispatch(setError(""));
          }}
        >
          {error}
        </Alert>
      )}
      {redirectError && (
        <Alert severity="error" onClose={() => setRedirectError("")}>
          {redirectError}
        </Alert>
      )}
      {redirectInfo && (
        <Alert severity="info" onClose={() => setRedirectInfo("")}>
          {redirectInfo}
        </Alert>
      )}
      <div className="form">
        <form onSubmit={handle_submit}>
          <h1>Log in</h1>

          <GoogleLoginBT />
          <div className="devicer" />
          <label>Email</label>
          <input
            type="email"
            onChange={(e) => setEmail(e.target.value)}
            name="email"
            placeholder="Enter your email address…"
            value={email}
            required
            tabIndex={1}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                passwordRef.current.focus();
              }
            }}
          />
          <br />

          <label>Password</label>
          <input
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            placeholder="Enter your password…"
            value={password}
            required
            onKeyDown={handleKeyDown}
            tabIndex={1}
            ref={passwordRef}
          />
          <br />

          <input type="submit" value="Log in" />

          <div className="bottom-text">
            <p>Don't have an account?</p>
            <Link className="link" to="/signup">
              Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
