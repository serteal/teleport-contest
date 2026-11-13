/* arith.c: integer semantics (differential-tested against native C) */
#include "fixture.h"

int
divmod(int a, int b)
{
    if (b == 0)
        return 0;
    return a / b * 7 + a % b;
}

unsigned
uwrap(int a, int b)
{
    unsigned u = (unsigned) a;
    u -= (unsigned) b;
    u = u * 2654435761U;
    return u >> 3;
}

int
narrow(int a, int b)
{
    unsigned char c = (unsigned char) a;
    signed char s = (signed char) (a + b);
    boolean flag = (a & 0x100) != 0;
    short h = (short) (a * 1000);
    c += b;
    return c + s * 3 + flag + h;
}

long long
bits64(int a, int b)
{
    long long m = (long long) a << 20;
    long long f = m | W_ARMOR;
    f &= ~W_ARM;
    if (f & 0x80000000LL)
        f ^= 1;
    return f + (m >> 3) + b;
}

int
logic(int a, int b)
{
    int r = (a > b) && (b > 0);
    int s = a || b;
    return r * 10 + s + !a + (a < b ? 1 : 2);
}

int
loops(int a, int b)
{
    int i, t = 0;

    for (i = 0; i < (a & 15); i++) {
        if (i == b % 7)
            continue;
        t += i * max(i, 3);
        if (t > 1000)
            break;
    }
    while (t > 50)
        t -= 17;
    do {
        t++;
    } while (t % 5);
    return t;
}

int
gotos(int a, int b)
{
    int r = 0;

    if (a < 0)
        goto neg;
    if (b < 0) {
        r = 1;
        goto done;
    }
    r = 2;
 retry:
    r += 3;
    if (r < 20 && (a & 1))
        goto retry;
    goto done;
 neg:
    r = -1;
 done:
    return r + a % 3;
}

int
into_branch(int a, int b)
{
    int r = 0;

    switch (a & 3) {
    case 0:
        r = 10;
        if (b & 1)
            goto shared;
        break;
    case 1:
        r = 20;
        break;
    default:
        if (b > 100) {
            r = 30;
        } else {
 shared:
            r += 5;
        }
        break;
    }
    return r;
}

/* goto shapes the readable forms cannot express: a label reached from both sides, a goto
   into a loop body, a goto across case labels (lowered to the $goto dispatcher) */
int
gotomix(int a, int b)
{
    int r = 0, i = 0;

    if (a & 1)
        goto inside;
 again:
    r += 2;
    if (r > 40)
        goto out;
    for (i = 0; i < (b & 7); i++) {
        r += i;
 inside:
        r ^= 5;
        if (r & 16)
            goto again;
    }
    switch (a & 3) {
    case 0:
        if (b & 2)
            goto shared;
        r += 100;
        break;
    case 1:
        r -= 3;
 shared:
        r *= 2;
        break;
    default:
        break;
    }
 out:
    return r + i;
}

/* lspo_map's shape: a backward goto's region ends in the statement that also jumps forward
   past it; the forward break must leave the loop too */
int
gotoloop(int a, int b)
{
    int r = 0, tries = 0;

 redo:
    r += 1;
    if (a & 1)
        goto skip;
    if (r < 5) {
        if (b & 1) {
            tries++;
            if (tries < 3)
                goto redo;
            goto skip;
        }
    }
 skip:
    return r * 10 + tries;
}

/* a comparison / ! / !! as an index of an array of arrays */
int
boolidx(int a, int b)
{
    static const int t[2][2] = { { 1, 2 }, { 3, 4 } };

    return t[(a > b)][!!(a & 1)] + t[!b][a < 0];
}

/* an array of structs passed to a macro (the JS array itself) */
struct pv { int v; };
int
arrmacro(int a, int b)
{
    struct pv tab[3] = { { 5 }, { 6 }, { 7 } };

    return PICK(tab, (unsigned) a % 7).v + SIZE(tab) * b;
}

/* unsigned ^ / & / | results with bit 31 set */
int
ubits(int a, int b)
{
    unsigned x = (unsigned) a ^ (unsigned) ~b;
    unsigned y = (unsigned) a | 0x80000000u;
    unsigned z = (unsigned) a & (unsigned) b;

    z &= 0xFFFF0000u;
    return (int) (x % 11 + y % 13 + z % 17);
}

/* a goto into a block past a local array (storage must exist) */
int
gotoarr(int a, int b)
{
    if (a & 1)
        goto inside;
    {
        char buf[8];

        buf[1] = 1;
 inside:
        buf[2] = (char) (b & 7);
        return buf[2] + 1;
    }
}

/* an address-taken local with an initializer in a function the goto dispatcher handles
   (its storage is allocated at function start; the initializer runs at its line) */
static void
addto(int *p, int v)
{
    *p += v;
}

int
gotoinit(int a, int b)
{
    int r = 0;

    if (a & 1)
        goto inner;
    r = 5;
    {
 inner:
        r += 1;
    }
    {
        int pid = 7;

        addto(&pid, b & 15);
        r += pid;
    }
    return r;
}
