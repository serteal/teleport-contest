/* ptrs.c: memory-resident data (structs, out-parameters, strings) */
#include "fixture.h"

static int counter = 0;

static void
outparams(int a, int *quot, coordxy *small)
{
    *quot = a / 3;
    *small = (coordxy) a;
}

int
use_out(int a, int b)
{
    int q;
    coordxy s;

    outparams(a + b, &q, &s);
    counter++;
    return q * 100 + s;
}

int
strings(int a, int b)
{
    char buf[BUFSZ];
    char *p = buf;
    int n = 0;

    buf[2] = 'z';
    while (n < (a & 7)) {
        *p++ = 'a' + n;
        n++;
    }
    *p = '\0';
    for (p = buf; *p; p++)
        if (*p == 'c')
            *p = 'C';
    return buf[0] + buf[2] * 3 + (int) (p - buf) + b;
}

int
structs(int a, int b)
{
    struct thing t, u;
    struct thing *tp = &t;

    tp->size = a;
    tp->x = (coordxy) b;
    tp->counts[2] = a + b;
    tp->lit = 1;
    tp->kind = a;
    tp->next = &u;
    u = t;
    u.size += 1;
    return tp->next->size + u.counts[2] + u.kind + (is_big(tp) ? 100 : 0) + u.lit;
}
