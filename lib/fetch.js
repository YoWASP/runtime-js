let fetch;
if (typeof process === 'object' && process.release?.name === 'node') {
    // Node doesn't have a usable `fetch()`.
    fetch = async function(url, options) {
        if (url.protocol === 'file:') {
            const { readFile } = await import('fs/promises');
            let contentType = 'application/octet-stream';
            if (url.pathname.endsWith('.wasm'))
                contentType = 'application/wasm';
            return new Response(await readFile(url), { headers: { "Content-Type": contentType } });
        } else {
            return globalThis.fetch(url, options);
        }
    };
} else {
    fetch = globalThis.fetch;
}

export default fetch;
