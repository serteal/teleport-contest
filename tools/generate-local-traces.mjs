#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./c2js/c2js.config.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const recordScript = join(projectRoot, "scripts/record-session.mjs");
const recorderBinary = join(
  projectRoot,
  "nethack-c/recorder/install/games/lib/nethackdir/nethack",
);
const buildScript = join(projectRoot, "nethack-c/build-recorder.sh");
const sessionsDir = join(projectRoot, "sessions");
const canonicalJsRcDisplayPath =
  "/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results/.nethackrc".slice(
    0,
    79,
  );

const roles = [
  "Archeologist",
  "Barbarian",
  "Caveman",
  "Healer",
  "Knight",
  "Monk",
  "Priest",
  "Ranger",
  "Rogue",
  "Samurai",
  "Tourist",
  "Valkyrie",
  "Wizard",
];
const races = ["human", "elf", "dwarf", "gnome", "orc"];
const genders = ["male", "female"];
const aligns = ["lawful", "neutral", "chaotic"];
const datetimes = [
  "20000110090000",
  "20001013090000",
  "20001111120000",
  "20010401073000",
  "20020222151500",
  "20040929010101",
  "20260506120000",
];

function usage() {
  return `Usage: node ${scriptPath} [options]

Generate extra C-recorded trace sessions under .cache/ and score the JS port
against them with the existing analyzer.

Options:
  --out DIR              Output directory (default .cache/local-traces)
  --tier NAME            smoke | default | stress | edge | deep (default default)
  --count N              Number of fuzz specs (tier default when omitted)
  --public-remix N       Number of public keyplan remixes (tier default when omitted)
  --public-mutation N    Number of public keyplan mutation specs (tier default when omitted)
  --shards N             Split generated specs into N deterministic shards
  --shard-index N        Record only this zero-based shard index
  --feature-report FILE  Write aggregate screen-feature coverage JSON
  --filter TEXT          Record only specs whose slug or source contains TEXT
  --build                Build the C recorder if it is missing
  --force                Delete existing output directory before recording
  --keep-going           Keep recording after a failed spec
  --dry-run              Write manifest/spec inputs without invoking C
  --score                Run tools/analyze-failures.mjs on the generated corpus
  --strict               Run tools/strict-score.mjs on the generated corpus
  --check MODE           Run tools/check-traces.mjs in competition or paranoid mode
  -h, --help             Show this help`;
}

function parseArgs(argv) {
  const opts = {
    outDir: join(projectRoot, ".cache/local-traces"),
    tier: "default",
    count: null,
    publicRemix: null,
    publicMutation: null,
    shards: 1,
    shardIndex: 0,
    featureReport: "",
    filter: "",
    build: false,
    force: false,
    keepGoing: false,
    dryRun: false,
    score: false,
    strict: false,
    checks: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const readValue = (name) => {
      const eq = arg.indexOf("=");
      if (eq >= 0) return arg.slice(eq + 1);
      if (i + 1 >= argv.length) throw new Error(`${name} needs a value`);
      return argv[++i];
    };

    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "--out" || arg.startsWith("--out="))
      opts.outDir = resolvePath(readValue("--out"));
    else if (arg === "--tier" || arg.startsWith("--tier="))
      opts.tier = readValue("--tier");
    else if (arg === "--count" || arg.startsWith("--count="))
      opts.count = Number(readValue("--count"));
    else if (arg === "--public-remix" || arg.startsWith("--public-remix="))
      opts.publicRemix = Number(readValue("--public-remix"));
    else if (
      arg === "--public-mutation" ||
      arg.startsWith("--public-mutation=")
    )
      opts.publicMutation = Number(readValue("--public-mutation"));
    else if (arg === "--shards" || arg.startsWith("--shards="))
      opts.shards = Number(readValue("--shards"));
    else if (arg === "--shard-index" || arg.startsWith("--shard-index="))
      opts.shardIndex = Number(readValue("--shard-index"));
    else if (arg === "--feature-report" || arg.startsWith("--feature-report="))
      opts.featureReport = resolvePath(readValue("--feature-report"));
    else if (arg === "--filter" || arg.startsWith("--filter="))
      opts.filter = readValue("--filter");
    else if (arg === "--build") opts.build = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--keep-going") opts.keepGoing = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--score") opts.score = true;
    else if (arg === "--strict") opts.strict = true;
    else if (arg === "--check" || arg.startsWith("--check="))
      opts.checks.push(readValue("--check"));
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!["smoke", "default", "stress", "edge", "deep"].includes(opts.tier)) {
    throw new Error(
      `Unknown tier ${opts.tier}; expected smoke, default, stress, edge, or deep`,
    );
  }
  if (opts.count != null && (!Number.isInteger(opts.count) || opts.count < 0)) {
    throw new Error("--count must be a non-negative integer");
  }
  if (
    opts.publicRemix != null &&
    (!Number.isInteger(opts.publicRemix) || opts.publicRemix < 0)
  ) {
    throw new Error("--public-remix must be a non-negative integer");
  }
  if (
    opts.publicMutation != null &&
    (!Number.isInteger(opts.publicMutation) || opts.publicMutation < 0)
  ) {
    throw new Error("--public-mutation must be a non-negative integer");
  }
  if (!Number.isInteger(opts.shards) || opts.shards < 1) {
    throw new Error("--shards must be a positive integer");
  }
  if (
    !Number.isInteger(opts.shardIndex) ||
    opts.shardIndex < 0 ||
    opts.shardIndex >= opts.shards
  ) {
    throw new Error("--shard-index must be an integer in [0, shards)");
  }
  for (const check of opts.checks) {
    if (!["competition", "paranoid"].includes(check)) {
      throw new Error(`--check must be competition or paranoid, got ${check}`);
    }
  }
  return opts;
}

