import { readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync } from 'child_process';

const rootDir = resolve('src');
const files = [];

const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const entryStat = statSync(fullPath);

    if (entryStat.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entryStat.isFile() && fullPath.endsWith('.js')) {
      files.push(fullPath);
    }
  }
};

walk(rootDir);

for (const filePath of files) {
  execFileSync(process.execPath, ['--check', filePath], { stdio: 'inherit' });
}
