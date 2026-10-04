import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Las fechas de la analítica dependen de la zona horaria: fijamos la del negocio
    env: { TZ: 'America/Mexico_City' },
  },
});
