import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import App from "./App";

jest.mock("./pages/home", () => () => <div>Home</div>);

function renderApp() {
  const store = configureStore({
    reducer: {
      auth: () => ({ user: null, token: null }),
    },
  });

  return render(
    <Provider store={store}>
      <App />
    </Provider>
  );
}

test("renders connect account when not logged in", () => {
  renderApp();
  expect(screen.getByText(/Connect Account/i)).toBeInTheDocument();
});
