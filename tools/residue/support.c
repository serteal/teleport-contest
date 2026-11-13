/* support.c: the only C code of our own in the vendored C library module.
 *
 * Gives JS the addresses of the standard streams (data symbols cannot be
 * exported by name from a wasm2js build).  Nothing else lives here: the
 * module is otherwise unmodified Lua 5.4 and the Emscripten C library.
 */
#include <stdio.h>

FILE *
clib_stdstream(int fd)
{
    return fd == 0 ? stdin : fd == 1 ? stdout : stderr;
}
