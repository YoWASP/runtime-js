export type Tree = {
    [name: string]: Tree | string | Uint8Array
};

export class Exit extends Error {
    code: number;
    files: Tree;
}

export class Application {
    constructor(resourceFileURL: URL | string, instantiate: any, argv0: string);

    run(args: string[], files: Tree, options: {
        printLine: (line: string) => void,
        decodeASCII: boolean
    }): Promise<Tree>;
}
