/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          darkest: '#071f12',
          dark: '#0f3d24',
          main: '#1a5c38',
          mid: '#226b43',
          light: '#2d8a57',
          soft: '#3da66b',
          pale: '#c6e8d4',
          bg: '#0b2e1a',
          card: '#12452a',
          border: '#1e6840',
        }
      }
    },
  },
  plugins: [],
}
