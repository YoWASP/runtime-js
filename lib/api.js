import fetch from './fetch.js';
import { Exit, Environment, directoryFromTree, directoryIntoTree } from './wasi-virt.js';
import { lineBuffered } from './util.js';

export { Exit } from './wasi-virt.js';

export class Application {
    #resourceModule;
    #resourceData;
    #instantiate;
    #argv0;

    constructor(resourceModule, instantiate, argv0) {
        this.#resourceModule = resourceModule;
        this.#resourceData = null;
        this.#instantiate = instantiate;
        this.#argv0 = argv0;
    }

    get argv0() {
        return this.#argv0;
    }

    async #fetchResources(fetchProgress) {
        const resourceModule = await this.#resourceModule;
        let fetchFn = fetch;
        if (fetchProgress !== undefined) {
            const status = { source: this, totalLength: resourceModule.totalSize, doneLength: 0 };
            fetchProgress(status);
            fetchFn = (input, init) => fetch(input, init).then((response) => {
                return new Response(response.body.pipeThrough(new TransformStream({
                    transform(chunk, controller) {
                        controller.enqueue(chunk);
                        status.doneLength += chunk.length;
                        fetchProgress(status);
                    }
                })), response);
            });
        }
        const [modules, filesystem] = await Promise.all([
            resourceModule.modules(fetchFn),
            resourceModule.filesystem(fetchFn),
        ]);
        this.#resourceData = { modules, filesystem };
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
            return this.#fetchResources(options.fetchProgress ?? defaultFetchProgress).then(() => {
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
