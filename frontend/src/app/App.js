import React, { Suspense, useEffect, useRef } from "react";
import { Routes, Route, BrowserRouter, Outlet, Navigate } from "react-router-dom";
import MainContainer from "@components/mainContainer";
import { useDispatch, useSelector } from "react-redux";
import authService from "@api-services/authService";
import { sendTokenToExtension } from "@utils/extensionLogin";
import {
  bootstrapSession,
  getUser,
  markBootstrapped,
  selectBootstrapped,
  selectGlobalError,
  selectLoading,
  selectToken,
  selectUser,
  setGlobalError,
} from "./store/authSlice";
import { GlobalLoadingWrapper, LocalLoadingWrapper } from "@components/loading";
import ErrorBoundary from "@components/errorBoundary";
import lazyWithRetry from "@utils/lazyWithRetry";
import { Alert, Snackbar } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Public auth pages are for logged-out users, and the OAuth/activation redirect
// delivers its token via the URL fragment (not the cookie), so we skip the
// silent /refresh probe on these routes.
const PUBLIC_AUTH_PATHS = ["/login", "/signup"];

const Login = lazyWithRetry(() => import("@pages/login"));
const SignUp = lazyWithRetry(() => import("@pages/signup"));
const NotFound = lazyWithRetry(() => import("@pages/notfound"));
const Folder = lazyWithRetry(() => import("@pages/folder"));
const Home = lazyWithRetry(() => import("@pages/home"));
const CreateDeck = lazyWithRetry(() => import("@pages/home/createDeck"));
const DeckDetail = lazyWithRetry(() => import("@pages/home/deckDetail"));
const EditDeck = lazyWithRetry(() => import("@pages/home/deckDetail/editDeck"));
const PermissionDenied = lazyWithRetry(() => import("@pages/permissionDenied"));
const Invite = lazyWithRetry(() => import("@pages/invite"));
const LearnPage = lazyWithRetry(() => import("@pages/home/deckDetail/learn"));
const SingleTermLearn = lazyWithRetry(() =>
  import("@pages/home/deckDetail/learn/singleTerm")
);
const DeckPage = lazyWithRetry(() => import("@pages/home/deckPage"));
const UserSettings = lazyWithRetry(() => import("@pages/home/userSettings"));
const Revise = lazyWithRetry(() => import("@pages/home/deckDetail/revise"));
const QuickRevise = lazyWithRetry(() =>
  import("@pages/home/deckDetail/revise/quickRevise")
);
const NumberTest = lazyWithRetry(() =>
  import("@pages/home/deckDetail/numberTest")
);
const Listening = lazyWithRetry(() => import("@pages/home/listening"));
const ListenAndType = lazyWithRetry(() =>
  import("@pages/home/listening/listenAndType")
);
const SpeakingCoach = lazyWithRetry(() =>
  import("@pages/home/deckDetail/speakingCoach")
);
const WritingCoach = lazyWithRetry(() =>
  import("@pages/home/deckDetail/writingCoach")
);
const Course = lazyWithRetry(() => import("@pages/home/course"));
const Grammar = lazyWithRetry(() => import("@pages/home/grammar"));
const ReviseMix = lazyWithRetry(() => import("@pages/home/revise"));
const PrivacyPage = lazyWithRetry(() => import("@pages/privacy"));

function RouteFallback() {
  return <LocalLoadingWrapper open />;
}

