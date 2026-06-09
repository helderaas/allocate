import type { Config } from "tailwindcss";
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "sans-serif"] },
      colors: {
        brand: {
          50:  "#e8edf2",  // light slate tint - bg highlights
          100: "#d0d9e3",  // slightly deeper - hover backgrounds
          200: "#C7EABB",  // sage green - success/posted/active states
          300: "#a8d99e",  // sage border
          400: "#6b8499",  // mid slate - muted text/borders
          500: "#4e6378",  // slate - secondary actions
          600: "#3b4a5a",  // primary slate - buttons, links
          700: "#2e3c4a",  // hover state
          800: "#1e2a35",  // dark slate
          900: "#111820",  // darkest
          // Sage text colors for use on sage backgrounds
          sage: "#2d5c22",
        },
      },
    },
  },
  plugins: [],
};
export default config;
