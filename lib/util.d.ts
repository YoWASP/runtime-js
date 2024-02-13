export function lineBuffered(processLine: (line: string) => void): (bytes: Uint8Array) => void;
export function chunked(text: string): (byteLength: number) => Uint8Array | null;
