/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F8F4EC",
        ink: "#211D1A",
        tomato: "#C9362B",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
      boxShadow: {
        soft: "0 16px 50px rgba(50, 39, 28, 0.08)",
      },
    },
  },
  plugins: [],
};
