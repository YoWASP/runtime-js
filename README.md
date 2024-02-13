YoWASP JavaScript runtime
=========================

This package is an internal support package for the [YoWASP project][yowasp]. It handles interfacing with the [WebAssembly][] runtime and the supported execution environments (Node.js and the browser). If you are writing code that is not part of the YoWASP project, you should only use functions from the `@yowasp/runtime/util` module.

[webassembly]: https://webassembly.org/
[yowasp]: https://yowasp.github.io/


Application API reference
-------------------------

All of the other JavaScript YoWASP packages use the common runtime functionality implemented here. They export the function `runX` where `X` is the name of the application, which can be called as:

```js
const filesOut = await runX(args, filesIn, { stdout, stderr, decodeASCII: true });
```

Arguments and return value:
- The `args` argument is an array of command line arguments, e.g. `['--version']`. The 0th argument (program name) is not provided, since it is fixed and determined by the application.
- The `filesIn` argument is an object associating filenames with contents, e.g. `{"inv.v": "module inv(input a, output o); assign o = ~a; endmodule"}`. The values can be strings or instances of [Uint8Array][] (which specify files), or, recursively, the same kind of object (which specifies a directory). The specified files and directories are placed in the root of the virtual filesystem.
- The `filesOut` return value is the same kind of object as `filesIn`, representing the state of the virtual filesystem after the application terminated. It contains all of the data provided in `filesIn` as well, unless these files were modified or removed by the application.

Options:
- The `stdout` and `stderr` options are functions that are called with a sequence of bytes the application prints to the standard output and standard error streams respectively, or `null` to indicate that the stream is being flushed. If specified as `null`, the output on that stream is ignored. By default, each line of text from the combined streams is printed to the debugging console.
- The `decodeASCII` option determines whether the values corresponding to files in `filesOut` are always instances of [Uint8Array][] (if `decodeASCII: false`), or whether the values corresponding to text files will be strings (if `decodeASCII: true`). A file is considered a text file if it contains only bytes `0x09`, `0x0a`, `0x0d`, or those in the range `0x20` to `0x7e` inclusive. The default is `decodeASCII: true`.

If the application returns a non-zero exit code, the exception `Exit` (exported alongside the `runX` function) is raised. This exception has two properties:
- The `code` property indicates the exit code. (Currently this is always 1 due to WebAssembly peculiarities.)
- The `files` property represents the state of the virtual filesystem after the application terminated. This property can be used to retrieve log files or other data aiding in diagnosing the error.

While in general the `runX` function returns a promise, there are two special cases. Calling `runX()` (with no arguments) does not run the application, but preloads and caches, in memory, all of the necessary resources. Calling `runX([...])` (with arguments) after that executes the application synchronously instead of returning a promise.

[Uint8Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array


Utility API reference
---------------------

This package also exports utilities that are useful when running other JavaScript YoWASP packages. These can be used as:

```js
import { lineBuffered } from '@yowasp/runtime/util';
```

- The `lineBuffered(processLine)` function takes a function `processLine(line)` that accepts a line of text (e.g. `console.log`), and returns a function `processBytes(bytes)` that accepts a `Uint8Array` of encoded characters. Each byte sequence ending in the `\n` byte, not including it, is decoded as UTF-8 (invalid sequences are substituted with a replacement character) and passed to `processLine()`.


License
-------

This package is covered by the [ISC license](LICENSE.txt).
