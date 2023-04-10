import React from "react";
import { Routes, Route, BrowserRouter, Outlet } from "react-router-dom";
import Login from "@pages/login";
import SignUp from "@pages/signup";
import NotFound from "@pages/notfound";
import MainContainer from "@components/mainContainer";
import StudySet from "@pages/studySet";
import Folder from "@pages/folder";
import Home from "@pages/home";
import CreateDeck from "@pages/home/createDeck";
import { useDispatch, useSelector } from "react-redux";
import {
  selectGlobalError,
  selectLoading,
  setGlobalError,
} from "./store/authSlice";
import { GlobalLoadingWrapper } from "@components/loading";
import DeckDetail from "@pages/home/deckDetail";
import EditDeck from "@pages/home/deckDetail/editDeck";
import { Alert, Snackbar } from "@mui/material";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import PermissionDenied from "@pages/permissionDenied";
import Invite from "@pages/invite";

function App() {
  const loading = useSelector(selectLoading);
  const error = useSelector(selectGlobalError);
  const dispatch = useDispatch();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="" element={<MainContainer />}>
          <Route path="" element={<Home />} />
          <Route path="deck" element={<StudySet />} />
          <Route path="folder" element={<Folder />} />
          <Route path="create-deck" element={<CreateDeck />} />
          <Route path="deck/:deckID" element={<Outlet />}>
            <Route path="" element={<DeckDetail />} />
            <Route path="edit" element={<EditDeck />} />
          </Route>
          <Route path="invite" element={<Invite />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="denied" element={<PermissionDenied />} />
        <Route path="notfound" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
