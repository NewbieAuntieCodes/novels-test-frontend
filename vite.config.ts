

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    return {
      resolve: {
        alias: {
          '@': path.resolve(currentDir, '.'),
        }
      }
    };
});