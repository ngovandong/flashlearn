import React from "react";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import Login from "@pages/login";
import SignUp from "@pages/signup";
import NotFound from "@pages/notfound";
import MainContainer from "@components/mainContainer";
import StudySet from "@pages/studySet";
import Folder from "@pages/folder";
import Home from "@pages/home";
import CreateDeck from "@pages/home/createDeck";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="" element={<MainContainer />}>
          <Route path="" element={<Home />} />
          <Route path="deck" element={<StudySet />} />
          <Route path="folder" element={<Folder />} />
          <Route path="create-deck" element={<CreateDeck />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
