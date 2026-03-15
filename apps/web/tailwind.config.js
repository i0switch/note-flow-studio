/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1f2937",
        sand: "#f3efe5",
        gold: "#b7791f",
        pine: "#1f4d3d"
      }
    }
  },
  plugins: []
};
