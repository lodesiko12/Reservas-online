/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens de turnigo-tokens.css (teal #0B6E6A + coral #FF6B4A)
        brand: {
          50: "#E8F4F3", 100: "#CFE6E3", 200: "#9FCFC9", 300: "#6FB5AE", 400: "#3F9A93",
          500: "#0B6E6A", 600: "#095A57", 700: "#07403E",
        },
        coral: { 50: "#FFEFEA", 500: "#FF6B4A", 700: "#C8401F" },
        // Neutros con matiz verde azulado: --tg-bg, --tg-border, --tg-text-muted, --tg-text
        slate: {
          50: "#F3F7F6", 100: "#E8F0EF", 200: "#D9E4E2", 300: "#BFD0CD", 400: "#8CA3A1",
          500: "#5E7776", 600: "#4A6362", 700: "#2F4846", 800: "#1A3535", 900: "#0F2A2A", 950: "#0A1D1D",
        },
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: { card: "var(--tg-shadow-card)" },
    },
  },
  plugins: [],
};
