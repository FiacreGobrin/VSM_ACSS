/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1600px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          glow: 'hsl(var(--primary) / 0.25)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
          border: 'hsl(var(--card-border))',
        },
        panel: {
          DEFAULT: 'hsl(var(--panel))',
          header: 'hsl(var(--panel-header))',
          subtle: 'hsl(var(--panel-subtle))',
        },
        // Dedicated Security & Hardware Status Tokens
        status: {
          online: '#10b981',
          offline: '#64748b',
          warning: '#f59e0b',
          alarm: '#ef4444',
          idle: '#3b82f6',
        },
        vlan: {
          10: '#06b6d4', // Cameras
          20: '#8b5cf6', // Access Control / Doors
          30: '#ec4899', // Otis Elevators
          40: '#f97316', // Dell Compute & SAN
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'SFMono-Regular',
          'Consolas',
          'Courier New',
          'monospace'
        ],
      },
      boxShadow: {
        'glow-primary': '0 0 20px -5px hsl(var(--primary) / 0.35)',
        'glow-destructive': '0 0 20px -5px hsl(var(--destructive) / 0.45)',
        'panel': '0 8px 30px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'border-pulse': {
          '0%, 100%': { borderColor: 'hsl(var(--primary))' },
          '50%': { borderColor: 'transparent' },
        }
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radar-sweep 4s linear infinite',
      }
    },
  },
  plugins: [],
};
