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
import { useSelector } from "react-redux";
import { selectLoading } from "./store/authSlice";
import { GlobalLoadingWrapper } from "@components/loading";
import DeckDetail from "@pages/home/deckDetail";
import EditDeck from "@pages/home/deckDetail/editDeck";

function App() {
  const loading = useSelector(selectLoading);
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
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="notfound" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {loading && <GlobalLoadingWrapper />}
    </BrowserRouter>
  );
}

export default App;
