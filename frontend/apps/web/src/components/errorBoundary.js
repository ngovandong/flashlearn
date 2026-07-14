import React from "react";

/**
 * Top-level error boundary. <Suspense> only handles the loading state, so any
 * error thrown while rendering (including a lazy chunk that ultimately fails to
 * load) would otherwise unmount the whole tree and leave a blank screen.
 *
 * This catches those errors and renders an on-theme fallback with a retry that
 * does a hard reload (which also recovers from stale post-deploy chunks).
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Uncaught UI error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          backgroundColor: "var(--fl-bg)",
          color: "var(--fl-text)",
        }}
      >
        <h2 style={{ margin: 0, color: "var(--fl-text)" }}>
          Something went wrong
        </h2>
        <p style={{ margin: 0, maxWidth: 420, color: "var(--fl-text-minor)" }}>
          The page failed to load. This can happen after an update — reloading
          usually fixes it.
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            cursor: "pointer",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            minHeight: 44,
            fontSize: 16,
            fontWeight: 600,
            color: "var(--fl-on-primary)",
            background: "var(--fl-gradient)",
          }}
        >
          Reload page
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
