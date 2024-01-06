import { Exit, Environment, directoryFromTree, directoryIntoTree } from './wasi-virt.js';
import { lineBuffered } from './util.js';

export { Exit } from './wasi-virt.js';

export class BaseApplication {
    constructor(resourceFileURL, instantiate, argv0) {
        this.resourceFileURL = resourceFileURL;
        this.resources = null;
        this.instantiate = instantiate;
        this.argv0 = argv0;
    }

    // The `printLine` option is deprecated and not documented but still accepted for compatibility.
    async run(args = null, files = {}, { stdout, stderr, decodeASCII = true, printLine } = {}) {
        if (this.resources === null)
            this.resources = await this._fetchResources();

        if (args === null)
            return; // only fetch resources

        const environment = new Environment();
        environment.args = [this.argv0].concat(args);
        environment.root = directoryFromTree(files);
        for (const [dirName, dirContents] of Object.entries(this.resources.filesystem))
            environment.root.files[dirName] = directoryFromTree(dirContents);
        const lineBufferedConsole = lineBuffered(printLine ?? console.log);
        environment.stdout = stdout === undefined ? lineBufferedConsole : stdout;
        environment.stderr = stderr === undefined ? lineBufferedConsole : stderr;

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
        const { modules, filesystem } = await import(this.resourceFileURL);
        return {
            modules: await this._fetchObject(modules, this._fetchWebAssembly),
            filesystem: await this._fetchObject(filesystem, this._fetchUint8Array),
        };
    }

    async _fetchObject(obj, fetchFn) {
        // Mutate the object being fetched, to avoid re-fetches within the same session.
        // Do this in parallel to avoid head-of-line blocking.
        const promises = [];
        for (const [key, value] of Object.entries(obj)) {
            if (value instanceof URL) {
                promises.push(fetchFn(value).then((fetched) => [key, fetched]));
            } else if (typeof value === "string" || value instanceof Uint8Array) {
                promises.push(Promise.resolve([key, value]));
            } else {
                promises.push(this._fetchObject(value, fetchFn).then((fetched) => [key, fetched]));
            }
        }
        for (const [key, value] of await Promise.all(promises))
            obj[key] = value;
        return obj;
    }

    async _fetchUint8Array(_url) {
        throw 'not implemented';
    }

    async _fetchWebAssembly(_url) {
        throw 'not implemented';
    }
}
