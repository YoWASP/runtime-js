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
    constructor(resources, instantiate, argv0) {
        this.resources = resources;
        this.resourceData = null;
        this.instantiate = instantiate;
        this.argv0 = argv0;
    }

    async preload() {
        if (this.resourceData === null)
            this.resourceData = await this.resources().then(fetchResources);
    }

    // The `printLine` option is deprecated and not documented but still accepted for compatibility.
    execute(args, files = {}, { stdout, stderr, decodeASCII = true, printLine } = {}) {
        const environment = new Environment();
        environment.args = [this.argv0].concat(args);
        environment.root = directoryFromTree(files);
        for (const [dirName, dirContents] of Object.entries(this.resourceData.filesystem))
            environment.root.files[dirName] = directoryFromTree(dirContents);
        const lineBufferedConsole = lineBuffered(printLine ?? console.log);
        environment.stdout = stdout === undefined ? lineBufferedConsole : stdout;
        environment.stderr = stderr === undefined ? lineBufferedConsole : stderr;

        const wasmCommand = this.instantiate(
            (filename) => this.resourceData.modules[filename],
            { runtime: environment.exports },
            // workaround for bytecodealliance/jco#374
            (module, imports) => new WebAssembly.Instance(module, imports));
        let error = null;
        try {
            wasmCommand.run.run();
        } catch (e) {
            if (!(e instanceof Exit))
                throw e;
            if (e instanceof Exit && e.code !== 0)
                error = e;
        }

        for (const dirName of Object.keys(this.resourceData.filesystem))
            delete environment.root.files[dirName];
        files = directoryIntoTree(environment.root, { decodeASCII });
        if (error !== null) {
            error.files = files;
            throw error;
        } else {
            return files;
        }
    }

    run(args = null, files = {}, options = {}) {
        if (this.resourceData === null)
            return this.preload().then(_ => this.run(args, files, options));

        if (args === null)
            return; // prefetch resources, but do not actually run

        return this.execute(args, files, options);
    }
}
