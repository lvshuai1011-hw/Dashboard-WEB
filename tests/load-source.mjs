import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

/** 测试直接加载业务模块，避免维护两套解析逻辑。 */
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
