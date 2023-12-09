YoWASP JavaScript runtime
=========================

This package is an internal support package for the [YoWASP project][yowasp]. It handles interfacing with the [WebAssembly][] runtime and the supported execution environments (Node.js and the browser). Do not depend on this package in your own code.

[webassembly]: https://webassembly.org/
[yowasp]: https://yowasp.github.io/


API reference
-------------

All of the other JavaScript YoWASP packages re-export the API of the package. They export the function `runX` where `X` is the name of the application, which can be called as:

```js
const filesOut = await runX(args, filesIn, { printLine: console.log, decodeASCII: true });
```

Arguments and return value:
- The `args` argument is an array of command line arguments, e.g. `['--version']`. The 0th argument (program name) is not provided, since it is fixed and determined by the application.
- The `filesIn` argument is an object associating filenames with contents, e.g. `{"inv.v": "module inv(input a, output o); assign o = ~a; endmodule"}`. The values can be strings or instances of [Uint8Array][] (which specify files), or, recursively, the same kind of object (which specifies a directory). The specified files and directories are placed in the root of the virtual filesystem.
- The `filesOut` return value is the same kind of object as `filesIn`, representing the state of the virtual filesystem after the application terminated. It contains all of the data provided in `filesIn` as well, unless these files were modified or removed by the application.

Options:
- The `printLine` option is a function called for each line of text the application prints to the terminal (i.e. standard output and standard error), without the terminating `'\n'` character. The text printed to standard output and standard error is combined as it is being printed (without buffering). The default is `printLine: console.log`.
- The `decodeASCII` option determines whether the values corresponding to files in `filesOut` are always instances of [Uint8Array][] (if `decodeASCII: false`), or whether the values corresponding to text files will be strings (if `decodeASCII: true`). A file is considered a text file if it contains only bytes in range `0x20` to `0x7f` inclusive. The default is `decodeASCII: true`.

[Uint8Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array


License
-------

This package is covered by the [ISC license](LICENSE.txt).
