/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        none:    "0",
        sm:      "2px",
        DEFAULT: "3px",
        md:      "3px",
        lg:      "3px",
        xl:      "4px",
        "2xl":   "6px",
        "3xl":   "8px",
        full:    "9999px",
      },
    },
  },
  plugins: [],
};
