/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#151c2a',
          950: '#090d16',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        surface: {
          base: '#0f172a',
          card: '#1e293b',
          elevated: '#273549',
          border: '#334155',
          borderSubtle: '#1e293b',
        }
      },
      fontFamily: {
        microgramma: ['"Microgramma Bold Extended"', '"Microgramma Bold"', 'Microgramma', '"Eurostile Extended"', 'Eurostile', 'Michroma', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Inter', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.6875rem',
      }
    },
  },
  plugins: [],
}
