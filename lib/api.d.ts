export type Tree = {
    [name: string]: Tree | string | Uint8Array
};

export type OutputStream =
    (bytes: Uint8Array | null) => void;

export class Exit extends Error {
    code: number;
    files: Tree;
}

export class Application {
    constructor(resourceFileURL: URL | string, instantiate: any, argv0: string);

    run(args?: string[], files?: Tree, options?: {
        stdout?: OutputStream | null,
        stderr?: OutputStream | null,
        decodeASCII?: boolean
    }): Promise<Tree>;
}
