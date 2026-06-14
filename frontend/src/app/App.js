import React, { Suspense } from "react";
import { Routes, Route, BrowserRouter, Outlet } from "react-router-dom";
import MainContainer from "@components/mainContainer";
import { useDispatch, useSelector } from "react-redux";
import {
  selectGlobalError,
  selectLoading,
  setGlobalError,
} from "./store/authSlice";
import { GlobalLoadingWrapper, LocalLoadingWrapper } from "@components/loading";
import ErrorBoundary from "@components/errorBoundary";
import lazyWithRetry from "@utils/lazyWithRetry";
import { Alert, Snackbar } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
const SpeakingCoach = lazyWithRetry(() =>
  import("@pages/home/deckDetail/speakingCoach")
);
const PrivacyPage = lazyWithRetry(() => import("@pages/privacy"));

function RouteFallback() {
  return <LocalLoadingWrapper open />;
}

function App() {
  const loading = useSelector(selectLoading);
  const error = useSelector(selectGlobalError);
  const dispatch = useDispatch();
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="" element={<MainContainer />}>
            <Route path="" element={<Home />} />
            <Route path="deck" element={<DeckPage />} />
            <Route path="number-test" element={<NumberTest />} />
            <Route path="speaking-coach" element={<SpeakingCoach />} />
            <Route path="speaking-coach/:id" element={<SpeakingCoach />} />
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
