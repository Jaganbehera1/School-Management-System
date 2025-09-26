/** @type {import('tailwindcss').Config} */
export default {
  // 👀 This tells Tailwind where to look for class names
  content: [
    './index.html',                // root html
    './src/**/*.{js,ts,jsx,tsx}', // all React/TS files
  ],

  // 🎨 Extend or override default theme here
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',  // custom blue
        secondary: '#9333EA' // custom purple
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // example custom font
      },
    },
  },

  // 🔌 Plugins (forms, typography, etc.)
  plugins: [],
};
