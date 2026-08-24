/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0F1C',
        panel: '#111A2C',
        panel2: '#16223A',
        line: '#22314D',
        mist: '#8593AF',
        paper: '#EEF1F7',
        signal: '#2FE3C4',
        alert: '#F2A93B',
        critical: '#F0555C',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.4, transform: 'scale(0.85)' },
        },
        riseIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        ticker: 'ticker 32s linear infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'rise-in': 'riseIn 0.5s ease-out both',
      },
    },
  },
  plugins: [],
}