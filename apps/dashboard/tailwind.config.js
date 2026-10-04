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
        // Estados: se remapean las paletas de Tailwind a --tg-success/warning/danger/info
        green: { 50: "#EAF6EF", 100: "#D3EDDF", 200: "#A8DABF", 300: "#74C198", 400: "#3FA66D", 500: "#2A9A5B", 600: "#1F8A4C", 700: "#186B3B", 800: "#124F2C", 900: "#0D3A20", 950: "#08241A" },
        emerald: { 50: "#EAF6EF", 100: "#D3EDDF", 200: "#A8DABF", 300: "#74C198", 400: "#3FA66D", 500: "#2A9A5B", 600: "#1F8A4C", 700: "#186B3B", 800: "#124F2C", 900: "#0D3A20", 950: "#08241A" },
        amber: { 50: "#FBF3E3", 100: "#F6E5BF", 200: "#EBCB85", 300: "#DEAE4F", 400: "#CC9232", 500: "#C2851F", 600: "#B7791F", 700: "#8F5E18", 800: "#6B4612", 900: "#4A310D", 950: "#2E1E08" },
        orange: { 50: "#FBF3E3", 100: "#F6E5BF", 200: "#EBCB85", 300: "#DEAE4F", 400: "#CC9232", 500: "#C2851F", 600: "#B7791F", 700: "#8F5E18", 800: "#6B4612", 900: "#4A310D", 950: "#2E1E08" },
        red: { 50: "#FBEDEB", 100: "#F6D6D2", 200: "#EDADA5", 300: "#E17F73", 400: "#D4584A", 500: "#C94A3B", 600: "#C0392B", 700: "#992E22", 800: "#73231A", 900: "#4F1812", 950: "#330F0B" },
        rose: { 50: "#FBEDEB", 100: "#F6D6D2", 200: "#EDADA5", 300: "#E17F73", 400: "#D4584A", 500: "#C94A3B", 600: "#C0392B", 700: "#992E22", 800: "#73231A", 900: "#4F1812", 950: "#330F0B" },
        sky: { 50: "#EAF1F9", 100: "#D2E2F3", 200: "#A5C5E6", 300: "#73A3D5", 400: "#4783C3", 500: "#2F70B5", 600: "#2563A8", 700: "#1D4F86", 800: "#153A63", 900: "#0F2744", 950: "#09182B" },
        blue: { 50: "#EAF1F9", 100: "#D2E2F3", 200: "#A5C5E6", 300: "#73A3D5", 400: "#4783C3", 500: "#2F70B5", 600: "#2563A8", 700: "#1D4F86", 800: "#153A63", 900: "#0F2744", 950: "#09182B" },
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
