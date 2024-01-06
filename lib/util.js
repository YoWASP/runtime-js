export function lineBuffered(processLine) {
    let buffer = new Uint8Array();
    return (bytes) => {
        if (bytes === null)
            return; // ignore explicit flushes

        let newBuffer = new Uint8Array(buffer.length + bytes.length);
        newBuffer.set(buffer);
        newBuffer.set(bytes, buffer.length);
        buffer = newBuffer;

        let newlineAt = -1;
        while (true) {
            const nextNewlineAt = buffer.indexOf(10, newlineAt + 1);
            if (nextNewlineAt === -1)
                break;
            processLine(new TextDecoder().decode(buffer.subarray(newlineAt + 1, nextNewlineAt)));
            newlineAt = nextNewlineAt;
        }
        buffer = buffer.subarray(newlineAt + 1);
    };
}
