"use client";

import * as React from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces
 * <html>/<body>, so styling is inline and minimal.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#faf8f3",
          color: "#1b1a16",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#6b675d", marginBottom: 20 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={retry}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 8,
              border: "none",
              background: "#1e5f45",
              color: "#f6f9f5",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
