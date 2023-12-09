import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const revCount = execFileSync('git', ['rev-list', 'HEAD'], {encoding: 'utf-8'}).split('\n').length - 1;

let version = `3.0.${revCount - 1}`;
if (!['true', '1', 'yes'].includes(process.env['RELEASE_BRANCH']))
    version += '-dev';
console.log(`version ${version}`);

const packageJSON = JSON.parse(readFileSync('package-in.json', {encoding: 'utf-8'}));
packageJSON.version = version;
writeFileSync('package.json', JSON.stringify(packageJSON));
