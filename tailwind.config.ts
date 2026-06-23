import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        smooth: {
          orange: '#F26522',
          black: '#1A1A1A',
          gray: '#6B7280',
        },
      },
    },
  },
  plugins: [],
};

export default config;
