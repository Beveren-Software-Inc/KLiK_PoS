/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input))",
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: {
            DEFAULT: "hsl(var(--primary))",
            foreground: "hsl(var(--primary-foreground))",
          },
          secondary: {
            DEFAULT: "hsl(var(--secondary))",
            foreground: "hsl(var(--secondary-foreground))",
          },
          destructive: {
            DEFAULT: "hsl(var(--destructive))",
            foreground: "hsl(var(--destructive-foreground))",
          },
          muted: {
            DEFAULT: "hsl(var(--muted))",
            foreground: "hsl(var(--muted-foreground))",
          },
          accent: {
            DEFAULT: "hsl(var(--accent))",
            foreground: "hsl(var(--accent-foreground))",
          },
          popover: {
            DEFAULT: "hsl(var(--popover))",
            foreground: "hsl(var(--popover-foreground))",
          },
          card: {
            DEFAULT: "hsl(var(--card))",
            foreground: "hsl(var(--card-foreground))",
          },
          // Beveren brand colors
          beveren: {
            50: "#f0f6fb",
            100: "#e0ecf6",
            200: "#c7dcef",
            300: "#a1c4e4",
            400: "#74a5d6",
            500: "#5189ca",
            600: "#316294", // Main brand color
            700: "#2c5682",
            800: "#294a6b",
            900: "#263f5a",
            950: "#1a293c",
          },
          // Keep green for compatibility
          green: {
            50: "#f0f9f0",
            100: "#dcf2dc",
            200: "#bce5bc",
            300: "#8dd18d",
            400: "#57b757",
            500: "#388e3c",
            600: "#2e7d32",
            700: "#1b5e20",
            800: "#1a4e1a",
            900: "#174117",
          },
          // Blue theme (using beveren colors)
          blue: {
            50: "#f0f6fb",
            100: "#e0ecf6",
            200: "#c7dcef",
            300: "#a1c4e4",
            400: "#74a5d6",
            500: "#5189ca",
            600: "#316294",
            700: "#2c5682",
            800: "#294a6b",
            900: "#263f5a",
            950: "#1a293c",
          },
        },
        borderRadius: {
          lg: "var(--radius)",
          md: "calc(var(--radius) - 2px)",
          sm: "calc(var(--radius) - 4px)",
        },
        fontFamily: {
          inter: ["Inter", "sans-serif"],
          tajawal: ["Tajawal", "sans-serif"],
        },
        backgroundImage: {
          "grid-pattern":
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23316294' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        },
         animation: {
      'gradient-x': 'gradient-x 10s ease infinite',
    },
    keyframes: {
      'gradient-x': {
        '0%, 100%': {
          'background-position': '0% 50%',
        },
        '50%': {
          'background-position': '100% 50%',
        },
      },
    },
    backgroundSize: {
      '200': '200% 200%',
    },


      },
    },
    plugins: [require("tailwindcss-animate")],
  }
  