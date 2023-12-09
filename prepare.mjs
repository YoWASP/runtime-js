import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const revList = execFileSync('git', ['rev-list', 'HEAD'], {encoding: 'utf-8'}).split('\n');
const packageJSON = JSON.parse(readFileSync('package-in.json', {encoding: 'utf-8'}));
packageJSON.version = `1.0.${revList.length - 2}`;
if (!['true', '1', 'yes'].includes(process.env['RELEASE_BRANCH']))
    packageJSON.version += '-dev';
console.log(`version ${packageJSON.version}`);
writeFileSync('package.json', JSON.stringify(packageJSON));
