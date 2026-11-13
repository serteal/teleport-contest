// src/eat.c: the message for eating an apple.

export default {
  file: "src/eat.c",
  patches: [
    {
      why: 'Eating an apple says "Delicious!  Must be a Macintosh!"; a pear still says "Core dumped."',
      edits: [
        { find: "#if defined(MACOS9) || defined(MACOS)\n        /* KMH", replace: "        /* KMH" },
        {
          find: `            pline("Delicious!  Must be a Macintosh!");\n#endif\n`,
          replace: `            pline("Delicious!  Must be a Macintosh!");\n`,
        },
      ],
    },
  ],
};
