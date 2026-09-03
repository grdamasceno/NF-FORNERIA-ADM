import type { Config } from 'tailwindcss'

// Paleta e tokens extraídos do layout de referência
// `MVP_Faturamento_Franquias_OnChannel (1).html` (:root do <style>).
// Manter esses valores em sincronia com o HTML caso o design de referência mude.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        orange: { DEFAULT: '#E94E1B', soft: '#FDEEE8', 600: '#cf4316' },
        navy: { DEFAULT: '#1B2A3C', 2: '#26384e' },
        ink: '#1B2A3C',
        muted: '#6B7787',
        faint: '#9aa6b4',
        line: '#EAEDF1',
        bg: '#F4F6F9',
        card: '#FFFFFF',
        green: { DEFAULT: '#1FA971', soft: '#E5F6EF' },
        amber: { DEFAULT: '#E0A100', soft: '#FBF2DA' },
        red: { DEFAULT: '#E0413B', soft: '#FCE9E8' },
        blue: { DEFAULT: '#2D6BE3', soft: '#E7EFFD' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        // Sombra pequena e cinza, sem o spread grande de antes — o
        // contorno da superfície fica a cargo da borda (`border-line`),
        // não da sombra (2026-09-03, pedido do usuário).
        //
        // NUNCA nomear essa chave "card": colide com `colors.card` acima e
        // o Tailwind interpreta "shadow-card" como as duas coisas ao mesmo
        // tempo (tamanho da sombra E "shadow-{color}" usando a cor "card",
        // branca) — a sombra branca "vencia" e virava o halo borrado branco
        // que o usuário reclamou desde o início (achado real, 2026-09-03).
        panel: '0 2px 6px rgba(15,23,42,.07)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise .5s cubic-bezier(.2,.7,.3,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
