import React, { Suspense, lazy } from "react";
import { Routes, Route, BrowserRouter, Outlet } from "react-router-dom";
import MainContainer from "@components/mainContainer";
import { useDispatch, useSelector } from "react-redux";
import {
  selectGlobalError,
  selectLoading,
  setGlobalError,
} from "./store/authSlice";
import { GlobalLoadingWrapper, LocalLoadingWrapper } from "@components/loading";
import { Alert, Snackbar } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Login = lazy(() => import("@pages/login"));
const SignUp = lazy(() => import("@pages/signup"));
const NotFound = lazy(() => import("@pages/notfound"));
const Folder = lazy(() => import("@pages/folder"));
const Home = lazy(() => import("@pages/home"));
const CreateDeck = lazy(() => import("@pages/home/createDeck"));
const DeckDetail = lazy(() => import("@pages/home/deckDetail"));
const EditDeck = lazy(() => import("@pages/home/deckDetail/editDeck"));
const PermissionDenied = lazy(() => import("@pages/permissionDenied"));
const Invite = lazy(() => import("@pages/invite"));
const LearnPage = lazy(() => import("@pages/home/deckDetail/learn"));
const DeckPage = lazy(() => import("@pages/home/deckPage"));
const UserSettings = lazy(() => import("@pages/home/userSettings"));
const Revise = lazy(() => import("@pages/home/deckDetail/revise"));
const QuickRevise = lazy(() => import("@pages/home/deckDetail/revise/quickRevise"));
const NumberTest = lazy(() => import("@pages/home/deckDetail/numberTest"));
const PrivacyPage = lazy(() => import("@pages/privacy"));

function RouteFallback() {
  return <LocalLoadingWrapper open />;
}

function App() {
  const loading = useSelector(selectLoading);
  const error = useSelector(selectGlobalError);
  const dispatch = useDispatch();
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="" element={<MainContainer />}>
            <Route path="" element={<Home />} />
            <Route path="deck" element={<DeckPage />} />
            <Route path="folder" element={<Folder />} />
            <Route path="create-deck" element={<CreateDeck />} />
            <Route path="deck/:deckID" element={<Outlet />}>
              <Route path="" element={<DeckDetail />} />
              <Route path="edit" element={<EditDeck />} />
              <Route path="learn" element={<LearnPage />} />
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
