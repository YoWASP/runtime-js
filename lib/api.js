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

function fetchWebAssembly(url, monitorProgress) {
    const response = fetch(url).then(monitorProgress);
    if (WebAssembly.compileStreaming !== undefined) {
        return response.then(WebAssembly.compileStreaming);
    } else {
        // Node doesn't have `{compile,instantiate}Streaming`.
        return response.then((resp) => resp.arrayBuffer()).then(WebAssembly.compile);
    }
}

function fetchUint8Array(url, monitorProgress) {
    const response = fetch(url).then(monitorProgress);
    return response.then((resp) => resp.arrayBuffer()).then((buf) => new Uint8Array(buf));
}

function fetchResources({ modules, filesystem }, fetchProgress, application) {
    /** @type {(response: Response) => Response} */
    let monitorProgress = (response) => response;
    if (fetchProgress !== undefined) {
        const progress = new Map();
        const notifyProgress = () => {
            let cumTotalLength = 0, cumDoneLength = 0;
            for (const { totalLength, doneLength } of progress.values()) {
                cumTotalLength += totalLength;
                cumDoneLength += doneLength;
            }
            fetchProgress({
                source: application,
                totalLength: cumTotalLength,
                doneLength: cumDoneLength
            });
        };
        monitorProgress = (response) => {
            let totalLength = +response.headers.get('content-length');
            let doneLength = 0;
            progress.set(response, { totalLength, doneLength });
            notifyProgress();
            /** @type {TransformStream<Uint8Array, Uint8Array>} */
            const monitorStream = new TransformStream({
                transform(chunk, controller) {
                    controller.enqueue(chunk);
                    doneLength += chunk.length;
                    progress.set(response, { totalLength, doneLength });
                    notifyProgress();
                }
            });
            return new Response(response.body.pipeThrough(monitorStream), response);
        };
    }
    return Promise.all([
        fetchObject(modules, (url) => fetchWebAssembly(url, monitorProgress)),
        fetchObject(filesystem, (url) => fetchUint8Array(url, monitorProgress))
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

    get argv0() {
        return this.#argv0;
    }

    // The `printLine` option is deprecated and not documented but still accepted for compatibility.
    run(args = null, files = {}, options = {}) {
        if (this.#resourceData === null) {
            if (options.synchronously)
                throw new Error("Cannot run application synchronously unless resources are " +
                                "prefetched first; use `await run()` to do so");

            /** @type {ProgressCallback} */
            const defaultFetchProgress = ({ source, totalLength, doneLength }) => {
                const percent = (100 * doneLength / totalLength).toFixed(0);
                console.log(`${source.argv0}: fetched ${percent}% (${doneLength} / ${totalLength})`);
            };
            const fetchProgress = options.fetchProgress ?? defaultFetchProgress;
            return this.#resources()
                .then((resourceObject) =>
                    fetchResources(resourceObject, fetchProgress, this))
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