function App() {
  const loading = useSelector(selectLoading);
  const error = useSelector(selectGlobalError);
  const token = useSelector(selectToken);
  const user = useSelector(selectUser);
  const bootstrapped = useSelector(selectBootstrapped);
  const dispatch = useDispatch();

  // The extension opens the web app with ?source=extension when connecting an
  // account. Capture it once, then strip it from the URL.
  const extConnectRef = useRef(
    new URLSearchParams(window.location.search).get("source") === "extension"
  );
  useEffect(() => {
    if (!extConnectRef.current) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("source");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);

  // On load the in-memory access token is gone; silently exchange the HttpOnly
  // refresh cookie for a fresh access token before deciding what to render. Skip
  // the probe on public auth pages — there's no session to restore there.
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (PUBLIC_AUTH_PATHS.includes(path)) {
      dispatch(markBootstrapped());
    } else {
      dispatch(bootstrapSession());
    }
  }, [dispatch]);

  // Extension hand-off for an already-logged-in user: once the session is
  // established, mint a fresh token pair and relay it to the extension. (A fresh
  // login relays via loginEvent on its own, so we only handle the logged-in case.)
  useEffect(() => {
    if (!bootstrapped || !extConnectRef.current) return;
    extConnectRef.current = false;
    if (!token) return;
    authService
      .extensionToken()
      .then((data) => data && sendTokenToExtension(data))
      .catch(() => {});
  }, [bootstrapped, token]);

  // The access JWT doesn't embed the profile, so once we have a token but no
  // user (after login or a bootstrap refresh), fetch the profile.
  useEffect(() => {
    if (token && !user) {
      dispatch(getUser());
    }
  }, [token, user, dispatch]);

  // Wait for the initial refresh attempt so we don't flash the login page (and
  // bounce a logged-in user) before the session is established.
  if (!bootstrapped) {
    return <RouteFallback />;
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="" element={<MainContainer />}>
            <Route path="" element={<Home />} />
            <Route path="deck" element={<DeckPage />} />
            <Route path="number-test" element={<Navigate to="/listening/numbers" replace />} />
            <Route path="listening" element={<Listening />} />
            <Route path="listening/numbers" element={<Listening />} />
            <Route path="listening/topics/:topicSlug" element={<Listening />} />
            <Route
              path="listening/exercise/:exerciseId/listen-and-type"
              element={<ListenAndType />}
            />
            <Route path="course" element={<Course />} />
            <Route path="course/:courseId" element={<Course />} />
            <Route path="course/:courseId/:lessonId" element={<Course />} />
            <Route path="speaking-coach" element={<SpeakingCoach />} />
            <Route path="speaking-coach/history" element={<SpeakingCoach />} />
            <Route path="speaking-coach/course" element={<SpeakingCoach />} />
            <Route path="speaking-coach/course/:courseId" element={<SpeakingCoach />} />
            <Route path="speaking-coach/course/:courseId/:lessonId" element={<SpeakingCoach />} />
            <Route path="speaking-coach/:id" element={<SpeakingCoach />} />
            <Route path="writing-coach" element={<WritingCoach />} />
            <Route path="writing-coach/history" element={<WritingCoach />} />
            <Route path="writing-coach/:id" element={<WritingCoach />} />
            <Route path="grammar" element={<Grammar />} />
            <Route path="grammar/:unitKey" element={<Grammar />} />
            <Route path="revise" element={<ReviseMix />} />
            <Route path="learn/:termId" element={<SingleTermLearn />} />
            <Route path="folder" element={<Folder />} />
            <Route path="create-deck" element={<CreateDeck />} />
            <Route path="deck/:deckID" element={<Outlet />}>
              <Route path="" element={<DeckDetail />} />
              <Route path="edit" element={<EditDeck />} />
              <Route path="learn" element={<LearnPage />} />
              <Route path="learn/:termId" element={<LearnPage />} />
              <Route path="revise" element={<Revise />} />
              <Route path="quick-revise" element={<QuickRevise />} />
              <Route path="number-test" element={<NumberTest />} />
            </Route>
            <Route path="invite" element={<Invite />} />
            <Route path="settings" element={<UserSettings />} />
          </Route>
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="denied" element={<PermissionDenied />} />
          <Route path="notfound" element={<NotFound />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <ToastContainer />
      {loading && <GlobalLoadingWrapper />}
      {error && (
        <Snackbar
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          open={error != null}
          autoHideDuration={6000}
          onClose={() => dispatch(setGlobalError(null))}
        >
          <Alert
            onClose={() => dispatch(setGlobalError(null))}
            severity="error"
          >
            {error}
          </Alert>
        </Snackbar>
      )}
    </BrowserRouter>
  );
}

export default App;
