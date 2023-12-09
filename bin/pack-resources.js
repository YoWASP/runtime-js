#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises';

async function packDirectory(root) {
    const files =  await readdir(root, { withFileTypes: true });
    const packedFiles = {};
    for (const file of files) {
        const filePath = `${root}/${file.name}`;
        if (file.isDirectory())
            packedFiles[file.name] = await packDirectory(filePath);
        if (file.isFile())
            packedFiles[file.name] = await readFile(filePath, {encoding: 'utf-8'});
    }
    return packedFiles;
}

const args = process.argv.slice(2);
if (args.length !== 2) {
    console.error(`Usage: yowasp-pack-resources <directory> <file.json>`);
    process.exit(1);
}

await writeFile(args[1], JSON.stringify(await packDirectory(args[0])));
