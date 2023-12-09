import { readFile } from 'fs/promises';
import { BaseApplication } from './api-base.js';

export { Exit } from './api-base.js';

export class Application extends BaseApplication {
    constructor(baseURL, resourceFilenames, wasmFilenames, instantiate, argv0) {
        async function getResources() {
            const resources = {};
            for (const [dirName, jsonFilename] of Object.entries(resourceFilenames))
                resources[dirName] = JSON.parse(await readFile(new URL(jsonFilename, baseURL)));
            return resources;
        }

        const wasmModules = {};
        for (const [modName, wasmFilename] of Object.entries(wasmFilenames))
            wasmModules[modName] = readFile(new URL(wasmFilename, baseURL)).then(WebAssembly.compile);

        super(getResources, wasmModules, instantiate, argv0);
    }
}
