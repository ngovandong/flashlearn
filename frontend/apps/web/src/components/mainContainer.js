import { Outlet } from "react-router-dom";
import NavBar from "./navBar";
import PrivateRoute from "./privateRoute";
import AiAssistant from "./aiAssistant";
import { TourProvider } from "./tourProvider";

export default function MainContainer() {
  return (
    <PrivateRoute>
      <TourProvider>
        <NavBar />
        <div className="main-container">
          <Outlet />
        </div>
        <AiAssistant />
      </TourProvider>
    </PrivateRoute>
  );
}
