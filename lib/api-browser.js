import { BaseApplication } from './api-base.js';

export { Exit } from './api-base.js';

export class Application extends BaseApplication {
    constructor(baseURL, resourceFilenames, wasmFilenames, instantiate, argv0) {
        async function getResources() {
            const resources = {};
            for (const [dirName, jsonFilename] of Object.entries(resourceFilenames))
                resources[dirName] = await fetch(new URL(jsonFilename, baseURL)).then((resp) => resp.json());
            return resources;
        }

        const wasmModules = {};
        for (const [modName, wasmFilename] of Object.entries(wasmFilenames))
            wasmModules[modName] = fetch(new URL(wasmFilename, baseURL)).then(WebAssembly.compileStreaming);

        super(getResources, wasmModules, instantiate, argv0);
    }
}
