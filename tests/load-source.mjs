import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** Compile the actual TS modules for Node tests without maintaining a second implementation. */
export async function loadSource(contents, options = {}) {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    ...options,
  });
  const module = { exports: {} };
  new Function('module', outputFiles[0].text)(module);
  return module.exports;
}
