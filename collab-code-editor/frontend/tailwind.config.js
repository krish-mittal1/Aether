module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./hooks/**/*.{js,jsx}", "./store/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#070b10", // deep obsidian space dark
        rail: "#030508",  // absolute dark background
        line: "#11171d",  // classy subtle border
        accent: "#0df2c9", // premium neon teal/cyan
        accentMuted: "#0ca68a",
        accentDark: "#082f28",
        luxuryPurple: "#0df2c9", // teal accent for highlights
        luxuryPink: "#ec4899", // pink gradient highlight (keep for compatibility or avatars)
        slateDark: "#05070a"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"]
      },
      animation: {
        "fade-in-up": "fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease infinite"
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        },
        glowPulse: {
          "0%, 100%": { opacity: 0.4 },
          "50%": { opacity: 0.8 }
        },
        gradientShift: {
          "0%, 100%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" }
        }
      }
    }
  },
  plugins: []
};
