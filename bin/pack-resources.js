#!/usr/bin/env node

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { createTar } from 'nanotar';

const args = process.argv.slice(2);
if (!(args.length >= 2 && args.length <= 4)) {
    console.error(`Usage: yowasp-pack-resources <resources.js> <wasm-directory> [<share-directory>] [<share-root>]`);
    process.exit(1);
}
const resourceFilePath = args[0];
const wasmDirectory = args[1];
const shareDirectory = args[2];
const shareRoot = args[3] || 'share';

let totalSize = 0;

async function fetchExpr(filePath, fileURL) {
    const fileStats = await stat(filePath);
    totalSize += fileStats.size;
    return `fetch(new URL(${JSON.stringify(fileURL)}, import.meta.url))`;
}

let output = `\
import { parseTar } from 'nanotar';

function compileWasmModule(response) {
    if (WebAssembly.compileStreaming !== undefined) {
        // Node.js does not have 'WebAssembly.{compile,instantiate}Streaming'.
        return WebAssembly.compileStreaming(response);
    } else {
        return WebAssembly.compile(response.arrayBuffer());
    }
}

function unpackTarFilesystem(buffer) {
    const root = {};
    for (const tarEntry of parseTar(buffer)) {
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
}

const modules = async (fetch) => ({
`;

for (const dirent of await readdir(wasmDirectory, { withFileTypes: true })) {
    if (dirent.isFile() && dirent.name.endsWith('.wasm')) {
        const filePath = `${dirent.parentPath}/${dirent.name}`;
        output += `\
    ${JSON.stringify(dirent.name)}: await ${await fetchExpr(filePath, `./${dirent.name}`)}
        .then(compileWasmModule),
`;
    }
}

output += `\
});

const filesystem = async (fetch) => ({
`;

if (shareDirectory !== undefined) {
    const tarEntries = [];
    for (const dirent of await readdir(shareDirectory, { withFileTypes: true, recursive: true })) {
        const name = `${dirent.parentPath}/${dirent.name}`.replace(`${shareDirectory}/`, '');
        if (dirent.isDirectory()) {
            tarEntries.push({name: name});
        } else if (dirent.isFile()) {
            tarEntries.push({name, data: await readFile(`${dirent.parentPath}/${dirent.name}`)});
        } else {
            console.error(`Unsupported type of '${dirent.name}'!`);
            process.exit(2);
        }
    }

    const tarData = createTar(tarEntries);
    const tarFilePath = resourceFilePath.replace(/\.js$/, '.tar');
    await writeFile(tarFilePath, tarData);

    const tarFileName = tarFilePath.replace(/^.+\//, '');
    output += `\
    ${JSON.stringify(shareRoot)}: await ${await fetchExpr(tarFilePath, `./${tarFileName}`)}
        .then((resp) => resp.arrayBuffer())
        .then(unpackTarFilesystem)
`;
}

output += `\
});

const totalSize = ${totalSize};

export { modules, filesystem, totalSize };
`;

await writeFile(resourceFilePath, output);
