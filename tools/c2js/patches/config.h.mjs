// include/config.h: save-file compression.
//
// makedefs compiles this header too; the change applies to the game only (NHJS_PORT, defined
// by tools/nh2js when it parses the game).

export default {
  file: "include/config.h",
  patches: [
    {
      why: "Saved games and bones files are written uncompressed.",
      edits: [
        {
          find: "#endif\n\n#ifndef COMPRESS\n",
          replace: `#endif

#ifdef NHJS_PORT
/* no external compression program: files are written uncompressed */
#undef COMPRESS
#endif

#ifndef COMPRESS
`,
        },
      ],
    },
  ],
};
