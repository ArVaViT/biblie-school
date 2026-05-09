import { useEffect, useState } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      style={{
        position: "fixed",
        bottom: "20px",

        left: "50%",
        transform: "translateX(-50%)",

        width: "50px",
        height: "50px",
        borderRadius: "50%",

        backgroundColor: "black",
        color: "white",

        border: "none",
        cursor: "pointer",
        zIndex: 9999,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",

        fontSize: "20px",

        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      ↑
    </button>
  );
}