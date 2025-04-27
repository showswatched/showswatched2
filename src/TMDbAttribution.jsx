export default function TMDbAttribution() {
  return (
    <div style={{ textAlign: "center", margin: "2rem 0" }}>
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: "inline-block" }}
      >
        <img
          src="https://www.themoviedb.org/assets/2/v4/logos/stacked-blue-5c3c7c3c7e6f2a2e4e6e1f3c7e6f2a2e4e6e1f3c7e6f2a2e4e6e1f3c.svg"
          alt="TMDb Logo"
          style={{ height: 48, marginBottom: 8 }}
        />
      </a>
      <div style={{ fontSize: "0.95rem", color: "#888" }}>
        This product uses the{" "}
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          TMDb API
        </a>{" "}
        but is not endorsed or certified by TMDb.
      </div>
    </div>
  );
}
