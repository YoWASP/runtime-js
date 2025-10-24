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
        } else if (value instanceof Function) {
            promises.push(await value(fetchFn).then((fetched) => [key, fetched]));
        } else {
            promises.push(fetchObject(value, fetchFn).then((fetched) => [key, fetched]));
        }
    }
    for (const [key, value] of await Promise.all(promises))
        obj[key] = value;
    return obj;
}

function fetchWebAssembly(url) {
    if (WebAssembly.compileStreaming !== undefined) {
        return fetch(url).then(WebAssembly.compileStreaming);
    } else {
        // Node doesn't have `{compile,instantiate}Streaming`.
        return fetch(url).then((resp) => resp.arrayBuffer()).then(WebAssembly.compile);
    }
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
    #resources;
    #resourceData;
    #instantiate;
    #argv0;

    constructor(resources, instantiate, argv0) {
        this.#resources = resources;
        this.#resourceData = null;
        this.#instantiate = instantiate;
        this.#argv0 = argv0;
    }

    // The `printLine` option is deprecated and not documented but still accepted for compatibility.
    run(args = null, files = {}, options = {}) {
        if (this.#resourceData === null) {
            if (options.synchronously)
                throw new Error("Cannot run application synchronously unless resources are " +
                                "prefetched first; use `await run()` to do so");

            return this.#resources()
                .then((resourceObject) => fetchResources(resourceObject))
                .then((resourceData) => {
                    this.#resourceData = resourceData;
                    return this.run(args, files, options);
                });
        }

        if (args === null)
            return; // prefetch resources, but do not actually run

        // meow. :3
        const environment = new Environment();
        environment.args = [this.#argv0].concat(args);
        environment.root = directoryFromTree(files);
        for (const [dirName, dirContents] of Object.entries(this.#resourceData.filesystem))
            environment.root.files[dirName] = directoryFromTree(dirContents);
        const lineBufferedConsole = lineBuffered(options.printLine ?? console.log);
        environment.stdin  = options.stdin  === undefined ? null : options.stdin;
        environment.stdout = options.stdout === undefined ? lineBufferedConsole : options.stdout;
        environment.stderr = options.stderr === undefined ? lineBufferedConsole : options.stderr;

        const runCommand = (wasmCommand) => {
            let error = null;
            try {
                wasmCommand.run.run();
            } catch (e) {
                if (!(e instanceof Exit))
                    throw e;
                if (e instanceof Exit && e.code !== 0)
                    error = e;
            }

            for (const dirName of Object.keys(this.#resourceData.filesystem))
                delete environment.root.files[dirName];
            files = directoryIntoTree(environment.root, { decodeASCII: options.decodeASCII ?? true });
            if (error !== null) {
                error.files = files;
                throw error;
            } else {
                return files;
            }
        };

        const getCoreModule = (filename) => this.#resourceData.modules[filename];
        const imports = { runtime: environment.exports };
        if (options.synchronously) {
            const instantiateCore = (module, imports) => new WebAssembly.Instance(module, imports);
            return runCommand(this.#instantiate(getCoreModule, imports, instantiateCore));
        } else {
            return this.#instantiate(getCoreModule, imports).then(runCommand);
        }
    }
}
