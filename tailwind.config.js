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
          DEFAULT: "#FF8533",
          hover: "#E55F00",
        },
        accent: "#FF8533",
        sidebar: "#000000",
        surface: {
          main: "#F6F5F3",
          card: "#FFFFFF",
        },
        border: {
          DEFAULT: "#E7E4DF",
          card: "#E7E4DF",
          calendar: "#E7E4DF",
        },
        text: {
          primary: "#1A1A1A",
          secondary: "#6B7280",
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
