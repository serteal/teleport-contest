/* macros.c: which macro invocations stay calls */
#include "fixture.h"

int
macro_sites(int a, int b)
{
    int r = max(a, b);           /* kept: pure arguments */
    int s = twice(a + 1);        /* kept: pure argument used twice */
    int t = rn1(10, rn2(3));     /* expanded: impure argument and impure body */
    int u = rn1(b, 2);           /* kept */

    return r + s + t + u + NORMAL_SPEED;
}
