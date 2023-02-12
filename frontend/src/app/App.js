import React from "react";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import Home from "../pages/home";
import Login from "../pages/login";
import SignUp from "../pages/signup";
import NotFound from "../pages/notfound";
import MainContainer from "../components/mainContainer";
import StudySet from "../pages/studySet";
import Recent from "../pages/recent";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="" element={<MainContainer />}>
          <Route path="" element={<Home />} />
          <Route path="study-set" element={<StudySet />} />
          <Route path="recent" element={<Recent />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<SignUp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
