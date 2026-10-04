// El usuario escribe "mesero1"; Firebase Auth necesita un correo. Este dominio
// es interno: no se envían correos a estas direcciones.
const USERNAME_DOMAIN = 'usuarios.soma-pos.app';
export const usernameToEmail = (username: string) => `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
export const normalizeUsername = (username: string) => username.trim().toLowerCase();
export const MIN_PASSWORD_LENGTH = 8;

export function validateUsername(username: string): string | null {
  const u = normalizeUsername(username);
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) {
    return 'El usuario debe tener de 3 a 30 caracteres: letras sin acentos, números, punto, guion o guion bajo.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return null;
}
