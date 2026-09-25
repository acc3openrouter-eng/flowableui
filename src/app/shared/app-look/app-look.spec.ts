import {
  APP_ICONS,
  DEFAULT_APP_ICON,
  PICKER_ICONS,
  appIconClass,
  appThemeBackground,
} from './app-look';

describe('app look', () => {
  it('maps stored glyphicon names to pi icons', () => {
    expect(appIconClass('glyphicon-briefcase')).toBe('pi pi-briefcase');
    expect(appIconClass('glyphicon-unknown')).toBe('pi pi-th-large');
    expect(appIconClass(null)).toBe('pi pi-th-large');
  });

  it('keeps every original icon and offers each pi icon once in the picker', () => {
    expect(APP_ICONS).toContain(DEFAULT_APP_ICON);
    const classes = PICKER_ICONS.map(appIconClass);
    expect(new Set(classes).size).toBe(classes.length);
    expect(new Set(APP_ICONS.map(appIconClass)).size).toBe(classes.length);
  });

  it('falls back to the first theme', () => {
    expect(appThemeBackground('theme-5')).toContain('#a78bfa');
    expect(appThemeBackground('nope')).toBe(appThemeBackground('theme-1'));
  });
});
