import {loadFont} from '@remotion/google-fonts/Nunito';

export const {fontFamily: FONT} = loadFont('normal', {weights: ['700', '800', '900']});

// Tokens de marca (marketing/referencia-app/diseno/turnigo-tokens.css)
export const C = {
  teal50: '#E8F4F3',
  teal100: '#CFE6E3',
  teal200: '#9FCFC9',
  teal600: '#0B6E6A',
  teal700: '#095A57',
  teal800: '#07403E',
  coral: '#FF6B4A',
  coral50: '#FFEFEA',
  bg: '#F3F7F6',
  surface: '#FFFFFF',
  border: '#D9E4E2',
  text: '#0F2A2A',
  muted: '#4A6362',
  success: '#1F8A4C',
  warning: '#B7791F',
  danger: '#C0392B',
};

export const FPS = 30;
export const W = 1080;
export const H = 1920;
// Zona segura de TikTok: nada importante en los 150 px de arriba ni en los 380 de abajo.
export const SAFE_TOP = 150;
export const SAFE_BOTTOM = 380;