function resolvePath(path) {
  return path.startsWith("/") ? path : join(projectRoot, path);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function rc({
  name,
  role = "Tourist",
  race = "human",
  gender = "female",
  align = "neutral",
  playmode = "",
  symset = "DECgraphics",
  pettype = "none",
  options = [],
  lines = [],
}) {
  const core = [
    `name:${name}`,
    `role:${role}`,
    `race:${race}`,
    `gender:${gender}`,
    `align:${align}`,
  ];
  if (playmode) core.push(`playmode:${playmode}`);
  const out = [
    `OPTIONS=${core.join(",")}`,
    `OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen,pettype:${pettype}`,
    "OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.4.3",
    `OPTIONS=symset:${symset}`,
  ];
  if (options.length) out.push(`OPTIONS=${options.join(",")}`);
  out.push(...lines);
  return `${out.join("\n")}\n`;
}

function spec(slug, fields) {
  const segments = fields.segments || [
    {
      seed: fields.seed,
      datetime: fields.datetime,
      nethackrc: fields.nethackrc,
      moves: fields.moves,
    },
  ];
  return {
    slug,
    description: fields.description || slug,
    source: fields.source || "curated",
    tags: [...new Set(fields.tags || ["curated"])].sort(),
    segments: segments.map((segment) => ({
      seed: Number(segment.seed),
      datetime: segment.datetime || "20000110090000",
      nethackrc: segment.nethackrc || "",
      moves: segment.moves || "",
      steps: [],
    })),
  };
}

function sessionForSpec(traceSpec) {
  return {
    version: 5,
    source: "c",
    recorded_with: {
      harness: "tools/generate-local-traces.mjs",
      recorder: "nethack-c/build-recorder.sh",
    },
    trace: {
      slug: traceSpec.slug,
      description: traceSpec.description,
      source: traceSpec.source,
      tags: traceSpec.tags || [],
    },
    segments: traceSpec.segments,
  };
}

function curatedSpecs() {
  const inventoryTail = "i\u001b+\u001b\\\u001b\u0018 \u001bss:";
  const out = [];

  roles.forEach((role, i) => {
    const race = ["human", "elf", "dwarf", "gnome", "orc"][i % 5];
    out.push(
      spec(`startup-${slugify(role)}-${race}`, {
        description: `startup, movement, inventory, and option screens for ${role}`,
        tags: [
          "startup",
          "chargen",
          "inventory",
          "options",
          "movement",
          "role-matrix",
        ],
        seed: 30000 + i * 37,
        datetime: datetimes[i % datetimes.length],
        nethackrc: rc({
          name: `Trace${i}`,
          role,
          race,
          gender: genders[i % genders.length],
          align: aligns[i % aligns.length],
        }),
        moves: `  n${"hjklyubn".slice(i % 4)}.${inventoryTail}`,
      }),
    );
  });

  out.push(
    spec("menu-help-options-pager", {
      description:
        "help, options, encyclopedia, inventory and menu dismissal paths",
      tags: ["menu", "help", "options", "inventory", "pager"],
      seed: 40101,
      datetime: "20010401073000",
      nethackrc: rc({
        name: "Menus",
        role: "Ranger",
        race: "elf",
        gender: "female",
        align: "chaotic",
      }),
      moves:
        "  n?? \u001b/?fountain\r \u001bO\u001b i\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("look-travel-positioning", {
      description: "farlook, travel prompts, getpos, and cursor movement",
      tags: ["look", "travel", "getpos", "cursor"],
      seed: 40102,
      datetime: "20020222151500",
      nethackrc: rc({
        name: "Looker",
        role: "Rogue",
        race: "human",
        gender: "male",
        align: "chaotic",
      }),
      moves: "  n;llkk\r \u001b_>  >\r \u001b/altar\r \u001bssss:",
    }),
  );

  out.push(
    spec("engrave-throw-quiver", {
      description: "engraving, quiver, throw/fire command prompts",
      tags: ["engrave", "throw", "quiver", "prompt"],
      seed: 40103,
      datetime: "20040929010101",
      nethackrc: rc({
        name: "Etcher",
        role: "Ranger",
        race: "human",
        gender: "female",
        align: "neutral",
      }),
      moves:
        "  nQbytdl_E- Elbereth\r\u001bfa\u001bta.\u001b i\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("prayer-chat-offer-enhance", {
      description:
        "extended command prompts with prayer/chat/offer/enhance variants",
      tags: [
        "extended-command",
        "prayer",
        "chat",
        "offer",
        "enhance",
        "disclosure",
      ],
      seed: 40104,
      datetime: "20260506120000",
      nethackrc: rc({
        name: "Padre2",
        role: "Priest",
        race: "human",
        gender: "male",
        align: "lawful",
      }),
      moves:
        "  n#pray\ny #chat\nh#offer\n#enhance\n\u001b#conduct\n \u001b#vanquished\n \u001bss:",
    }),
  );

  out.push(
    spec("cast-read-zap-quaff", {
      description: "spell, read, zap, quaff, and encyclopedia prompt surfaces",
      tags: ["spell", "read", "zap", "quaff", "help", "prompt"],
      seed: 40105,
      datetime: "20000110090000",
      nethackrc: rc({
        name: "Caster",
        role: "Wizard",
        race: "human",
        gender: "male",
        align: "neutral",
      }),
      moves:
        "  nZa.rqgzh.r//   . n\u001b/E?fountain\r /ia /m /O \u001bi\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("ride-jump-kick-search", {
      description:
        "Knight riding, jump prompt, kicking, searching, and repeat counts",
      tags: ["ride", "jump", "kick", "search", "repeat-count", "pet"],
      seed: 40106,
      datetime: "20001111120000",
      nethackrc: rc({
        name: "SirTrace",
        role: "Knight",
        race: "human",
        gender: "male",
        align: "lawful",
        pettype: "horse",
        options: ["horsename:Shadowfax"],
      }),
      moves:
        "  ns#ride\nl#ride\n20s#jump\n hhkk.\u001b\u0004j\u0004j..i\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("wizard-wish-polyself-monster", {
      description:
        "wizard-mode wishes, polyself, monster generation, and quit disclosure",
      tags: ["wizard", "wish", "polyself", "monster", "death", "disclosure"],
      seed: 40107,
      datetime: "20001013090000",
      nethackrc: rc({
        name: "Wishful",
        role: "Wizard",
        race: "human",
        gender: "female",
        align: "neutral",
        playmode: "debug",
        options: ["disclose:-i -a -v -g -c -o"],
      }),
      moves:
        "\u0017wand of polymorph (0:30)\ndf\ndg\ndh\n#polyself\ngnome\n #monster\n#polyself\nred dragon\n  #wizwish\nmagic lamp\n#quit\ry",
    }),
  );

  out.push(
    spec("wizard-levelchange-teleport-wishes", {
      description:
        "wizard-mode level changes, teleport controls, armor wishes, and position prompts",
      tags: [
        "wizard",
        "levelchange",
        "teleport",
        "wish",
        "getpos",
        "branch-tour",
      ],
      seed: 40108,
      datetime: "20020222151500",
      nethackrc: rc({
        name: "Magellan2",
        role: "Wizard",
        race: "human",
        gender: "male",
        align: "neutral",
        playmode: "debug",
      }),
      moves:
        "   n#levelchange\n20\n     \u0017blessed +3 gray dragon scale mail\n\u0017blessed +3 speed boots\n\u0017blessed amulet of life saving\nT  Po Wn  \u0016?\ne\u0016?\n i\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("custom-symbols-and-bindings", {
      description: "custom SYMBOLS and BIND option handling",
      tags: ["options", "symbols", "bind", "terminal"],
      seed: 40109,
      datetime: "20010401073000",
      nethackrc: rc({
        name: "Binder2",
        role: "Wizard",
        race: "human",
        gender: "male",
        align: "neutral",
        playmode: "debug",
        lines: ["SYMBOLS=S_pool:~,S_fountain:{", "BIND=v:inventory"],
      }),
      moves:
        "   ny v hjlhh...\u0016?\ne\u0016?\n Bi\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("save-restore-state", {
      description:
        "two-segment save and restore with cross-segment storage state",
      source: "curated-multisegment",
      tags: [
        "save-restore",
        "storage",
        "multisegment",
        "record-file",
        "disclosure",
      ],
      segments: [
        {
          seed: 40110,
          datetime: "20001013090000",
          nethackrc: rc({
            name: "Saver",
            role: "Rogue",
            race: "human",
            gender: "female",
            align: "chaotic",
            pettype: "cat",
            options: ["disclose:yi ya yv yg yc yo"],
          }),
          moves: "   L\flKLLlJLLLKLhhhh,,da #chat\nhFhFhFhFh    nnSy",
        },
        {
          seed: 40111,
          datetime: "20001111120000",
          nethackrc: rc({
            name: "Saver",
            role: "Rogue",
            race: "human",
            gender: "female",
            align: "chaotic",
            pettype: "cat",
            options: ["disclose:yi ya yv yg yc yo"],
          }),
          moves:
            'i \\ \u0018 \u000f + $ ) [ = " \u007f : #vanquished\n #conduct\n Sy',
        },
      ],
    }),
  );

  out.push(
    spec("hallu-display-rng-actions", {
      description:
        "hallucination display RNG, inventory/menu redraws, and status-driven command text",
      tags: [
        "wizard",
        "hallucination",
        "display-rng",
        "menu",
        "status-effect",
        "inventory",
      ],
      seed: 40112,
      datetime: "20040929010101",
      nethackrc: rc({
        name: "Trippy2",
        role: "Wizard",
        race: "human",
        gender: "male",
        align: "neutral",
        playmode: "debug",
        options: ["lit_corridor"],
      }),
      moves:
        "  n#levelchange\n20\n  \u0016?\ne\u0017blessed amulet of life saving\n\u0017blessed +3 gray dragon scale mail\nT  Po Wn  #wizintrinsic\nh\n    hjklyubn   i\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("wand-zap-animation-stack", {
      description:
        "wand wishes, beam/zap animation frames, monster generation, and follow-up prompts",
      tags: ["wizard", "wish", "zap", "animation", "monster", "display-rng"],
      seed: 40113,
      datetime: "20020222151500",
      nethackrc: rc({
        name: "Beams",
        role: "Wizard",
        race: "human",
        gender: "female",
        align: "neutral",
        playmode: "debug",
        options: ["disclose:-i -a -v -g -c -o"],
      }),
      moves:
        " \u00165\n\u0017wand of fire\n\u0017wand of cold\n\u0017wand of lightning\n\u0017wand of magic missile\n\u0007gas spore\nznld f h\ny y y    ",
    }),
  );

  out.push(
    spec("containers-loot-force-untrap", {
      description:
        "container creation, looting, force/untrap prompts, and inventory object menus",
      tags: [
        "wizard",
        "wish",
        "container",
        "loot",
        "force",
        "untrap",
        "inventory",
      ],
      seed: 40114,
      datetime: "20010401073000",
      nethackrc: rc({
        name: "Chestie",
        role: "Wizard",
        race: "human",
        gender: "male",
        align: "neutral",
        playmode: "debug",
      }),
      moves:
        "  ns#wizwish\nchest\ndq   #loot\n#force\n#untrap\n#loot\nyyo\u001b\u001b i\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("fountain-dip-quaff-name", {
      description:
        "fountain interactions, dipping, quaffing, naming prompts, and escaped input",
      tags: ["fountain", "dip", "quaff", "name", "prompt", "status-effect"],
      seed: 40115,
      datetime: "20001013090000",
      nethackrc: rc({
        name: "Dequa2",
        role: "Healer",
        race: "gnome",
        gender: "female",
        align: "neutral",
      }),
      moves:
        "  n#dip\ndy#dip\neyq?ny#name\r\u001bf// h. nkljj. nbnyul. nH. n\u001bss:",
    }),
  );

  out.push(
    spec("altar-pray-turn-undead", {
      description:
        "altar/prayer and turn-undead command surfaces across priest/samurai-style prompts",
      tags: [
        "altar",
        "prayer",
        "turn-undead",
        "extended-command",
        "status-line",
      ],
      seed: 40116,
      datetime: "20260506120000",
      nethackrc: rc({
        name: "Clara2",
        role: "Priest",
        race: "human",
        gender: "female",
        align: "neutral",
      }),
      moves: "  nZa.rgy#turn\ri\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("topten-death-disclosure", {
      description:
        "death, topten, and disclosure without cross-segment stale lock artifacts",
      tags: ["death", "topten", "disclosure", "record-file"],
      seed: 40117,
      datetime: "20260601120000",
      nethackrc: rc({
        name: "Mortal",
        role: "Tourist",
        race: "human",
        gender: "female",
        align: "neutral",
        playmode: "debug",
        options: ["disclose:-i -a -v -g -c -o"],
      }),
      moves: " \u00162\n\u0017wand of death\nzs.  yy yyyy ",
    }),
  );

  out.push(
    spec("msg-window-reversed-and-ibm", {
      description:
        "alternate message window and IBM graphics serialization coverage",
      tags: ["terminal", "symset", "message-window", "options", "menu"],
      seed: 40119,
      datetime: "20001111120000",
      nethackrc: rc({
        name: "MsgRev",
        role: "Rogue",
        race: "orc",
        gender: "male",
        align: "chaotic",
        symset: "IBMgraphics",
        options: ["msg_window:reversed", "mention_walls"],
      }),
      moves:
        "  n:kkkhhhjjjlll.ssh,ek  \u0004ji\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  return out;
}

function edgeSpecs() {
  const out = [];
  const wizard = (name, options = [], lines = []) =>
    rc({
      name,
      role: "Wizard",
      race: "human",
      gender: "female",
      align: "neutral",
      playmode: "debug",
      options,
      lines,
    });

  out.push(
    spec("edge-message-wrap-more", {
      description:
        "long engraving/call/help text around message wrapping and --More-- prompts",
      source: "edge-curated",
      tags: ["edge", "message-wrap", "more", "engrave", "name", "pager"],
      seed: 81001,
      datetime: "20010401073000",
      nethackrc: wizard("LongMsg", [
        "msg_window:single",
        "disclose:-i -a -v -g -c -o",
      ]),
      moves:
        "  nE- the quick brown fox jumps over the lazy dog while a grid bug watches from the far hallway\r" +
        "#name\r" +
        "a very very long object name intended to touch the edge of the terminal message line\r" +
        "??  /?fountain\r /?Elbereth\r i\u001bss:",
    }),
  );

  out.push(
    spec("edge-full-message-window", {
      description:
        "full message window redraws, long messages, and pager dismissal",
      source: "edge-curated",
      tags: ["edge", "message-window", "full", "pager", "menu"],
      seed: 81002,
      datetime: "20001111120000",
      nethackrc: wizard("FullMsg", ["msg_window:full", "mention_walls"]),
      moves:
        "  n????????  \u001bO\u001b#conduct\n \u001b#vanquished\n \u001b#overview\n \u001bi\u001bss:",
    }),
  );

  out.push(
    spec("edge-reversed-message-window", {
      description: "reversed message window plus IBM graphics and map redraws",
      source: "edge-curated",
      tags: [
        "edge",
        "message-window",
        "reversed",
        "ibmgraphics",
        "status-line",
      ],
      seed: 81003,
      datetime: "20001013090000",
      nethackrc: rc({
        name: "RevMsg",
        role: "Wizard",
        race: "human",
        gender: "female",
        align: "neutral",
        playmode: "debug",
        symset: "IBMgraphics",
        options: ["msg_window:reversed", "mention_walls"],
      }),
      moves: "  nhhjkjllyubnss::,,i\u001b+\u001b\\\u001b\u0018 \u001bO\u001b",
    }),
  );

  out.push(
    spec("edge-status-hilites", {
      description:
        "status highlighting, low hp, hunger, burden and redraw surfaces",
      source: "edge-curated",
      tags: ["edge", "status-line", "color", "hilite", "redraw"],
      seed: 81004,
      datetime: "20260506120000",
      nethackrc: wizard("Hilite", [
        "statushilites:hitpoints/100%/green&hitpoints/<50%/yellow&hitpoints/<20%/red",
        "statushilites:power/100%/green&power/<50%/yellow",
        "hilite_pet",
      ]),
      moves:
        "  n\u0017wand of death\n\u0017loadstone\n\u0017corpse\nzi.  i\u001b\u0012ss:",
    }),
  );

  out.push(
    spec("edge-animation-beams-explosions", {
      description: "beam and explosion animation frame boundaries",
      source: "edge-curated",
      tags: ["edge", "animation", "beam", "explosion", "zap", "display-rng"],
      seed: 81005,
      datetime: "20020222151500",
      nethackrc: wizard("Anim", ["sparkle", "lit_corridor"]),
      moves:
        "  n\u0017wand of fire\n\u0017wand of cold\n\u0017wand of lightning\n\u0017wand of magic missile\n" +
        "\u0007gas spore\n\u0007floating eye\nzhzhzlzkzj y y y y y ",
    }),
  );

  out.push(
    spec("edge-hallucination-menustack", {
      description:
        "hallucination display RNG with stacked inventory/help redraws",
      source: "edge-curated",
      tags: ["edge", "hallucination", "display-rng", "menu", "inventory"],
      seed: 81006,
      datetime: "20040929010101",
      nethackrc: wizard("HalluEdge", ["lit_corridor"]),
      moves:
        "  n#levelchange\n20\n#wizintrinsic\nh\n" +
        "i\u001b+\u001b\\\u001b\u0018 \u001b??  /?grid bug\r \u001bss:",
    }),
  );

  out.push(
    spec("edge-disclosure-death-topten", {
      description: "death, disclosure menus, topten and end-of-game prompts",
      source: "edge-curated",
      tags: ["edge", "death", "disclosure", "topten", "record-file"],
      seed: 81007,
      datetime: "20001013090000",
      nethackrc: wizard("ByeBye", ["disclose:yi ya yv yg yc yo"]),
      moves: "  n\u0017wand of death\nzs.  yy yyyy ",
    }),
  );

  out.push(
    spec("edge-save-restore-disclosure", {
      description:
        "save/restore followed by menus and disclosure with persisted VFS state",
      source: "edge-curated",
      tags: ["edge", "save-restore", "multisegment", "storage", "menu"],
      segments: [
        {
          seed: 81008,
          datetime: "20000110090000",
          nethackrc: rc({
            name: "EdgeSave",
            role: "Rogue",
            race: "human",
            gender: "female",
            align: "chaotic",
            pettype: "cat",
            options: ["disclose:yi ya yv yg yc yo"],
          }),
          moves: "  nLLLhhhjjj,,,i\u001bSy",
        },
        {
          seed: 81009,
          datetime: "20001013090000",
          nethackrc: rc({
            name: "EdgeSave",
            role: "Rogue",
            race: "human",
            gender: "female",
            align: "chaotic",
            pettype: "cat",
            options: ["disclose:yi ya yv yg yc yo"],
          }),
          moves:
            'i \\ \u0018 \u000f + $ ) [ = " \u007f : #conduct\n \u001b#vanquished\n \u001bSy',
        },
      ],
    }),
  );

  out.push(
    spec("edge-getpos-travel-farlook", {
      description: "cursor-heavy getpos, travel, farlook and whatis prompts",
      source: "edge-curated",
      tags: ["edge", "cursor", "getpos", "travel", "farlook", "prompt"],
      seed: 81010,
      datetime: "20020222151500",
      nethackrc: rc({
        name: "Cursor",
        role: "Ranger",
        race: "elf",
        gender: "female",
        align: "chaotic",
      }),
      moves:
        "  n;hhhhllllkkkkjjjj\r \u001b_>  >\r \u001b/?altar\r /?door\r \u001bss:",
    }),
  );

  out.push(
    spec("edge-container-inventory-pages", {
      description:
        "container, loot, object selection and escaped inventory pages",
      source: "edge-curated",
      tags: ["edge", "container", "inventory", "loot", "menu", "object-prompt"],
      seed: 81011,
      datetime: "20010401073000",
      nethackrc: wizard("Bags", ["menustyle:full"]),
      moves:
        "  n#wizwish\nchest\n#wizwish\nbag of holding\n#wizwish\n20 rocks\n" +
        "#loot\ny\u001b#force\n#untrap\n i\u001b+\u001b\\\u001b\u0018 \u001b",
    }),
  );

  out.push(
    spec("edge-special-level-tour", {
      description: "wizard-mode special-level branch tour and redraws",
      source: "edge-curated",
      tags: [
        "edge",
        "wizard",
        "levelchange",
        "special-level",
        "branch-tour",
        "redraw",
      ],
      seed: 81012,
      datetime: "20001111120000",
      nethackrc: wizard("Branchy", ["lit_corridor"]),
      moves:
        "  n#levelchange\n3\n  \u0012#levelchange\n10\n  \u0012#levelchange\n20\n  \u0012" +
        "#levelchange\n30\n  \u0012#overview\n \u001b#conduct\n \u001bss:",
    }),
  );

  out.push(
    spec("edge-polymorph-ride-monster-text", {
      description:
        "polyself, monster creation, riding prompts and unusual status text",
      source: "edge-curated",
      tags: ["edge", "polyself", "monster", "ride", "status-line", "prompt"],
      seed: 81013,
      datetime: "20260506120000",
      nethackrc: rc({
        name: "PolyRide",
        role: "Knight",
        race: "human",
        gender: "male",
        align: "lawful",
        playmode: "debug",
        pettype: "horse",
        options: ["horsename:Tracehorse"],
      }),
      moves:
        "  n#ride\n#polyself\ngnome\n #monster\nfloating eye\n #ride\n20s#jump\n kklljjhhss:",
    }),
  );

  out.push(
    spec("edge-options-symbols-colors", {
      description:
        "runtime option menus, custom symbols, color toggles and redraws",
      source: "edge-curated",
      tags: ["edge", "options", "symbols", "color", "terminal", "redraw"],
      seed: 81014,
      datetime: "20040929010101",
      nethackrc: rc({
        name: "SymEdge",
        role: "Wizard",
        race: "human",
        gender: "male",
        align: "neutral",
        playmode: "debug",
        options: ["use_darkgray", "mention_walls"],
        lines: [
          "SYMBOLS=S_pool:~,S_fountain:{,S_litcorr:#",
          "BIND=v:inventory",
        ],
      }),
      moves: "  nO\u001b\u0012v\u001b/?fountain\r \u001b;llkk\r \u001bss:",
    }),
  );

  return out;
}

function appendRcLines(rcText, lines) {
  const body = String(rcText || "").trimEnd();
  return `${body}${body ? "\n" : ""}${lines.join("\n")}\n`;
}

function removeRcOptions(rcText, optionNames) {
  const names = new Set(optionNames);
  const lines = String(rcText || "")
    .trimEnd()
    .split("\n")
    .map((line) => {
      if (!line.startsWith("OPTIONS=")) return line;
      const parts = line
        .slice("OPTIONS=".length)
        .split(",")
        .filter((part) => {
          const key = part.trim().replace(/^!/, "").split(":")[0];
          return !names.has(key);
        });
      return parts.length ? `OPTIONS=${parts.join(",")}` : "";
    })
    .filter(Boolean);
  return `${lines.join("\n")}\n`;
}

function setRcSymset(rcText, symset) {
  return appendRcLines(removeRcOptions(rcText, ["symset"]), [
    `OPTIONS=symset:${symset}`,
  ]);
}

function focusedSpecs() {
  const out = [];
  const wizard = (name, options = [], lines = []) =>
    rc({
      name,
      role: "Wizard",
      race: "human",
      gender: "female",
      align: "neutral",
      playmode: "debug",
      options,
      lines,
    });
  const inventoryProbe = "i\u001b+\u001b\\\u001b\u0018 \u001bO\u001bss:";

  out.push(
    spec("focused-name-prompt-line-editing", {
      description:
        "startup name prompt editing with escape retry, backspace, and prompt redraw",
      source: "focused-curated",
      tags: ["focused", "name", "prompt", "line-edit", "backspace", "escape"],
      seed: 82000,
      datetime: "20260506120000",
      nethackrc: [
        "OPTIONS=role:Samurai,race:human,gender:male,align:lawful",
        "OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen,pettype:none",
        "OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.4.3",
        "OPTIONS=symset:DECgraphics",
      ].join("\n"),
      moves: "Temp\u001bAkirq\ba\r LLlkLLHjjjLLLL......HHHHHkkkkkkssss:",
    }),
  );

  out.push(
    spec("focused-getlin-line-editing", {
      description:
        "getlin editing with backspace, line kill, long engraving text, and message redraw",
      source: "focused-curated",
      tags: ["focused", "getlin", "line-edit", "backspace", "kill", "more"],
      seed: 82010,
      datetime: "20001111120000",
      nethackrc: wizard("Getlin", ["msg_window:reversed", "msghistory:60"]),
      moves:
        "  nE-rough\b\u0015Final engraving text after line kill for terminal echo bookkeeping\r" +
        "\u0010 \u001bss:",
    }),
  );

  out.push(
    spec("focused-color-status-hilites-darkgray", {
      description:
        "status highlight rules, dark gray handling, menu colors, and three-line status redraws",
      source: "focused-curated",
      tags: [
        "focused",
        "color",
        "hilite",
        "status-line",
        "menu-color",
        "inventory",
      ],
      seed: 82001,
      datetime: "20260506120000",
      nethackrc: wizard(
        "ColorHi",
        [
          "statushilites:12",
          "hitpointbar",
          "statuslines:3",
          "terrainstatus",
          "weaponstatus",
          "use_darkgray",
          "hilite_pet",
          "menu_headings:blue&inverse",
          "menu_objsyms:entries",
          "menucolors",
        ],
        [
          "OPTIONS=hilite_status: hitpoints/100%/gray&normal",
          "OPTIONS=hilite_status: hitpoints/<100%/green&normal",
          "OPTIONS=hilite_status: hitpoints/<50%/yellow&inverse",
          "OPTIONS=hilite_status: hitpoints/<20%/red&bold",
          "OPTIONS=hilite_status: power/<100%/cyan&bold",
          "OPTIONS=hilite_status: condition/hallu+blind+conf+stun/red&inverse",
          'MENUCOLOR=" blessed "=green&bold',
          'MENUCOLOR=" cursed "=red&inverse',
        ],
      ),
      moves:
        "  n\u0017loadstone\n\u0017blessed +3 speed boots\n\u0017cursed scroll of identify\n" +
        "\u0017wand of death\n#wizintrinsic\nh\n z. n " +
        inventoryProbe,
    }),
  );

  out.push(
    spec("focused-color-no-darkgray-custom-symbols", {
      description:
        "no-darkgray rendering with custom symbols, lit corridors, and option redraws",
      source: "focused-curated",
      tags: ["focused", "color", "symbols", "options", "terminal", "redraw"],
      seed: 82002,
      datetime: "20040929010101",
      nethackrc: wizard(
        "NoGray",
        ["!use_darkgray", "mention_walls", "lit_corridor", "hilite_pet"],
        ["SYMBOLS=S_pool:~,S_fountain:{,S_litcorr:#", "BIND=v:inventory"],
      ),
      moves:
        "  nO\u001b\u0012v\u001b;hhhhllllkkkkjjjj\r \u001b/?fountain\r \u001bss:",
    }),
  );

  out.push(
    spec("focused-color-menu-headings-menucolors", {
      description:
        "full inventory menus with headings, object symbols, and MENUCOLOR rules",
      source: "focused-curated",
      tags: [
        "focused",
        "color",
        "menu",
        "menu-color",
        "inventory",
        "object-prompt",
      ],
      seed: 82003,
      datetime: "20010401073000",
      nethackrc: wizard(
        "MenuClr",
        [
          "menustyle:full",
          "menu_headings:red&inverse",
          "menu_objsyms:both",
          "menucolors",
          "force_invmenu",
        ],
        [
          'MENUCOLOR=" blessed "=green&bold',
          'MENUCOLOR=" cursed "=red&inverse',
          'MENUCOLOR=" uncursed "=yellow&normal',
          'MENUCOLOR="wand"=cyan&bold',
        ],
      ),
      moves:
        "  n\u0017blessed +3 speed boots\n\u0017cursed scroll of identify\n" +
        "\u0017uncursed wand of digging\n\u0017blessed potion of healing\n" +
        "i\u001bda\u001b+a\u001b\\a\u001b\u0018 \u001bss:",
    }),
  );

  const deathMoves = "  n\u0017wand of death\nzs.  yy yyyy ";
  out.push(
    spec("focused-raw-topten-window-on", {
      description: "death, tombstone, disclosure, and topten window enabled",
      source: "focused-curated",
      tags: ["focused", "death", "topten", "raw-output", "disclosure"],
      seed: 82004,
      datetime: "20001013090000",
      nethackrc: wizard("TopWinOn", [
        "toptenwin",
        "tombstone",
        "disclose:yi ya yv yg yc yo",
      ]),
      moves: deathMoves,
    }),
  );

  out.push(
    spec("focused-raw-topten-window-off", {
      description: "death, tombstone, disclosure, and raw topten output",
      source: "focused-curated",
      tags: ["focused", "death", "topten", "raw-output", "disclosure"],
      seed: 82005,
      datetime: "20001013090000",
      nethackrc: wizard("TopWinOff", [
        "!toptenwin",
        "tombstone",
        "disclose:yi ya yv yg yc yo",
      ]),
      moves: deathMoves,
    }),
  );

  out.push(
    spec("focused-raw-no-tombstone-no-disclose", {
      description: "minimal end-of-game path without tombstone or disclosures",
      source: "focused-curated",
      tags: ["focused", "death", "topten", "raw-output"],
      seed: 82006,
      datetime: "20001013090000",
      nethackrc: wizard("NoStone", [
        "!toptenwin",
        "!tombstone",
        "disclose:-i -a -v -g -c -o",
      ]),
      moves: deathMoves,
    }),
  );

  out.push(
    spec("focused-raw-long-name-killer", {
      description: "end-of-game record text with a long player name",
      source: "focused-curated",
      tags: ["focused", "death", "topten", "raw-output", "record-file"],
      seed: 82007,
      datetime: "20260506120000",
      nethackrc: rc({
        name: "VeryLongTraceNameForScoreRecord",
        role: "Wizard",
        race: "human",
        gender: "female",
        align: "neutral",
        playmode: "debug",
        options: ["!toptenwin", "tombstone", "disclose:-i -a -v -g -c -o"],
      }),
      moves: deathMoves,
    }),
  );

  out.push(
    spec("focused-raw-save-restore-death-recordfile", {
      description: "save/restore followed by death and record-file output",
      source: "focused-curated",
      tags: [
        "focused",
        "save-restore",
        "multisegment",
        "death",
        "record-file",
        "storage",
      ],
      segments: [
        {
          seed: 82008,
          datetime: "20001111120000",
          nethackrc: wizard("SaveDie", [
            "!toptenwin",
            "tombstone",
            "disclose:-i -a -v -g -c -o",
          ]),
          moves: "  nLLLhhhjjj,,,i\u001bSy",
        },
        {
          seed: 82009,
          datetime: "20001111120000",
          nethackrc: wizard("SaveDie", [
            "!toptenwin",
            "tombstone",
            "disclose:-i -a -v -g -c -o",
          ]),
          moves: "\u0017wand of death\nzs.  yy yyyy ",
        },
      ],
    }),
  );

  const symsetMoves =
    "  n\u0012;hhhhllllkkkkjjjj\r \u001b/?fountain\r /?door\r \u001bi\u001bss:";
  [
    ["focused-symset-plain", "plain"],
    ["focused-symset-ibmgraphics-2", "IBMGraphics_2"],
    ["focused-symset-enhanced1-utf8", "Enhanced1"],
    ["focused-symset-enhanced2-utf8", "Enhanced2"],
    ["focused-symset-blank-rle", "Blank"],
  ].forEach(([slug, symset], index) => {
    out.push(
      spec(slug, {
        description: `terminal serialization and map redraws with symset ${symset}`,
        source: "focused-curated",
        tags: ["focused", "terminal", "symset", "redraw", "cursor"],
        seed: 82020 + index,
        datetime: datetimes[index % datetimes.length],
        nethackrc: rc({
          name: `Sym${index}`,
          role: "Ranger",
          race: "elf",
          gender: index % 2 ? "male" : "female",
          align: "chaotic",
          symset,
          options: ["windowborders:1", "mention_walls"],
        }),
        moves: symsetMoves,
      }),
    );
  });

  out.push(
    spec("focused-styled-rle-menu-full", {
      description:
        "full message window, full menus, forced inventory menu, and styled empty space",
      source: "focused-curated",
      tags: ["focused", "styled-rle", "menu", "message-window", "inventory"],
      seed: 82030,
      datetime: "20010401073000",
      nethackrc: wizard(
        "RleMenu",
        [
          "msg_window:full",
          "menustyle:full",
          "menu_headings:green&inverse",
          "menu_objsyms:entries",
          "force_invmenu",
          "standout",
        ],
        [
          'MENUCOLOR=" blessed "=green&bold',
          'MENUCOLOR=" cursed "=red&inverse',
        ],
      ),
      moves:
        "  n\u0017blessed +3 speed boots\n\u0017cursed scroll of identify\n\u0017wand of fire\n" +
        "\u0017bag of holding\n\u001720 rocks\n????????  \u001bi\u001b+\u001b\\\u001b\u0018 \u001b\u0010 \u001bss:",
    }),
  );

  out.push(
    spec("focused-styled-rle-reversed-more", {
      description:
        "reversed previous-message window, long messages, and --More-- boundaries",
      source: "focused-curated",
      tags: ["focused", "styled-rle", "message-window", "message-wrap", "more"],
      seed: 82031,
      datetime: "20001111120000",
      nethackrc: wizard("RleMore", [
        "msg_window:reversed",
        "msghistory:60",
        "standout",
      ]),
      moves:
        "  nE- a deliberately long engraving to fill the top line and force wrapped previous-message bookkeeping\r" +
        "E- another deliberately long engraving with repeated words for terminal RLE and --More-- handling\r" +
        "\u0010 \u0010 \u001b??  /?Elbereth\r \u001bss:",
    }),
  );

  out.push(
    spec("focused-styled-rle-perm-invent", {
      description:
        "persistent inventory, window borders, window colors, and inventory redraws",
      source: "focused-curated",
      tags: [
        "focused",
        "styled-rle",
        "perm-invent",
        "window-border",
        "inventory",
      ],
      seed: 82032,
      datetime: "20020222151500",
      nethackrc: wizard(
        "PermInv",
        [
          "perminv_mode:full",
          "windowborders:3",
          "menustyle:full",
          "menu_headings:cyan&inverse",
        ],
        ["OPTIONS=windowcolors:menu white/blue text yellow/black"],
      ),
      moves:
        "  n\u0017blessed +3 speed boots\n\u0017amulet of life saving\n\u0017wand of digging\n" +
        "i\u001bda\u001b+a\u001b\\\u001b\u0018 \u001b\u0012ss:",
    }),
  );

  const rcMutations = [
    {
      suffix: "msg-full-standout",
      lines: ["OPTIONS=msg_window:full,standout,msghistory:60"],
      replaceOptions: ["msg_window", "msghistory", "standout"],
      tags: ["message-window", "styled-rle"],
    },
    {
      suffix: "menu-full-headings",
      lines: [
        "OPTIONS=msg_window:reversed,menustyle:full,menu_headings:cyan&inverse,menu_objsyms:entries,force_invmenu",
      ],
      replaceOptions: [
        "msg_window",
        "menustyle",
        "menu_headings",
        "menu_objsyms",
        "force_invmenu",
      ],
      tags: ["message-window", "menu", "inventory"],
    },
    {
      suffix: "topten-disclose",
      lines: ["OPTIONS=toptenwin,tombstone,disclose:yi ya yv yg yc yo"],
      replaceOptions: ["toptenwin", "tombstone", "disclose"],
      tags: ["topten", "disclosure"],
    },
    {
      suffix: "enhanced1",
      symset: "Enhanced1",
      lines: ["OPTIONS=windowborders:1,mention_walls"],
      replaceOptions: ["symset", "windowborders", "mention_walls"],
      tags: ["symset", "terminal"],
    },
    {
      suffix: "status-hilites",
      lines: [
        "OPTIONS=!use_darkgray,statushilites:12,hitpointbar,statuslines:3,terrainstatus,weaponstatus",
        "OPTIONS=hilite_status: hitpoints/<100%/green&normal",
        "OPTIONS=hilite_status: hitpoints/<50%/yellow&inverse",
        "OPTIONS=hilite_status: condition/major/orange&inverse",
      ],
      replaceOptions: [
        "use_darkgray",
        "statushilites",
        "hitpointbar",
        "statuslines",
        "terrainstatus",
        "weaponstatus",
        "hilite_status",
      ],
      tags: ["color", "hilite", "status-line"],
    },
    {
      suffix: "perm-invent",
      lines: [
        "OPTIONS=perminv_mode:full,windowborders:3,menustyle:full,menu_headings:green&inverse",
      ],
      replaceOptions: [
        "perminv_mode",
        "windowborders",
        "menustyle",
        "menu_headings",
      ],
      tags: ["perm-invent", "inventory", "window-border"],
    },
  ];
  const publicSessions = readPublicSessions().filter(
    ({ session }) =>
      Array.isArray(session.segments) && session.segments.length === 1,
  );
  for (let i = 0; i < Math.min(publicSessions.length, 24); i++) {
    const entry = publicSessions[(i * 11) % publicSessions.length];
    const mutation = rcMutations[i % rcMutations.length];
    const segment = entry.session.segments[0];
    let nethackrc = removeRcOptions(
      segment.nethackrc || "",
      mutation.replaceOptions || [],
    );
    if (mutation.symset) nethackrc = setRcSymset(nethackrc, mutation.symset);
    nethackrc = appendRcLines(nethackrc, mutation.lines);
    out.push(
      spec(
        `focused-public-rc-${slugify(entry.name.replace(/\.session\.json$/, ""))}-${mutation.suffix}-${i}`,
        {
          description: `public keyplan with focused RC display mutation from ${entry.name}`,
          source: `focused-public-rc:${entry.name}`,
          tags: [
            "focused",
            "public-rc-mutation",
            "public-keyplan",
            ...mutation.tags,
          ],
          seed: Number(segment.seed || 83000 + i * 97),
          datetime: segment.datetime || datetimes[i % datetimes.length],
          nethackrc,
          moves: String(segment.moves || "").slice(0, 320),
        },
      ),
    );
  }

  return out;
}

function deepCuratedSpecs() {
  const out = [];
  const wizard = (name, options = [], lines = []) =>
    rc({
      name,
      role: "Wizard",
      race: "human",
      gender: "female",
      align: "neutral",
      playmode: "debug",
      options,
      lines,
    });

  out.push(
    spec("deep-wizard-branch-lua-tour", {
      description:
        "long wizard-mode branch tour through special-level generation, Lua rooms, menus, and redraws",
      source: "deep-curated",
      tags: [
        "deep",
        "wizard",
        "levelchange",
        "branch-tour",
        "special-level",
        "lua",
        "redraw",
        "overview",
      ],
      seed: 91001,
      datetime: "20040929010101",
      nethackrc: wizard("DeepLua", [
        "lit_corridor",
        "disclose:-i -a -v -g -c -o",
      ]),
      moves:
        "  n#levelchange\n2\n  \u0012#levelchange\n3\n  \u0012#levelchange\n10\n  \u0012" +
        "#levelchange\n20\n  \u0012#levelchange\n25\n  \u0012#levelchange\n30\n  \u0012" +
        "#overview\n \u001b#conduct\n \u001b#vanquished\n \u001bi\u001b+\u001b\\\u001b\u0018 \u001bss:",
    }),
  );

  out.push(
    spec("deep-wizard-poly-monster-combat", {
      description:
        "polymorph, monster creation, conflict-style crowding, zap beams, and repeated combat turns",
      source: "deep-curated",
      tags: [
        "deep",
        "wizard",
        "polyself",
        "monster",
        "combat",
        "zap",
        "animation",
        "display-rng",
      ],
      seed: 91002,
      datetime: "20260506120000",
      nethackrc: wizard("DeepPoly", ["lit_corridor", "sparkle"]),
      moves:
        "  n\u0017blessed amulet of life saving\n\u0017wand of fire\n\u0017wand of cold\n" +
        "#polyself\nred dragon\n #monster\nfloating eye\n #monster\nleocrotta\n " +
        "#monster\nsoldier ant\n zhzjzlzk y y y hhhhhjjjjkkkkllll....i\u001bss:",
    }),
  );

  out.push(
    spec("deep-shop-object-state", {
      description:
        "shop interactions with worn items, unpaid object state, inventory menus, and object naming",
      source: "deep-curated",
      tags: [
        "deep",
        "shop",
        "inventory",
        "object-state",
        "wear",
        "name",
        "menu",
      ],
      seed: 91003,
      datetime: "20010401073000",
      nethackrc: wizard("DeepShop", [
        "menustyle:full",
        "force_invmenu",
        "menu_objsyms:both",
      ]),
      moves:
        "  n\u0017blessed +3 speed boots\n\u0017cursed cloak of invisibility\n" +
        "\u0017bag of holding\n\u001720 rocks\nWadbi\u001b#name\rDeep object label\r" +
        "i\u001b+\u001b\\\u001b\u0018 \u001b#overview\n \u001bss:",
    }),
  );

  out.push(
    spec("deep-save-restore-bones-record", {
      description:
        "multi-segment save/restore, record-file output, death disclosure, and persisted VFS state",
      source: "deep-curated",
      tags: [
        "deep",
        "save-restore",
        "multisegment",
        "death",
        "record-file",
        "storage",
        "disclosure",
      ],
      segments: [
        {
          seed: 91004,
          datetime: "20001013090000",
          nethackrc: wizard("DeepSave", [
            "!toptenwin",
            "tombstone",
            "disclose:yi ya yv yg yc yo",
          ]),
          moves:
            "  n\u0017blessed +3 speed boots\n\u0017bag of holding\nLLLhhhjjj,,,i\u001bSy",
        },
        {
          seed: 91005,
          datetime: "20001013090000",
          nethackrc: wizard("DeepSave", [
            "!toptenwin",
            "tombstone",
            "disclose:yi ya yv yg yc yo",
          ]),
          moves:
            "i\u001b#conduct\n \u001b#vanquished\n \u001b\u0017wand of death\nzs.  yy yyyy ",
        },
      ],
    }),
  );

  out.push(
    spec("deep-trap-terrain-status", {
      description:
        "terrain/status-heavy movement with loadstone burden, low HP, farlook, and repeated redraws",
      source: "deep-curated",
      tags: [
        "deep",
        "trap",
        "terrain",
        "status-line",
        "burden",
        "farlook",
        "redraw",
      ],
      seed: 91006,
      datetime: "20001111120000",
      nethackrc: wizard("DeepTrap", [
        "statuslines:3",
        "terrainstatus",
        "weaponstatus",
        "hitpointbar",
        "lit_corridor",
      ]),
      moves:
        "  n\u0017loadstone\n\u0017corpse\n\u0017wand of digging\n" +
        "hhjjkkllHHJJKKLL;hhhhllllkkkkjjjj\r \u001b/?trap\r /?door\r \u001b\u0012ss:",
    }),
  );

  out.push(
    spec("deep-color-wizmap-cavern", {
      description:
        "compact color-heavy wizard map redraw over deep levels, targeting NOMUX color-state capture",
      source: "deep-curated",
      tags: [
        "deep",
        "wizard",
        "color",
        "wizmap",
        "levelchange",
        "decgraphics",
        "status-line",
      ],
      seed: 91007,
      datetime: "20040929010101",
      nethackrc: wizard("DeepColor", [
        "windowborders:2",
        "mention_walls",
        "!use_darkgray",
        "statuslines:3",
        "terrainstatus",
        "weaponstatus",
        "hitpointbar",
      ]),
      moves:
        "  n#levelchange\n33\n #wizmap\n \u001650\n \u001640\n #wizmap\n" +
        "\u0012i\u001bss:",
    }),
  );

  return out;
}

function deepPublicSpecs(limit) {
  const publicSessions = readPublicSessions().filter(
    ({ name, session }) =>
      name !== "seed0030-ten-diverse-deaths.session.json" &&
      Array.isArray(session.segments) &&
      session.segments.length === 1 &&
      String(session.segments[0].moves || "").length >= 250,
  );
  const candidates = publicSessions.sort(
    (a, b) =>
      String(b.session.segments[0].moves || "").length -
      String(a.session.segments[0].moves || "").length,
  );
  const rcMutations = [
    { suffix: "same-rc", lines: [], replaceOptions: [] },
    {
      suffix: "display-heavy",
      lines: [
        "OPTIONS=msg_window:reversed,msghistory:80,standout,lit_corridor",
        "OPTIONS=statuslines:3,terrainstatus,weaponstatus,hitpointbar",
      ],
      replaceOptions: [
        "msg_window",
        "msghistory",
        "standout",
        "lit_corridor",
        "statuslines",
        "terrainstatus",
        "weaponstatus",
        "hitpointbar",
      ],
    },
    {
      suffix: "menu-heavy",
      lines: [
        "OPTIONS=menustyle:full,force_invmenu,menu_objsyms:both,menu_headings:cyan&inverse,menucolors",
        'MENUCOLOR=" blessed "=green&bold',
        'MENUCOLOR=" cursed "=red&inverse',
      ],
      replaceOptions: [
        "menustyle",
        "force_invmenu",
        "menu_objsyms",
        "menu_headings",
        "menucolors",
      ],
    },
    {
      suffix: "enhanced-symbols",
      symset: "Enhanced2",
      lines: ["OPTIONS=windowborders:2,mention_walls,!use_darkgray"],
      replaceOptions: [
        "symset",
        "windowborders",
        "mention_walls",
        "use_darkgray",
      ],
    },
  ];
  const out = [];
  let index = 0;
  while (out.length < limit && candidates.length) {
    const entry = candidates[index % candidates.length];
    const variant = Math.floor(index / candidates.length);
    const mutation = rcMutations[variant % rcMutations.length];
    const segment = entry.session.segments[0];
    let nethackrc = removeRcOptions(
      segment.nethackrc || "",
      mutation.replaceOptions || [],
    );
    if (mutation.symset) nethackrc = setRcSymset(nethackrc, mutation.symset);
    if (mutation.lines?.length)
      nethackrc = appendRcLines(nethackrc, mutation.lines);
    const originalMoves = String(segment.moves || "");
    const maxLen = variant === 0 ? 2200 : 1400;
    out.push(
      spec(
        `deep-public-${slugify(entry.name.replace(/\.session\.json$/, ""))}-${mutation.suffix}-${variant}`,
        {
          description: `hidden-like deep public keyplan remix from ${entry.name}`,
          source: `deep-public:${entry.name}`,
          tags: [
            "deep",
            "public-keyplan",
            "seed-mutation",
            "datetime-mutation",
            mutation.suffix,
          ],
          seed: 92000 + index * 997 + Number(segment.seed || 0),
          datetime: datetimes[(index * 5 + variant) % datetimes.length],
          nethackrc,
          moves: originalMoves.slice(0, maxLen),
        },
      ),
    );
    index++;
  }
  return out;
}

function readPublicSessions() {
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir)
    .filter((name) => name.endsWith(".session.json"))
    .sort()
    .map((name) => {
      const full = join(sessionsDir, name);
      const session = JSON.parse(readFileSync(full, "utf8"));
      return { name, full, session };
    });
}

function remixPublicSpecs(limit) {
  const publicSessions = readPublicSessions();
  const out = [];
  const maxLenByTier = 240;
  const usable = publicSessions.filter(
    ({ session }) =>
      Array.isArray(session.segments) && session.segments.length === 1,
  );
  for (let i = 0; i < limit && usable.length; i++) {
    const entry = usable[(i * 7) % usable.length];
    const segments = entry.session.segments.map((segment, segmentIndex) => ({
      seed: 50000 + i * 101 + segmentIndex,
      datetime: datetimes[(i + segmentIndex) % datetimes.length],
      nethackrc: segment.nethackrc || "",
      moves: String(segment.moves || "").slice(0, maxLenByTier),
      steps: [],
    }));
    out.push(
      spec(
        `remix-${slugify(entry.name.replace(/\.session\.json$/, ""))}-${i}`,
        {
          description: `public keyplan remix from ${entry.name}`,
          source: `public-remix:${entry.name}`,
          tags: ["public-remix", "seed-mutation", "datetime-mutation"],
          segments,
        },
      ),
    );
  }
  return out;
}

function mutateMoves(moves, index) {
  const source = String(moves || "");
  const insertions = [
    "i\u001b",
    "?a \u001b",
    "O\u001b",
    "/?fountain\r \u001b",
    ";llkk\r \u001b",
    "+\u001b\\\u001b\u0018 \u001b",
  ];
  const cut = Math.min(
    source.length,
    12 + ((index * 11) % Math.max(1, source.length || 1)),
  );
  const prefix = source.slice(0, cut);
  const suffix = source.slice(cut, Math.min(source.length, cut + 220));
  return `${prefix}${insertions[index % insertions.length]}${suffix}`.slice(
    0,
    260,
  );
}

function publicMutationSpecs(limit) {
  const publicSessions = readPublicSessions();
  const usable = publicSessions.filter(
    ({ session }) =>
      Array.isArray(session.segments) && session.segments.length === 1,
  );
  const out = [];
  for (let i = 0; i < limit && usable.length; i++) {
    const entry = usable[(i * 5 + 3) % usable.length];
    const segment = entry.session.segments[0];
    out.push(
      spec(
        `mutate-${slugify(entry.name.replace(/\.session\.json$/, ""))}-${i}`,
        {
          description: `public keyplan with inserted menu/prompt probes from ${entry.name}`,
          source: `public-mutation:${entry.name}`,
          tags: [
            "public-mutation",
            "inserted-menu",
            "prompt",
            "seed-mutation",
            "datetime-mutation",
          ],
          seed: 70000 + i * 131,
          datetime: datetimes[(i * 3) % datetimes.length],
          nethackrc: segment.nethackrc || "",
          moves: mutateMoves(segment.moves || "", i),
        },
      ),
    );
  }
  return out;
}

class Lcg {
  constructor(seed) {
    this.state = seed >>> 0;
  }
  next() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state;
  }
  int(max) {
    return this.next() % max;
  }
  pick(array) {
    return array[this.int(array.length)];
  }
  chance(num, den) {
    return this.int(den) < num;
  }
}

const moveAtoms = [
  "hjklyubn",
  "HHJJKKLL",
  "20s",
  "....",
  "ss:",
  ",,",
  "> < ",
  "i\u001b",
  "+\u001b",
  "\\\u001b",
  "\u0018 \u001b",
  "O\u001b",
  "?a \u001b",
  "/?fountain\r \u001b",
  ";llkk\r \u001b",
  "_>  >\r \u001b",
  "E- Elbereth\r",
  "Qby",
  "ta.\u001b",
  "fa\u001b",
  "za.\u001b",
  "qa\u001b",
  "ra\u001b",
  "Za.\u001b",
  "ea\u001b",
  "o\u001b",
  "c\u001b",
  "#pray\ny ",
  "#chat\nh",
  "#sit\n",
  "#enhance\n\u001b",
  "#name\r\u001b",
  "#conduct\n \u001b",
  "#vanquished\n \u001b",
];

const wizardAtoms = [
  "\u0017wand of fire\n",
  "\u0017wand of digging\n",
  "\u0017blessed +3 speed boots\n",
  "\u0017blessed amulet of life saving\n",
  "#levelchange\n2\n",
  "#levelchange\n10\n",
  "#wizwish\nmagic lamp\n",
  "#polyself\ngnome\n ",
  "#monster\njackal\n ",
  "#wizintrinsic\nh\n ",
];

function fuzzSpecs(count) {
  const rng = new Lcg(0x5eed1234);
  const out = [];
  for (let i = 0; i < count; i++) {
    const role = roles[i % roles.length];
    const isWizardMode = role === "Wizard" || rng.chance(1, 5);
    const atomCount = 5 + rng.int(isWizardMode ? 12 : 9);
    let moves = rng.chance(2, 3) ? "  n" : "";
    for (let j = 0; j < atomCount; j++) {
      moves += rng.pick(moveAtoms);
      if (isWizardMode && rng.chance(1, 4)) moves += rng.pick(wizardAtoms);
    }
    moves = moves.slice(0, 180);
    const symset = rng.chance(4, 5) ? "DECgraphics" : "IBMgraphics";
    out.push(
      spec(
        `fuzz-${String(i).padStart(3, "0")}-${slugify(role)}-${symset.toLowerCase()}`,
        {
          description: `deterministic command fuzz ${i} (${role}, ${symset})`,
          source: "deterministic-fuzz",
          tags: [
            "deterministic-fuzz",
            "movement",
            "prompt",
            "menu",
            "role-matrix",
            isWizardMode ? "wizard" : "normal-mode",
            symset === "DECgraphics" ? "decgraphics" : "ibmgraphics",
          ],
          seed: 60000 + i * 211 + rng.int(199),
          datetime:
            datetimes[(i + rng.int(datetimes.length)) % datetimes.length],
          nethackrc: rc({
            name: `Fuzz${i}`,
            role,
            race: rng.pick(races),
            gender: rng.pick(genders),
            align: rng.pick(aligns),
            playmode: isWizardMode ? "debug" : "",
            symset,
            pettype: rng.chance(1, 4) ? "dog" : "none",
            options: rng.chance(1, 3) ? ["msg_window:reversed"] : [],
          }),
          moves,
        },
      ),
    );
  }
  return out;
}

function tierDefaults(tier) {
  if (tier === "smoke")
    return { curatedLimit: 12, count: 8, publicRemix: 6, publicMutation: 4 };
  if (tier === "stress")
    return {
      curatedLimit: Infinity,
      count: 180,
      publicRemix: 44,
      publicMutation: 96,
    };
  if (tier === "edge")
    return {
      curatedLimit: Infinity,
      count: 260,
      publicRemix: 44,
      publicMutation: 180,
    };
  if (tier === "deep")
    return {
      curatedLimit: 0,
      count: 0,
      publicRemix: 40,
      publicMutation: 0,
    };
  return {
    curatedLimit: Infinity,
    count: 72,
    publicRemix: 32,
    publicMutation: 36,
  };
}

function allSpecs(opts) {
  const defaults = tierDefaults(opts.tier);
  const curated = curatedSpecs().slice(0, defaults.curatedLimit);
  const edge =
    opts.tier === "edge" || opts.tier === "stress" ? edgeSpecs() : [];
  const focused =
    opts.tier === "edge" || opts.tier === "stress" ? focusedSpecs() : [];
  const deep = opts.tier === "deep" ? deepCuratedSpecs() : [];
  const publicCount = opts.publicRemix ?? defaults.publicRemix;
  const mutationCount = opts.publicMutation ?? defaults.publicMutation;
  const fuzzCount = opts.count ?? defaults.count;
  let specs = [
    ...curated,
    ...edge,
    ...focused,
    ...deep,
    ...(opts.tier === "deep" ? deepPublicSpecs(publicCount) : []),
    ...(opts.tier === "deep" ? [] : remixPublicSpecs(publicCount)),
    ...publicMutationSpecs(mutationCount),
    ...fuzzSpecs(fuzzCount),
  ];
  if (opts.filter) {
    specs = specs.filter((s) =>
      `${s.slug} ${s.source} ${s.description}`.includes(opts.filter),
    );
  }
  const seen = new Set();
  specs = specs.map((s, index) => {
    let slug = s.slug;
    if (seen.has(slug)) slug = `${slug}-${index}`;
    seen.add(slug);
    return { ...s, slug };
  });
  if (opts.shards > 1) {
    specs = specs.filter((_, index) => index % opts.shards === opts.shardIndex);
  }
  return specs;
}

function ensureRecorder(opts) {
  if (existsSync(recorderBinary)) return;
  if (!opts.build) {
    throw new Error(
      `recorder binary missing: ${recorderBinary}\nRun with --build or build it via nethack-c/build-recorder.sh`,
    );
  }
  const child = spawnSync("bash", [buildScript], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (child.status !== 0) {
    throw new Error(`recorder build failed with exit ${child.status}`);
  }
  if (!existsSync(recorderBinary)) {
    throw new Error(
      `recorder build finished but binary is still missing: ${recorderBinary}`,
    );
  }
}

function cleanOutDir(outDir, force) {
  if (force) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "inputs"), { recursive: true });
}

function recordTrace(traceSpec, opts) {
  const inputPath = join(
    opts.outDir,
    "inputs",
    `${traceSpec.slug}.input.session.json`,
  );
  const outputPath = join(opts.outDir, `${traceSpec.slug}.session.json`);
  writeFileSync(
    inputPath,
    `${JSON.stringify(sessionForSpec(traceSpec), null, 2)}\n`,
  );

  if (opts.dryRun) {
    return { slug: traceSpec.slug, inputPath, outputPath, skipped: "dry-run" };
  }
  if (existsSync(outputPath) && !opts.force && statSync(outputPath).isFile()) {
    return { slug: traceSpec.slug, inputPath, outputPath, skipped: "exists" };
  }

  const child = spawnSync(
    process.execPath,
    [recordScript, inputPath, outputPath],
    {
      cwd: projectRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        // Display-RNG entries are ignored by the current scorer, but keeping
        // them in locally generated traces makes hallucination/debug sessions
        // more useful when the comparator grows a display-RNG channel.
        NETHACK_RNGLOG_DISP: process.env.NETHACK_RNGLOG_DISP || "1",
      },
    },
  );

  if (child.status !== 0) {
    const detail = [child.stderr, child.stdout]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${traceSpec.slug}: recorder exit ${child.status}\n${detail}`,
    );
  }
  canonicalizeRecordedSession(outputPath);
  validateRecordedSession(outputPath);
  return { slug: traceSpec.slug, inputPath, outputPath };
}

function canonicalizeRecordedSession(outputPath) {
  const session = JSON.parse(readFileSync(outputPath, "utf8"));
  let changed = false;
  const normalizeScreen = (screen) =>
    String(screen || "").replace(
      /^\/.*\/\.nethackrc$/gm,
      canonicalJsRcDisplayPath,
    );
  for (const segment of session.segments || []) {
    for (const step of segment.steps || []) {
      if (typeof step.screen !== "string") continue;
      const next = normalizeScreen(step.screen);
      if (next !== step.screen) {
        step.screen = next;
        changed = true;
      }
    }
    for (const frame of segment.animation_frames || []) {
      if (typeof frame.screen !== "string") continue;
      const next = normalizeScreen(frame.screen);
      if (next !== frame.screen) {
        frame.screen = next;
        changed = true;
      }
    }
  }
  if (changed) writeFileSync(outputPath, `${JSON.stringify(session)}\n`);
}

function validateRecordedSession(outputPath) {
  const session = JSON.parse(readFileSync(outputPath, "utf8"));
  const markerPattern = /\x1b]7777;KIND=/;
  for (const [segmentIndex, segment] of (session.segments || []).entries()) {
    for (const [stepIndex, step] of (segment.steps || []).entries()) {
      if (typeof step.screen === "string" && markerPattern.test(step.screen)) {
        throw new Error(
          `${outputPath}: leaked NOMUX marker in segment ${segmentIndex} step ${stepIndex}`,
        );
      }
      for (const [frameIndex, frame] of (
        step.animation_frames || []
      ).entries()) {
        if (
          typeof frame.screen === "string" &&
          markerPattern.test(frame.screen)
        ) {
          throw new Error(
            `${outputPath}: leaked NOMUX marker in segment ${segmentIndex} step ${stepIndex} animation frame ${frameIndex}`,
          );
        }
      }
    }
    for (const [frameIndex, frame] of (
      segment.animation_frames || []
    ).entries()) {
      if (
        typeof frame.screen === "string" &&
        markerPattern.test(frame.screen)
      ) {
        throw new Error(
          `${outputPath}: leaked NOMUX marker in segment ${segmentIndex} animation frame ${frameIndex}`,
        );
      }
    }
  }
}

function increment(object, key, amount = 1) {
  object[key] = (object[key] || 0) + amount;
}

function collectScreenFeatures(screen, features) {
  const raw = String(screen || "");
  const plain = raw
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\x0e\x0f]/g, "");
  const lines = plain.split("\n");
  const msg = lines[0] || "";
  const status = `${lines[22] || ""}\n${lines[23] || ""}`;

  const rules = [
    ["morePrompt", /--More--/],
    ["menuEnd", /\(end\)|\(1 of \d+\)|\(\d+ of \d+\)/],
    [
      "inventory",
      /Inventory:|Things that are here|You are carrying|What do you want to (?:wear|take off|drop|eat|read|quaff|zap|throw|call|name)/,
    ],
    [
      "helpPager",
      /Help|Long description|What do you want to look up|Specify what\?/,
    ],
    [
      "extendedCommand",
      /Extended command|#(?:conduct|vanquished|overview|enhance|pray|chat|ride|jump|loot|force|untrap)/,
    ],
    ["ynPrompt", /\[[ynq]\]|\? \[[ynq]/],
    ["getposPrompt", /Move the cursor|Pick a location|Where do you want/],
    [
      "disclosure",
      /Vanquished creatures|Conduct|Final Attributes|Goodbye|Do you want your possessions identified/,
    ],
    ["topten", /Top Ten|No points|You made the top ten|Goodbye/],
    [
      "death",
      /You die|Do you want your possessions identified|killer|Killed by/,
    ],
    ["wish", /For what do you wish|Nothing fitting that description exists/],
    ["statusLine", /Dlvl:|HP:|Pw:|AC:|Xp:|Exp:|T:/],
    [
      "hungerStatus",
      /Hungry|Weak|Fainting|Satiated|Burdened|Stressed|Strained/,
    ],
    [
      "halluText",
      /far out|psychedelic|trippy|hallucin|strange|You are freaked out/,
    ],
    ["shopText", /shop|zorkmid|For you, .* only|unpaid/],
    ["questText", /quest|leader|nemesis|Home/],
  ];

  for (const [name, pattern] of rules) {
    if (pattern.test(plain)) increment(features.byFeature, name);
  }
  if (raw.includes("\x0e") || raw.includes("\x0f"))
    increment(features.byFeature, "decCharset");
  if (/\x1b\[[0-9;]*m/.test(raw)) increment(features.byFeature, "sgr");
  if (/\x1b\[[0-9;]*7[0-9;]*m/.test(raw))
    increment(features.byFeature, "inverse");
  if (/\x1b\[[0-9;]*4[0-9;]*m/.test(raw))
    increment(features.byFeature, "underline");
  if (/\x1b\[\d+C/.test(raw)) increment(features.byFeature, "cursorForwardRle");
  if (/[┌┐└┘│─▒≠≤≥π·]/u.test(raw))
    increment(features.byFeature, "unicodeLineDrawing");
  if (msg.length >= 70) increment(features.byFeature, "longMessageLine");
  if (status.length && /HP:|Pw:|AC:|T:/.test(status))
    increment(features.byFeature, "statusHud");
  if (lines.length >= 24) increment(features.byFeature, "fullHeightScreen");
}

function featuresForSession(outputPath) {
  if (!outputPath || !existsSync(outputPath)) return null;
  const session = JSON.parse(readFileSync(outputPath, "utf8"));
  const features = {
    screens: 0,
    animationFrames: 0,
    rngEntries: 0,
    displayRngEntries: 0,
    byFeature: {},
  };
  for (const segment of session.segments || []) {
    for (const step of segment.steps || []) {
      features.rngEntries += Array.isArray(step.rng) ? step.rng.length : 0;
      features.displayRngEntries += (step.rng || []).filter((entry) =>
        String(entry).startsWith("~drn2("),
      ).length;
      if (typeof step.screen === "string") {
        features.screens++;
        collectScreenFeatures(step.screen, features);
      }
    }
    for (const frame of segment.animation_frames || []) {
      features.animationFrames++;
      if (typeof frame.screen === "string")
        collectScreenFeatures(frame.screen, features);
    }
  }
  return features;
}

function mergeFeatures(target, source) {
  if (!source) return target;
  target.screens += source.screens || 0;
  target.animationFrames += source.animationFrames || 0;
  target.rngEntries += source.rngEntries || 0;
  target.displayRngEntries += source.displayRngEntries || 0;
  for (const [key, value] of Object.entries(source.byFeature || {}))
    increment(target.byFeature, key, value);
  return target;
}

function coverageSummary(entries) {
  const bySource = {};
  const byTag = {};
  const features = {
    screens: 0,
    animationFrames: 0,
    rngEntries: 0,
    displayRngEntries: 0,
    byFeature: {},
  };
  let segments = 0;
  let moves = 0;
  for (const entry of entries) {
    const source = String(entry.source || "").split(":")[0];
    bySource[source] = (bySource[source] || 0) + 1;
    for (const tag of entry.tags || []) byTag[tag] = (byTag[tag] || 0) + 1;
    for (const segment of entry.segments || []) {
      segments++;
      moves += segment.moves || 0;
    }
    mergeFeatures(features, entry.features);
  }
  return {
    sessions: entries.length,
    segments,
    moveChars: moves,
    bySource: Object.fromEntries(
      Object.entries(bySource).sort((a, b) => a[0].localeCompare(b[0])),
    ),
    byTag: Object.fromEntries(
      Object.entries(byTag).sort((a, b) => a[0].localeCompare(b[0])),
    ),
    features: {
      ...features,
      byFeature: Object.fromEntries(
        Object.entries(features.byFeature).sort((a, b) =>
          a[0].localeCompare(b[0]),
        ),
      ),
    },
  };
}

function runTool(label, args, opts) {
  console.error(`[${label}] node ${args.join(" ")}`);
  const child = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  });
  if (child.status !== 0) {
    throw new Error(`${label} failed with exit ${child.status}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }

  if (!opts.dryRun) ensureRecorder(opts);
  cleanOutDir(opts.outDir, opts.force);

  const specs = allSpecs(opts);
  const manifest = {
    timestamp: new Date().toISOString(),
    tier: opts.tier,
    outDir: opts.outDir,
    shard: {
      index: opts.shardIndex,
      count: opts.shards,
    },
    recorderBinary,
    totalSpecs: specs.length,
    entries: [],
    failures: [],
  };

  console.error(`[trace] recording ${specs.length} specs to ${opts.outDir}`);
  for (let i = 0; i < specs.length; i++) {
    const traceSpec = specs[i];
    process.stderr.write(`[${i + 1}/${specs.length}] ${traceSpec.slug} ... `);
    try {
      const result = recordTrace(traceSpec, opts);
      const features = result.skipped
        ? null
        : featuresForSession(result.outputPath);
      manifest.entries.push({
        slug: traceSpec.slug,
        source: traceSpec.source,
        tags: traceSpec.tags || [],
        description: traceSpec.description,
        segments: traceSpec.segments.map((s) => ({
          seed: s.seed,
          datetime: s.datetime,
          moves: s.moves.length,
        })),
        output: result.outputPath,
        input: result.inputPath,
        skipped: result.skipped || false,
        features,
      });
      process.stderr.write(
        result.skipped ? `SKIP ${result.skipped}\n` : "OK\n",
      );
    } catch (error) {
      manifest.failures.push({
        slug: traceSpec.slug,
        source: traceSpec.source,
        message: error.message,
      });
      process.stderr.write(`FAIL ${error.message.split("\n")[0]}\n`);
      if (!opts.keepGoing) break;
    }
    manifest.coverage = coverageSummary(manifest.entries);
    writeFileSync(
      join(opts.outDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  manifest.coverage = coverageSummary(manifest.entries);
  writeFileSync(
    join(opts.outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  if (opts.featureReport) {
    mkdirSync(dirname(opts.featureReport), { recursive: true });
    writeFileSync(
      opts.featureReport,
      `${JSON.stringify(manifest.coverage.features, null, 2)}\n`,
    );
    console.error(`[trace] wrote feature report ${opts.featureReport}`);
  }
  console.error(`[trace] wrote ${join(opts.outDir, "manifest.json")}`);

  if (manifest.failures.length) {
    console.error(`[trace] ${manifest.failures.length} recorder failures`);
    for (const failure of manifest.failures.slice(0, 10)) {
      console.error(`  ${failure.slug}: ${failure.message.split("\n")[0]}`);
    }
    if (!opts.keepGoing) process.exitCode = 1;
  }

  if (opts.score)
    runTool("analyze", ["tools/analyze-failures.mjs", opts.outDir], opts);
  if (opts.strict)
    runTool("strict", ["tools/strict-score.mjs", opts.outDir], opts);
  for (const check of opts.checks) {
    runTool(
      `check:${check}`,
      ["tools/check-traces.mjs", "--mode", check, opts.outDir],
      opts,
    );
  }
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
