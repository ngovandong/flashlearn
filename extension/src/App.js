import "./App.css";
import LoginPage from "./pages/login";
import Home from "./pages/home";
import { useSelector } from "react-redux";
import { selectToken } from "./store";

function App() {
  const token = useSelector(selectToken);

  return token ? <Home /> : <LoginPage />;
}

export default App;
