// src/allmain.c: the session driver (tools/c2js/host/nhjs_tty_api.c) runs the game loop.

export default {
  file: "src/allmain.c",
  patches: [
    {
      why: "moveloop_preamble() and maybe_do_tutorial() can be called by the session driver.",
      edits: [
        {
          find: "staticfn void moveloop_preamble(boolean);",
          replace: "void moveloop_preamble(boolean);",
        },
        {
          find: "staticfn void maybe_do_tutorial(void);",
          replace: "void maybe_do_tutorial(void);",
        },
        {
          find: "staticfn void\nmoveloop_preamble(boolean resuming)",
          replace: "void\nmoveloop_preamble(boolean resuming)",
        },
        {
          find: "staticfn void\nmaybe_do_tutorial(void)",
          replace: "void\nmaybe_do_tutorial(void)",
        },
      ],
    },
    {
      why: "moveloop() hands the game loop over to the session driver.",
      edits: [
        {
          find: String.raw`moveloop(boolean resuming)
{
`,
          replace: String.raw`moveloop(boolean resuming)
{
    extern void nhjs_moveloop_entry(boolean);

    nhjs_moveloop_entry(resuming); /* does not return */
`,
        },
      ],
    },
    {
      why: "Every moveloop_core() iteration starts at a point from which play can be resumed.",
      edits: [
        {
          find: String.raw`moveloop_core(void)
{
    boolean monscanmove = FALSE;
`,
          replace: String.raw`moveloop_core(void)
{
    boolean monscanmove = FALSE;
    extern void nhjs_moveloop_boundary(void);

    nhjs_moveloop_boundary(); /* a resumable point of the game */
`,
        },
      ],
    },
  ],
};
