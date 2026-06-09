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
          50:  "#f0faea",  // ultra-light sage tint
          100: "#d8f0cc",  // light sage
          200: "#C7EABB",  // sage green - success/posted/active
          300: "#a8d99e",  // sage border
          400: "#4a7a6a",  // mid forest
          500: "#3a6658",  // forest secondary
          600: "#2B5748",  // primary forest green - buttons, links
          700: "#1a3830",  // hover state
          800: "#122820",  // dark
          900: "#0a1a14",  // darkest
          sage: "#1a3830", // text on sage backgrounds
        },
      },
    },
  },
  plugins: [],
};
export default config;
