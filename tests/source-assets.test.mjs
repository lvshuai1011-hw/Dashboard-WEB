import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const excluded = new Set(['node_modules', '.git', '.openai', 'dist', 'delivery']);
async function checkDirectory(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, file.name);
    if (file.isDirectory() && !excluded.has(file.name)) await checkDirectory(name);
    if (!file.isFile() || !/\.(?:[cm]?[jt]sx?|vue|html|css|less|scss)$/i.test(name)) continue;
    const text = await readFile(name, 'utf8');
    // 只约束手写源码。独立 SVG 的坐标和构建器生成的资源编码属于图片格式。
    assert.doesNotMatch(text, /data:image\/[a-z+.-]+[;,]/i, name);
    assert.doesNotMatch(text, /["'`][Mm]\s*-?\d[\d\s.,-]*[a-zA-Z]\s*-?\d/, name);
    assert.doesNotMatch(text, /<path\b[^>]*\bd\s*=\s*["'][Mm]\s*[-.\d]/i, name);
  }
}
test('源码通过资源文件引用静态图形', () => checkDirectory(root));
