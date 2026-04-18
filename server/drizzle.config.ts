import { defineConfig } from 'drizzle-kit';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema:  './db/schema.ts',
  out:     './db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: resolve(__dirname, './data/ics.db'),
  },
});
