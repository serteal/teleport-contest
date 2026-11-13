/* fixture.h: macros for the rewriter tests */
#ifndef FIXTURE_H
#define FIXTURE_H
#define BUFSZ 64
#define NORMAL_SPEED 12
#define W_ARM 0x00000001L
#define W_ARMC 0x00000002L
#define W_ARMOR (W_ARM | W_ARMC)
#define TRUE ((boolean) 1)
#define FALSE ((boolean) 0)
#define max(a, b) ((a) > (b) ? (a) : (b))
#define twice(x) ((x) + (x))
#define rn1(x, y) (rn2(x) + (y))
#define is_big(p) ((p)->size > NORMAL_SPEED)
#define Bitfield(x, n) unsigned x : n
typedef unsigned char boolean;
typedef short coordxy;
struct thing {
    struct thing *next;
    int size;
    coordxy x, y;
    long long flags;
    char name[BUFSZ];
    int counts[4];
    Bitfield(lit, 1);
    Bitfield(kind, 3);
};
extern int rn2(int);
#define SIZE(x) (int) (sizeof (x) / sizeof (x)[0])
/* an array argument (ROLL_FROM(array) in hack.h) */
#define PICK(arr, i) arr[(i) % SIZE(arr)]
#endif
