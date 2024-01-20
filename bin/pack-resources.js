#!/usr/bin/env node

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';

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

async function packDirectory(root, urlRoot, genRoot, dirPath = '', indent = 0) {
    const files =  await readdir(`${root}/${dirPath}`, { withFileTypes: true });
    const packedData = [`{\n`];
    for (const file of files) {
        packedData.push(`${'    '.repeat(indent + 1)}${JSON.stringify(file.name)}: `);
        const filePath = `${dirPath}/${file.name}`;
        if (file.isDirectory()) {
            packedData.push(await packDirectory(root, urlRoot, genRoot, filePath, indent + 1));
        } else if (file.isFile()) {
            const fileData = await readFile(`${root}/${filePath}`);
            let emittedAsText = false;
            if (fileData.length < 131072) { // emit as a separate file if >128K
                try {
                    const textData = new TextDecoder('utf-8', { fatal: true }).decode(fileData);
                    packedData.push(JSON.stringify(textData));
                    emittedAsText = true;
                } catch(e) {
                    if (e instanceof TypeError) {
                        emittedAsText = false;
                    } else {
                        throw e;
                    }
                }
            }
            if (!emittedAsText) {
                await mkdir(`${genRoot}/${urlRoot}/${dirPath}`, { recursive: true });
                await writeFile(`${genRoot}/${urlRoot}/${filePath}`, fileData);
                packedData.push(`new URL(${JSON.stringify(urlRoot + filePath)}, import.meta.url)`);
            }
        } else {
            packedData.push('null');
        }
        packedData.push(`,\n`);
    }
    packedData.push(`${'    '.repeat(indent)}}`);
    return packedData;
}

const args = process.argv.slice(2);
if (!(args.length >= 2 && args.length <= 3)) {
    console.error(`Usage: yowasp-pack-resources <resources.js> <gen-directory> [<share-directory>]`);
    process.exit(1);
}

const resourceFileName = args[0];
const genDirectory = args[1];
const shareDirectory = args[2];

let output =  `\
export const modules = ${(await packModules(genDirectory, './')).flat(Infinity).join('')};
`;
if (shareDirectory)
    output += `\
export const filesystem = {
    share: ${(await packDirectory(shareDirectory, './share', genDirectory, '', 1)).flat(Infinity).join('')}
};
`;
else
    output += `\
export const filesystem = {};
`;
await writeFile(resourceFileName, output);
