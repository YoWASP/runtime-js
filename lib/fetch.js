// Node v18.x doesn't have a usable `fetch()`.
let fetch;
if (typeof process === 'object' && typeof process.release === 'object' && process.release.name === 'node') {
    fetch = async function(url) {
        const { readFile } = await import('fs/promises');
        let contentType = 'application/octet-stream';
        if (url.pathname.endsWith('.wasm'))
            contentType = 'application/wasm';
        return new Response(await readFile(url), { headers: { "Content-Type": contentType } });
    };
} else {
    fetch = globalThis.fetch;
}

export default fetch;
