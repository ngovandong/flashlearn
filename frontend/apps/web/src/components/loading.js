import { COLORS } from "@constants/colors";
import { Backdrop } from "@mui/material";
import { HashLoader } from "react-spinners";

function GlobalLoadingWrapper({ open = true }) {
  return (
    <Backdrop
      sx={{
        // bgcolor: "transparent",
        bgcolor: "rgba(0,0,0,0.2)",
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
      open={open}
      id="loading-wrapper"
    >
      {/* <FadeLoader color={COLORS.BLUE} /> */}
    </Backdrop>
  );
}

function LocalLoadingWrapper({ open = true }) {
  return (
    <Backdrop
      sx={{
        // bgcolor: "transparent",
        bgcolor: "rgba(0,0,0,0.05)",
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
      open={open}
      id="loading-wrapper"
    >
      <HashLoader color={COLORS.BLUE} />
    </Backdrop>
  );
}

export { LocalLoadingWrapper, GlobalLoadingWrapper };
