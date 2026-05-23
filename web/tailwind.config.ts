import fs from "node:fs";
import path from "node:path";
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

function resolveWebRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "app"))) {
    return cwd;
  }
  const nested = path.join(cwd, "web");
  if (fs.existsSync(path.join(nested, "app"))) {
    return nested;
  }
  return cwd;
}

const root = resolveWebRoot().replace(/\\/g, "/");

const config: Config = {
  darkMode: ["class"],
  content: [
    `${root}/app/**/*.{js,ts,jsx,tsx,mdx}`,
    `${root}/components/**/*.{js,ts,jsx,tsx,mdx}`,
    `${root}/pages/**/*.{js,ts,jsx,tsx,mdx}`,
    `${root}/lib/**/*.{js,ts,jsx,tsx,mdx}`,
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
        },
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "bg-card": "var(--bg-card)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "border-theme": "var(--border-color)",
        "accent-green": "var(--accent-green)",
        "accent-green-hover": "var(--accent-green-hover)",
        "accent-green-bright": "var(--accent-green-bright)",
        "sidebar-bg": "var(--sidebar-bg)",
        "card-bg": "var(--card-bg)",
        "header-bg": "var(--header-bg)",
        brand: {
          green: "var(--accent-green)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        chart: {
          green: "var(--accent-green)",
          blue: "var(--blue)",
          amber: "var(--gold)",
          red: "var(--red)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
