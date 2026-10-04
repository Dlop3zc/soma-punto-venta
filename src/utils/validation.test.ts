import { describe, test, expect } from 'vitest';
import { usernameToEmail, normalizeUsername, validateUsername, validatePassword } from './validation';

describe('usuarios', () => {
  test('el usuario no distingue mayúsculas ni espacios', () => {
    expect(normalizeUsername('  Mesero1 ')).toBe('mesero1');
    expect(usernameToEmail('Mesero1')).toBe(usernameToEmail('mesero1'));
  });

  test('se convierte en un correo interno', () => {
    expect(usernameToEmail('ana')).toMatch(/^ana@[a-z.-]+\.[a-z]+$/);
  });

  test.each(['ana', 'mesero1', 'juan.perez', 'cocina_2', 'barra-1'])('"%s" es válido', (u) => {
    expect(validateUsername(u)).toBeNull();
  });

  test.each(['ab', 'josé', 'con espacio', 'a@b', 'x'.repeat(31)])('"%s" no es válido', (u) => {
    expect(validateUsername(u)).not.toBeNull();
  });
});

describe('contraseñas', () => {
  test('mínimo 8 caracteres', () => {
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });
});
