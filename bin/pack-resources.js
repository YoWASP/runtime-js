#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises';

function isASCII(buffer) {
    for (const byte of buffer)
        if ((byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) || byte >= 0x7f) {
            console.log(byte);
            return false;
        }
    return true;
}

async function packDirectory(root) {
    const files =  await readdir(root, { withFileTypes: true });
    const packedData = ['{'];
    for (const file of files) {
        packedData.push(`'${file.name}':`);
        const filePath = `${root}/${file.name}`;
        if (file.isDirectory()) {
            packedData.push(await packDirectory(filePath));
        } else if (file.isFile()) {
            const fileData = await readFile(filePath);
            if (isASCII(fileData)) {
                packedData.push(JSON.stringify(fileData.toString('utf-8')));
            } else {
                packedData.push(`decode(${JSON.stringify(Buffer.from(fileData).toString('base64'))})`);
            }
        } else {
            packedData.push('null');
        }
        packedData.push(',');
    }
    packedData.push('}');
    return packedData;
}

const args = process.argv.slice(2);
if (args.length !== 2) {
    console.error(`Usage: yowasp-pack-resources <directory> <file.js>`);
    process.exit(1);
}

await writeFile(args[1], `\
let decode;
if (typeof atob !== 'undefined')
    decode = (encoded) => Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)); // browser
else
    decode = (encoded) => Buffer.from(encoded, 'base64'); // node

export default ${(await packDirectory(args[0])).flat(Infinity).join('')};
`);
