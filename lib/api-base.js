import { Exit, Environment, directoryFromTree, directoryIntoTree } from './wasi-virt.js';

export { Exit } from './wasi-virt.js';

export class BaseApplication {
    constructor(getResources, wasmModules, instantiate, argv0) {
        this._resources = null;
        this.getResources = getResources;
        this.wasmModules = wasmModules;
        this.instantiate = instantiate;
        this.argv0 = argv0;
    }

    async run(args, files = {}, printLine = console.log) {
        if (this._resources === null)
            this._resources = await this.getResources();

        const environment = new Environment();
        environment.args = [this.argv0].concat(args);
        environment.root = directoryFromTree(files);
        for (const [dirName, resourceFiles] of Object.entries(this._resources))
            environment.root.files[dirName] = directoryFromTree(resourceFiles);
        environment.printLine = printLine;

        const wasmCommand = await this.instantiate(
            (filename) => this.wasmModules[filename],
            { runtime: environment.exports });
        try {
            wasmCommand.run.run();
        } catch (e) {
            if (!(e instanceof Exit && e.code === 0))
                throw e;
        }

        for (const dirName of Object.keys(this._resources))
            delete environment.root.files[dirName];
        return directoryIntoTree(environment.root);
    }
}
