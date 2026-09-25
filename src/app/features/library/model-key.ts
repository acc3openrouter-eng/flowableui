/** Suggests a model key from its name: letters, digits, `-` and `_`, starting with a letter or `_` (a valid NCName). */
export function suggestKey(name: string): string {
  const key = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+(.)?/g, (_match, next: string | undefined) =>
      next ? next.toUpperCase() : '',
    )
    .replace(/^[^A-Za-z_]+/, '');
  return key.charAt(0).toLowerCase() + key.slice(1);
}

export const MODEL_KEY_PATTERN = /^[A-Za-z_][\w.-]*$/;
