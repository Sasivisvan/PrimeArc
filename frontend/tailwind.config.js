/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          background: "#0B1120", // Deep Navy
          primary: {
            DEFAULT: "#00E5FF", // Electric Blue / Cyan
            glow: "#00E5FF",
          },
          secondary: {
            DEFAULT: "#6366F1", // Muted Indigo
            foreground: "#E0E7FF",
          },
          alert: {
            urgent: "#FF3333", // Neon Red
            notice: "#FACC15", // Yellow
          },
          surface: {
            DEFAULT: "rgba(30, 41, 59, 0.7)", // Glassmorphism base
            hover: "rgba(30, 41, 59, 0.9)",
          }
        },
        fontFamily: {
          sans: ["Inter", "DM Sans", "sans-serif"],
        },
        borderRadius: {
            xl: "1rem",
            "2xl": "1.5rem",
        },
        boxShadow: {
            "glow-primary": "0 0 20px -5px rgba(0, 229, 255, 0.5)",
            "glow-urgent": "0 0 20px -5px rgba(255, 51, 51, 0.5)",
        }
      },
    },
    plugins: [],
  }
