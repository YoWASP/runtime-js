#!/usr/bin/env node

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { createTar } from 'nanotar';

async function packModules(root, urlRoot) {
    const files =  await readdir(root, { withFileTypes: true });
    const packedData = [`{\n`];
    for (const file of files) {
        if (file.isFile() && file.name.endsWith('.wasm')) {
            packedData.push(`    ${JSON.stringify(file.name)}: `);
            packedData.push(`new URL(${JSON.stringify(urlRoot + file.name)}, import.meta.url)`);
            packedData.push(`,\n`);
        }
    }
    packedData.push(`}`);
    return packedData;
}

async function collectDirectory(root, dirPath = '', packedData = []) {
    const files = await readdir(`${root}/${dirPath}`, { withFileTypes: true });
    for (const file of files) {
        const filePath = dirPath === '' ? file.name : `${dirPath}/${file.name}`;
        const fileStats = await stat(`${root}/${filePath}`);
        if (fileStats.isDirectory()) {
            packedData.push({name: filePath});
            await collectDirectory(root, filePath, packedData);
        } else if (fileStats.isFile()) {
            packedData.push({name: filePath, data: await readFile(`${root}/${filePath}`)});
        } else {
            console.error(`Unsupported '${filePath}'!`);
            process.exit(2);
        }
    }
    return packedData;
}

const args = process.argv.slice(2);
if (!(args.length >= 2 && args.length <= 4)) {
    console.error(`Usage: yowasp-pack-resources <resources.js> <gen-directory> [<share-directory>] [<share-root>]`);
    process.exit(1);
}

const resourceFilePath = args[0];
const genDirectory = args[1];
const shareDirectory = args[2];
const shareRoot = args[3] || 'share';

let output = `\
import { parseTar } from 'nanotar';

function unpackResources(url) {
    function defaultFetchFn(url) {
        return fetch(url).then((resp) => resp.arrayBuffer());
    }

    return async (fetchFn = defaultFetchFn) => {
        const root = {};
        for (const tarEntry of parseTar(await fetchFn(url))) {
            const nameParts = tarEntry.name.split('/');
            const dirNames = nameParts.slice(0, -1);
            const fileName = nameParts[nameParts.length - 1];
            let dir = root;
            for (const dirName of dirNames)
                dir = dir[dirName];
            if (tarEntry.type === 'directory') {
                dir[fileName] = {};
            } else {
                dir[fileName] = tarEntry.data;
            }
        }
        return root;
    };
}

`;
const moduleObject = (await packModules(genDirectory, './')).flat(Infinity).join('');
output += `export const modules = ${moduleObject};\n\n`;
if (shareDirectory) {
    const tarFilePath = resourceFilePath.replace(/\.js$/, '.tar');
    await writeFile(tarFilePath, createTar(await collectDirectory(shareDirectory)));
    const tarFileName = tarFilePath.replace(/^.+\//, '');
    const resourceObject = `unpackResources(new URL('./${tarFileName}', import.meta.url))`;
    output += `export const filesystem = {\n`;
    output += `    ${shareRoot}: ${resourceObject},\n`;
    output += `};\n`;
} else {
    output += `export const filesystem = {};\n`;
}
await writeFile(resourceFilePath, output);
