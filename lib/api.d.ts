export type Tree = {
    [name: string]: Tree | string | Uint8Array
};

export type InputStream =
    (byteLength: number) => Uint8Array | null;

export type OutputStream =
    (bytes: Uint8Array | null) => void;

export type RunOptions = {
    stdin?:  InputStream  | null;
    stdout?: OutputStream | null;
    stderr?: OutputStream | null;
    decodeASCII?: boolean;
    synchronously?: boolean;
};

export class Application {
    constructor(resources: () => Promise<any>, instantiate: any, argv0: string);

    run(args?: string[], files?: Tree, options?: RunOptions): Promise<Tree> | Tree | undefined;
}

export class Exit extends Error {
    code: number;
    files: Tree;
}
