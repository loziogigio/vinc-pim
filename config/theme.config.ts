export const THEME_CONFIG = {
  colors: {
    primary: {
      main: "#f97316",
      hover: "#ea580c",
      light: "#ffedd5",
      dark: "#c2410c"
    },
    secondary: {
      main: "#0f172a",
      hover: "#1e293b",
      light: "#e2e8f0",
      dark: "#020617"
    },
    neutral: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5f5",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a"
    }
  },
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem"
  },
  shadows: {
    sm: "0 1px 2px rgba(15, 23, 42, 0.08)",
    md: "0 10px 30px rgba(15, 23, 42, 0.12)",
    lg: "0 20px 45px rgba(15, 23, 42, 0.16)"
  },
  typography: {
    fonts: {
      sans: "Inter, system-ui, sans-serif",
      display: "Poppins, system-ui, sans-serif",
      mono: "Menlo, Consolas, monospace"
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },
  layout: {
    maxWidth: "1280px",
    gutter: {
      mobile: "1rem",
      desktop: "2.5rem"
    },
    sectionSpacing: {
      compact: "3rem",
      default: "5rem",
      relaxed: "7rem"
    }
  }
};

export type ThemeConfig = typeof THEME_CONFIG;
