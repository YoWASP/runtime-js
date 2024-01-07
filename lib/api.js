import fetch from './fetch.js';
import { Exit, Environment, directoryFromTree, directoryIntoTree } from './wasi-virt.js';
import { lineBuffered } from './util.js';

export { Exit } from './wasi-virt.js';

async function fetchObject(obj, fetchFn) {
    // Mutate the object being fetched, to avoid re-fetches within the same session.
    // Do this in parallel to avoid head-of-line blocking.
    const promises = [];
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string" || value instanceof Uint8Array) {
            promises.push(Promise.resolve([key, value]));
        } else if (value instanceof URL) {
            promises.push(fetchFn(value).then((fetched) => [key, fetched]));
        } else {
            promises.push(fetchObject(value, fetchFn).then((fetched) => [key, fetched]));
        }
    }
    for (const [key, value] of await Promise.all(promises))
        obj[key] = value;
    return obj;
}

function fetchWebAssembly(url) {
    return fetch(url).then(WebAssembly.compileStreaming);
}

function fetchUint8Array(url) {
    return fetch(url).then((resp) => resp.arrayBuffer()).then((buf) => new Uint8Array(buf));
}

function fetchResources({ modules, filesystem }) {
    return Promise.all([
        fetchObject(modules, fetchWebAssembly),
        fetchObject(filesystem, fetchUint8Array)
    ]).then(([modules, filesystem]) => {
        return { modules, filesystem };
    });
}

export class Application {
    constructor(resourceFileURL, instantiate, argv0) {
        this.resourceFileURL = resourceFileURL;
        this.resources = null;
        this.instantiate = instantiate;
        this.argv0 = argv0;
    }

    // The `printLine` option is deprecated and not documented but still accepted for compatibility.
    async run(args = null, files = {}, { stdout, stderr, decodeASCII = true, printLine } = {}) {
        if (this.resources === null)
            this.resources = await import(this.resourceFileURL).then(fetchResources);

        if (args === null)
            return; // prefetch resources, but do not run

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
}
