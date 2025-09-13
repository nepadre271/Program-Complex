/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}", "./vk-shell/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        electric: {
          50: "#e0f2ff",
          100: "#b3daff",
          200: "#80c1ff",
          300: "#4da8ff",
          400: "#1a8fff",
          500: "#0077e6",
          600: "#005bb4",
          700: "#004182",
          800: "#002651",
          900: "#000c21",
        },
      },
    },
  },
  plugins: [],
};
