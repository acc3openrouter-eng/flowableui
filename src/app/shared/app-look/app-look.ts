/**
 * App definitions store Glyphicons names (`glyphicon-asterisk`) and theme ids (`theme-1` to
 * `theme-10`), as the original Modeler and the Flowable Task app expect. These tables map them to
 * the icons and colors this app shows, without changing what is saved.
 */

/** Every icon the original app editor offered, in its order, with the closest `pi` icon. */
const GLYPH_TO_PI: Record<string, string> = {
  asterisk: 'pi-asterisk',
  plus: 'pi-plus',
  euro: 'pi-euro',
  cloud: 'pi-cloud',
  envelope: 'pi-envelope',
  pencil: 'pi-pencil',
  glass: 'pi-filter',
  music: 'pi-volume-up',
  search: 'pi-search',
  heart: 'pi-heart',
  star: 'pi-star',
  'star-empty': 'pi-star',
  user: 'pi-user',
  film: 'pi-video',
  'th-large': 'pi-th-large',
  th: 'pi-th-large',
  'th-list': 'pi-list',
  ok: 'pi-check',
  remove: 'pi-times',
  'zoom-in': 'pi-search-plus',
  'zoom-out': 'pi-search-minus',
  off: 'pi-power-off',
  signal: 'pi-wifi',
  cog: 'pi-cog',
  trash: 'pi-trash',
  home: 'pi-home',
  file: 'pi-file',
  time: 'pi-clock',
  road: 'pi-directions',
  'download-alt': 'pi-download',
  download: 'pi-download',
  upload: 'pi-upload',
  inbox: 'pi-inbox',
  'play-circle': 'pi-play-circle',
  repeat: 'pi-replay',
  refresh: 'pi-refresh',
  'list-alt': 'pi-list',
  lock: 'pi-lock',
  flag: 'pi-flag',
  headphones: 'pi-headphones',
  'volume-up': 'pi-volume-up',
  tag: 'pi-tag',
  tags: 'pi-tags',
  book: 'pi-book',
  bookmark: 'pi-bookmark',
  print: 'pi-print',
  camera: 'pi-camera',
  list: 'pi-list',
  'facetime-video': 'pi-video',
  picture: 'pi-image',
  'map-marker': 'pi-map-marker',
  adjust: 'pi-circle-fill',
  tint: 'pi-palette',
  edit: 'pi-pen-to-square',
  share: 'pi-share-alt',
  check: 'pi-check-square',
  move: 'pi-arrows-alt',
  play: 'pi-play',
  eject: 'pi-eject',
  'plus-sign': 'pi-plus-circle',
  'minus-sign': 'pi-minus-circle',
  'remove-sign': 'pi-times-circle',
  'ok-sign': 'pi-check-circle',
  'question-sign': 'pi-question-circle',
  'info-sign': 'pi-info-circle',
  screenshot: 'pi-bullseye',
  'remove-circle': 'pi-times-circle',
  'ok-circle': 'pi-check-circle',
  'ban-circle': 'pi-ban',
  'share-alt': 'pi-share-alt',
  'exclamation-sign': 'pi-exclamation-circle',
  gift: 'pi-gift',
  leaf: 'pi-sun',
  fire: 'pi-bolt',
  'eye-open': 'pi-eye',
  'eye-close': 'pi-eye-slash',
  'warning-sign': 'pi-exclamation-triangle',
  plane: 'pi-send',
  calendar: 'pi-calendar',
  random: 'pi-sync',
  comment: 'pi-comment',
  magnet: 'pi-paperclip',
  retweet: 'pi-refresh',
  'shopping-cart': 'pi-shopping-cart',
  'folder-close': 'pi-folder',
  'folder-open': 'pi-folder-open',
  hdd: 'pi-server',
  bullhorn: 'pi-megaphone',
  bell: 'pi-bell',
  certificate: 'pi-verified',
  'thumbs-up': 'pi-thumbs-up',
  'thumbs-down': 'pi-thumbs-down',
  'hand-left': 'pi-arrow-left',
  globe: 'pi-globe',
  wrench: 'pi-wrench',
  tasks: 'pi-list-check',
  filter: 'pi-filter',
  briefcase: 'pi-briefcase',
  dashboard: 'pi-gauge',
  paperclip: 'pi-paperclip',
  'heart-empty': 'pi-heart',
  link: 'pi-link',
  phone: 'pi-mobile',
  pushpin: 'pi-thumbtack',
  usd: 'pi-dollar',
  gbp: 'pi-pound',
  sort: 'pi-sort',
  flash: 'pi-bolt',
  record: 'pi-circle',
  save: 'pi-save',
  open: 'pi-folder-open',
  saved: 'pi-check',
  send: 'pi-send',
  'floppy-disk': 'pi-save',
  'credit-card': 'pi-credit-card',
  cutlery: 'pi-shop',
  earphone: 'pi-phone',
  'phone-alt': 'pi-phone',
  tower: 'pi-building',
  stats: 'pi-chart-bar',
  'cloud-download': 'pi-cloud-download',
  'cloud-upload': 'pi-cloud-upload',
  'tree-conifer': 'pi-sun',
  'tree-deciduous': 'pi-sun',
};

export const APP_ICONS = Object.keys(GLYPH_TO_PI).map((glyph) => `glyphicon-${glyph}`);

/** Icons for the picker: one per distinct `pi` icon, so no two choices look the same. */
export const PICKER_ICONS = APP_ICONS.filter(
  (icon, index) =>
    APP_ICONS.findIndex((other) => appIconClass(other) === appIconClass(icon)) === index,
);

export const DEFAULT_APP_ICON = 'glyphicon-asterisk';
export const DEFAULT_APP_THEME = 'theme-1';

/** `pi pi-...` class for a stored icon name. */
export function appIconClass(icon: string | null | undefined): string {
  const glyph = (icon ?? '').replace(/^glyphicon-/, '');
  return `pi ${GLYPH_TO_PI[glyph] ?? 'pi-th-large'}`;
}

/** Gradient stops for `theme-1` to `theme-10`. */
export const APP_THEMES: { id: string; from: string; to: string }[] = [
  { id: 'theme-1', from: '#4c9ad8', to: '#1d5f94' },
  { id: 'theme-2', from: '#34d399', to: '#047857' },
  { id: 'theme-3', from: '#fbbf24', to: '#b45309' },
  { id: 'theme-4', from: '#f87171', to: '#b91c1c' },
  { id: 'theme-5', from: '#a78bfa', to: '#6d28d9' },
  { id: 'theme-6', from: '#94a3b8', to: '#334155' },
  { id: 'theme-7', from: '#f472b6', to: '#be185d' },
  { id: 'theme-8', from: '#2dd4bf', to: '#0f766e' },
  { id: 'theme-9', from: '#fb923c', to: '#c2410c' },
  { id: 'theme-10', from: '#818cf8', to: '#4338ca' },
];

export function appThemeBackground(theme: string | null | undefined): string {
  const t = APP_THEMES.find((x) => x.id === theme) ?? APP_THEMES[0];
  return `linear-gradient(135deg, ${t.from}, ${t.to})`;
}
