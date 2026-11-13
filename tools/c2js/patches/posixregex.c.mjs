// sys/share/posixregex.c: error messages of regular expressions.

export default {
  file: "sys/share/posixregex.c",
  patches: [
    {
      why: "The message for an invalid regular expression comes from nhjs_regerror() (nhjs_host.c).",
      edits: [
        {
          find: "        regerror(re->err, &re->re, errbuf, BUFSZ);\n",
          replace: `        extern size_t nhjs_regerror(int, const regex_t *, char *, size_t);

        nhjs_regerror(re->err, &re->re, errbuf, BUFSZ);
`,
        },
      ],
    },
  ],
};
