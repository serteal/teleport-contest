/* rng.c: a deterministic rn2 for the differential test */
#include "fixture.h"

static unsigned rngstate = 12345;

int
rn2(int x)
{
    rngstate = rngstate * 1103515245u + 12345u;
    return (int) ((rngstate >> 8) % (unsigned) x);
}
