import { Backdrop, Box } from "@mui/material";

function LoadingSpinner() {
  return (
    <Box
      component="span"
      className="fl-loading-spinner"
      role="status"
      aria-label="Loading"
    />
  );
}

function GlobalLoadingWrapper({ open = true }) {
  if (!open) return null;

  return (
    <Backdrop
      sx={{
        bgcolor: "rgba(0, 0, 0, 0.25)",
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
      open={open}
      id="loading-wrapper"
    >
      <LoadingSpinner />
    </Backdrop>
  );
}

function LocalLoadingWrapper({ open = true }) {
  if (!open) return null;

  return (
    <Backdrop
      sx={{
        bgcolor: "rgba(0, 0, 0, 0.12)",
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
      open={open}
      id="loading-wrapper"
    >
      <LoadingSpinner />
    </Backdrop>
  );
}

export { LocalLoadingWrapper, GlobalLoadingWrapper, LoadingSpinner };
