"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F2F1E6", color: "#262823", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ color: "#2E4E36" }}>Something went wrong</h1>
          <p>Please refresh the page or try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 22px", borderRadius: 999, border: 0, background: "#2E4E36", color: "#F2F1E6", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
