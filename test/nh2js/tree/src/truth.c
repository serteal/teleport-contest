/* truth.c: C truth values (comparisons, !, && / ||, conversions to bool) are the ints 0 and 1
   wherever they are observed as numbers */
#include <stdio.h>
#include "fixture.h"

/* returned, then switched on (steal() -> switch in uhitm.c) */
static int
gives_up(int n)
{
    return !(n % 5 + 2 > 3);
}

/* returned, then used as an index (glow_strength() -> glow_verbs[]) */
static int
strength(int count)
{
    return (count > 12) ? 3 : (count > 4) ? 2 : (count > 0);
}

/* passed as a bool parameter, then used as an index (coord_desc -> dxdy_to_dist_descr) */
static int
dirname_of(int dx, _Bool fulldir)
{
    static const int names[2][2] = { { 10, 20 }, { 30, 40 } };

    return names[dx > 0][fulldir];
}

static int
same(int x, int y)
{
    return x == y;
}

int
truthret(int a, int b)
{
    static const int glow[4] = { 1, 2, 3, 4 };
    int r = 0;

    switch (gives_up(a & 31)) {
    case 0:
        r += 1;
        break;
    case 1:
        r += 2;
        break;
    default:
        r += 100;
        break;
    }
    r += glow[strength(b & 15)] * 10;
    r += dirname_of(a & 3, (b & 3) == 1) * 100;
    switch (same(a & 1, b & 1)) {
    case 1:
        r += 5000;
        break;
    }
    return r;
}

int
truthstore(int a, int b)
{
    static const int tab[2] = { 7, 9 };
    int lt = (a < b), either = (a & 2) || (b & 4), both = (a & 8) && (b & 16);
    _Bool bb = a & 4, bp = (b & 3) != 0;
    int r = 0;

    switch (lt) {
    case 1:
        r += 1;
        break;
    }
    r += tab[either] + tab[both] * 10;   /* || / && of ints: 0 or 1, not an operand */
    r += either * 100 + both * 1000;
    r += tab[bb] * 10000 + tab[bp] * 100000;
    lt = !b;
    r += tab[lt];
    return r;
}

/* a truth value as a printf argument */
int
truthfmt(int a, int b)
{
    char buf[32];
    int n = sprintf(buf, "%d%d%d", a > b, !b, (a & 1) || (b & 1));

    return n * 1000 + buf[0] * 100 + buf[1] * 10 + buf[2];
}

/* parentheses and casts the JS needs only once: ((x)), (+(a < b)) after a + or not, a cast of
   a cast to the same type, (void) on a statement */
static int truthsink;

static int
bump(int v)
{
    truthsink += v;
    return truthsink;
}

int
truthparen(int a, int b)
{
    unsigned m = (unsigned) ((unsigned) a * (unsigned) b);
    int r = a+(b > 3);
    _Bool z = a > 0 ? b & 1 : 0;

    truthsink = 0;
    (void) bump(a & 255);
    (void) (truthsink += b & 15);
    r -= ((a > b));
    r += -(a < b) + ((((a & 3) == 1)));
    r += (int) (m >> 28) + z * 7 + truthsink;
    return r;
}

/* a parenthesized comma expression as a branch of a discarded ?: keeps its parentheses */
int
truthcomma(int a, int b)
{
    int x = 0, y = 0;

    a > b ? (x = 1, y = 2) : (x = 3, y = 4);
    (void) (b > 0 ? (x += 5, y += 6) : (x += 7, y += 8));
    return x * 10 + y;
}
