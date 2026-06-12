import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Charte Assemblage Ingénierie (design PEEB Jordan)
        assemblage: "#E8201A",
        sidebar: "#1C1C2E",
        fond: "#F2F2F2",
      },
    },
  },
  plugins: [],
};

export default config;
