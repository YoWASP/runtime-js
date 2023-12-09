import { BaseApplication } from './api-base.js';

export { Exit } from './api-base.js';

export class Application extends BaseApplication {
    constructor(baseURL, resourceFilenames, wasmFilenames, instantiate) {
        async function getResources() {
            const resources = {};
            for (const [dirName, jsonFilename] of Object.entries(resourceFilenames))
                resources[dirName] = JSON.parse(await fetch(new URL(jsonFilename, baseURL)));
            return resources;
        }

        const wasmModules = {};
        for (const [modName, wasmFilename] of Object.entries(wasmFilenames))
            wasmModules[modName] = fetch(new URL(wasmFilename, baseURL)).then(WebAssembly.compileStreaming);

        super(getResources, wasmModules, instantiate);
    }
}
