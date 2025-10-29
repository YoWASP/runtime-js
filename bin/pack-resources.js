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

const filesystem = async (fetch) => {
    var chunks = [];
`;

function chunks(data, length) {
    var rest = data;
    var chunks = [];
    while(rest.length != 0) {
        chunks.push(rest.subarray(0, length));
        rest = rest.subarray(length);
    }
    return chunks;
}

if (shareDirectory !== undefined) {
    const tarEntries = [];
    async function archivePath(pathName) {
        const pathStat = await stat(pathName);
        const tarName = pathName.replace(`${shareDirectory}/`, '');
        if (pathStat.isDirectory()) {
            if (pathName !== shareDirectory)
                tarEntries.push({name: tarName});
            for (const name of await readdir(pathName))
                await archivePath(`${pathName}/${name}`);
        } else if (pathStat.isFile()) {
            tarEntries.push({name: tarName, data: await readFile(pathName)});
        } else {
            console.error(`Unsupported type of '${pathName}'!`);
            process.exit(2);
        }
    }
    await archivePath(shareDirectory);
    const tarData = createTar(tarEntries);
    var i = 0;
    for(const chunk of chunks(tarData, 50*1024*1024)) {
        const tarFileChunkPath = resourceFilePath.replace(/\.js$/, `.${i}.tar`);
        await writeFile(tarFileChunkPath, chunk);
        const tarFileChunkName = tarFileChunkPath.replace(/^.+\//, '');
        output += `\
    chunks.push(await ${await fetchExpr(tarFileChunkPath, `./${tarFileChunkName}`)}.then((resp) => resp.arrayBuffer()));
`
        i += 1;
    }
    output += `\
    return {
        ${JSON.stringify(shareRoot)}: await new Blob(chunks).arrayBuffer().then(unpackTarFilesystem)
    };
`;
}

output += `\
};

const totalSize = ${totalSize};

export { modules, filesystem, totalSize };
`;

await writeFile(resourceFilePath, output);
