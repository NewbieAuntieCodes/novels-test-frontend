

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1];
    // GitHub Pages serves this app under "/<repo>/". When building in Actions, use the repo name as base.
    const base = repoName ? `/${repoName}/` : '/';
    return {
      base,
      resolve: {
        alias: {
          '@': path.resolve(currentDir, '.'),
        }
      }
    };
});
