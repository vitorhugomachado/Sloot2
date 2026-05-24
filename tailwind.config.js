/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        black: "#000000",
        "gray-dark": "#0F0F0F",
        "gray-border": "#696969",
        white: "#FFFFFF",
        primary: {
          DEFAULT: "#FF6A00",
          hover: "#FF8533",
        },
        accent: "#FF6A00",
        sidebar: "#000000",
        surface: {
          main: "#FFFDF7",
          card: "#FFFFFF",
        },
        border: {
          DEFAULT: "#696969",
          card: "#696969",
          calendar: "#696969",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "rgba(255, 255, 255, 0.55)",
        },
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#F59E0B",
        info: "#3B82F6",
      },
    },
  },
  plugins: [],
};
