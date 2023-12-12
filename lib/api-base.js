import { Exit, Environment, directoryFromTree, directoryIntoTree } from './wasi-virt.js';

export { Exit } from './wasi-virt.js';

export class BaseApplication {
    constructor(resourceFileURL, instantiate, argv0) {
        this.resourceFileURL = resourceFileURL;
        this.resources = null;
        this.instantiate = instantiate;
        this.argv0 = argv0;
    }

    async run(args = null, files = {}, { printLine = console.log, decodeASCII = true } = {}) {
        if (this.resources === null)
            this.resources = await this._fetchResources();

        if (args === null)
            return; // only fetch resources

        const environment = new Environment();
        environment.args = [this.argv0].concat(args);
        environment.root = directoryFromTree(files);
        for (const [dirName, dirContents] of Object.entries(this.resources.filesystem))
            environment.root.files[dirName] = directoryFromTree(dirContents);
        environment.printLine = printLine;

        const wasmCommand = await this.instantiate(
            (filename) => this.resources.modules[filename],
            { runtime: environment.exports });
        let error = null;
        try {
            wasmCommand.run.run();
        } catch (e) {
            if (!(e instanceof Exit))
                throw e;
            if (e instanceof Exit && e.code !== 0)
                error = e;
        }

        for (const dirName of Object.keys(this.resources.filesystem))
            delete environment.root.files[dirName];
        files = directoryIntoTree(environment.root, { decodeASCII });
        if (error !== null) {
            error.files = files;
            throw error;
        } else {
            return files;
        }
    }

    async _fetchResources() {
        // Async import, to allow inlining some of the resources within resource file.
        console.log(`[YoWASP runtime] Fetching resource bundle ${this.resourceFileURL}`);
        const { modules, filesystem } = await import(this.resourceFileURL);
        return {
            modules: await this._fetchObject(modules, this._fetchWebAssembly),
            filesystem: await this._fetchObject(filesystem, this._fetchUint8Array),
        };
    }

    async _fetchObject(obj, fetchFn) {
        for (const [key, value] of Object.entries(obj)) {
            if (value instanceof URL) {
                console.log(`[YoWASP runtime] Fetching resource file ${value}`);
                obj[key] = await fetchFn(value);
            } else if (typeof value === "string" || value instanceof Uint8Array) {
                obj[key] = value;
            } else {
                obj[key] = await this._fetchObject(value, fetchFn);
            }
        }
        return obj;
    }

    async _fetchUint8Array(_url) {
        throw 'not implemented';
    }

    async _fetchWebAssembly(_url) {
        throw 'not implemented';
    }
}
