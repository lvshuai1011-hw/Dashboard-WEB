import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// 从已提交的版本打包，确保移植包能追溯到对应提交。
const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
  encoding: 'utf8',
});
if (changes.trim()) throw new Error('Commit the source changes before packaging.');
mkdirSync('delivery', { recursive: true });
execFileSync(
  'git',
  [
    'archive',
    '--format=zip',
    '--output=delivery/aiAgent-source.zip',
    'HEAD',
    'src',
    'public',
    'stub',
    'tests',
    'scripts',
    'docs',
    'README.md',
    'package.json',
    'package-lock.json',
    'index.html',
    'vite.config.js',
    'tsconfig.json',
    '.prettierrc.json',
    '.prettierignore',
    '.gitignore',
  ],
  { stdio: 'inherit' },
);
console.log('Created delivery/aiAgent-source.zip from HEAD.');
