/** Tokens from the Dishari style guide v1.0 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        maroon: { DEFAULT: "#7A0F1E", hover: "#5C0B17", tint: "#F6E7E9", deep: "#3D0710" },
        gold: { DEFAULT: "#B8892B", soft: "#E9D3A4" },
        ink: { DEFAULT: "#1F1F1F", 2: "#4A4A4A", 3: "#6B6B6B" },
        line: "#C8C8C8",
        paper: "#FAF8F5",
        head: "#F5F3EF",
        ok: "#2D6A2D",
        warn: "#8A5A00",
        err: "#B3261E",
        info: "#1E4F91",
      },
      fontFamily: { sans: ["Inter", "'Hind Siliguri'", "'Noto Sans Bengali'", "sans-serif"] },
      borderRadius: { field: "8px", card: "12px" },
      maxWidth: { content: "1200px" },
      boxShadow: { card: "0 1px 2px rgba(31,31,31,.04), 0 8px 24px -12px rgba(122,15,30,.18)", lift: "0 18px 40px -16px rgba(122,15,30,.35)" },
    },
  },
  plugins: [],
};
