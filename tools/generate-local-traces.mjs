#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectRoot } from './c2js/c2js.config.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const recordScript = join(projectRoot, 'scripts/record-session.mjs');
const recorderBinary = join(projectRoot, 'nethack-c/recorder/install/games/lib/nethackdir/nethack');
const buildScript = join(projectRoot, 'nethack-c/build-recorder.sh');
const sessionsDir = join(projectRoot, 'sessions');
const canonicalJsRcDisplayPath =
  '/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results/.nethackrc'.slice(0, 79);

const roles = [
  'Archeologist',
  'Barbarian',
  'Caveman',
  'Healer',
  'Knight',
  'Monk',
  'Priest',
  'Ranger',
  'Rogue',
  'Samurai',
  'Tourist',
  'Valkyrie',
  'Wizard',
];
const races = ['human', 'elf', 'dwarf', 'gnome', 'orc'];
const genders = ['male', 'female'];
const aligns = ['lawful', 'neutral', 'chaotic'];
const datetimes = [
  '20000110090000',
  '20001013090000',
  '20001111120000',
  '20010401073000',
  '20020222151500',
  '20040929010101',
  '20260506120000',
];

function usage() {
  return `Usage: node ${scriptPath} [options]

Generate extra C-recorded trace sessions under .cache/ and score the JS port
against them with the existing analyzer.

Options:
  --out DIR              Output directory (default .cache/local-traces)
  --tier NAME            smoke | default | stress (default default)
  --count N              Number of fuzz specs (tier default when omitted)
  --public-remix N       Number of public keyplan remixes (tier default when omitted)
  --public-mutation N    Number of public keyplan mutation specs (tier default when omitted)
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
    outDir: join(projectRoot, '.cache/local-traces'),
    tier: 'default',
    count: null,
    publicRemix: null,
    publicMutation: null,
    filter: '',
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
      const eq = arg.indexOf('=');
      if (eq >= 0) return arg.slice(eq + 1);
      if (i + 1 >= argv.length) throw new Error(`${name} needs a value`);
      return argv[++i];
    };

    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--out' || arg.startsWith('--out=')) opts.outDir = resolvePath(readValue('--out'));
    else if (arg === '--tier' || arg.startsWith('--tier=')) opts.tier = readValue('--tier');
    else if (arg === '--count' || arg.startsWith('--count=')) opts.count = Number(readValue('--count'));
    else if (arg === '--public-remix' || arg.startsWith('--public-remix='))
      opts.publicRemix = Number(readValue('--public-remix'));
    else if (arg === '--public-mutation' || arg.startsWith('--public-mutation='))
      opts.publicMutation = Number(readValue('--public-mutation'));
    else if (arg === '--filter' || arg.startsWith('--filter=')) opts.filter = readValue('--filter');
    else if (arg === '--build') opts.build = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--keep-going') opts.keepGoing = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--score') opts.score = true;
    else if (arg === '--strict') opts.strict = true;
    else if (arg === '--check' || arg.startsWith('--check=')) opts.checks.push(readValue('--check'));
    else throw new Error(`Unknown option: ${arg}`);
  }

  if (!['smoke', 'default', 'stress'].includes(opts.tier)) {
    throw new Error(`Unknown tier ${opts.tier}; expected smoke, default, or stress`);
  }
  if (opts.count != null && (!Number.isInteger(opts.count) || opts.count < 0)) {
    throw new Error('--count must be a non-negative integer');
  }
  if (opts.publicRemix != null && (!Number.isInteger(opts.publicRemix) || opts.publicRemix < 0)) {
    throw new Error('--public-remix must be a non-negative integer');
  }
  if (opts.publicMutation != null && (!Number.isInteger(opts.publicMutation) || opts.publicMutation < 0)) {
    throw new Error('--public-mutation must be a non-negative integer');
  }
  for (const check of opts.checks) {
    if (!['competition', 'paranoid'].includes(check)) {
      throw new Error(`--check must be competition or paranoid, got ${check}`);
    }
  }
  return opts;
}

function resolvePath(path) {
  return path.startsWith('/') ? path : join(projectRoot, path);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function rc({
  name,
  role = 'Tourist',
  race = 'human',
  gender = 'female',
  align = 'neutral',
  playmode = '',
  symset = 'DECgraphics',
  pettype = 'none',
  options = [],
  lines = [],
}) {
  const core = [`name:${name}`, `role:${role}`, `race:${race}`, `gender:${gender}`, `align:${align}`];
  if (playmode) core.push(`playmode:${playmode}`);
  const out = [
    `OPTIONS=${core.join(',')}`,
    `OPTIONS=!autopickup,!legacy,!tutorial,!splash_screen,pettype:${pettype}`,
    'OPTIONS=pushweapon,showexp,time,color,suppress_alert:3.4.3',
    `OPTIONS=symset:${symset}`,
  ];
  if (options.length) out.push(`OPTIONS=${options.join(',')}`);
  out.push(...lines);
  return `${out.join('\n')}\n`;
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
    source: fields.source || 'curated',
    tags: [...new Set(fields.tags || ['curated'])].sort(),
    segments: segments.map((segment) => ({
      seed: Number(segment.seed),
      datetime: segment.datetime || '20000110090000',
      nethackrc: segment.nethackrc || '',
      moves: segment.moves || '',
      steps: [],
    })),
  };
}

function sessionForSpec(traceSpec) {
  return {
    version: 5,
    source: 'c',
    recorded_with: {
      harness: 'tools/generate-local-traces.mjs',
      recorder: 'nethack-c/build-recorder.sh',
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
  const inventoryTail = 'i\u001b+\u001b\\\u001b\u0018 \u001bss:';
  const out = [];

  roles.forEach((role, i) => {
    const race = ['human', 'elf', 'dwarf', 'gnome', 'orc'][i % 5];
    out.push(
      spec(`startup-${slugify(role)}-${race}`, {
        description: `startup, movement, inventory, and option screens for ${role}`,
        tags: ['startup', 'chargen', 'inventory', 'options', 'movement', 'role-matrix'],
        seed: 30000 + i * 37,
        datetime: datetimes[i % datetimes.length],
        nethackrc: rc({
          name: `Trace${i}`,
          role,
          race,
          gender: genders[i % genders.length],
          align: aligns[i % aligns.length],
        }),
        moves: `  n${'hjklyubn'.slice(i % 4)}.${inventoryTail}`,
      }),
    );
  });

  out.push(
    spec('menu-help-options-pager', {
      description: 'help, options, encyclopedia, inventory and menu dismissal paths',
      tags: ['menu', 'help', 'options', 'inventory', 'pager'],
      seed: 40101,
      datetime: '20010401073000',
      nethackrc: rc({ name: 'Menus', role: 'Ranger', race: 'elf', gender: 'female', align: 'chaotic' }),
      moves: '  n?? \u001b/?fountain\r \u001bO\u001b i\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('look-travel-positioning', {
      description: 'farlook, travel prompts, getpos, and cursor movement',
      tags: ['look', 'travel', 'getpos', 'cursor'],
      seed: 40102,
      datetime: '20020222151500',
      nethackrc: rc({ name: 'Looker', role: 'Rogue', race: 'human', gender: 'male', align: 'chaotic' }),
      moves: '  n;llkk\r \u001b_>  >\r \u001b/altar\r \u001bssss:',
    }),
  );

  out.push(
    spec('engrave-throw-quiver', {
      description: 'engraving, quiver, throw/fire command prompts',
      tags: ['engrave', 'throw', 'quiver', 'prompt'],
      seed: 40103,
      datetime: '20040929010101',
      nethackrc: rc({ name: 'Etcher', role: 'Ranger', race: 'human', gender: 'female', align: 'neutral' }),
      moves: '  nQbytdl_E- Elbereth\r\u001bfa\u001bta.\u001b i\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('prayer-chat-offer-enhance', {
      description: 'extended command prompts with prayer/chat/offer/enhance variants',
      tags: ['extended-command', 'prayer', 'chat', 'offer', 'enhance', 'disclosure'],
      seed: 40104,
      datetime: '20260506120000',
      nethackrc: rc({ name: 'Padre2', role: 'Priest', race: 'human', gender: 'male', align: 'lawful' }),
      moves: '  n#pray\ny #chat\nh#offer\n#enhance\n\u001b#conduct\n \u001b#vanquished\n \u001bss:',
    }),
  );

  out.push(
    spec('cast-read-zap-quaff', {
      description: 'spell, read, zap, quaff, and encyclopedia prompt surfaces',
      tags: ['spell', 'read', 'zap', 'quaff', 'help', 'prompt'],
      seed: 40105,
      datetime: '20000110090000',
      nethackrc: rc({ name: 'Caster', role: 'Wizard', race: 'human', gender: 'male', align: 'neutral' }),
      moves: '  nZa.rqgzh.r//   . n\u001b/E?fountain\r /ia /m /O \u001bi\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('ride-jump-kick-search', {
      description: 'Knight riding, jump prompt, kicking, searching, and repeat counts',
      tags: ['ride', 'jump', 'kick', 'search', 'repeat-count', 'pet'],
      seed: 40106,
      datetime: '20001111120000',
      nethackrc: rc({
        name: 'SirTrace',
        role: 'Knight',
        race: 'human',
        gender: 'male',
        align: 'lawful',
        pettype: 'horse',
        options: ['horsename:Shadowfax'],
      }),
      moves: '  ns#ride\nl#ride\n20s#jump\n hhkk.\u001b\u0004j\u0004j..i\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('wizard-wish-polyself-monster', {
      description: 'wizard-mode wishes, polyself, monster generation, and quit disclosure',
      tags: ['wizard', 'wish', 'polyself', 'monster', 'death', 'disclosure'],
      seed: 40107,
      datetime: '20001013090000',
      nethackrc: rc({
        name: 'Wishful',
        role: 'Wizard',
        race: 'human',
        gender: 'female',
        align: 'neutral',
        playmode: 'debug',
        options: ['disclose:-i -a -v -g -c -o'],
      }),
      moves:
        '\u0017wand of polymorph (0:30)\ndf\ndg\ndh\n#polyself\ngnome\n #monster\n#polyself\nred dragon\n  #wizwish\nmagic lamp\n#quit\ry',
    }),
  );

  out.push(
    spec('wizard-levelchange-teleport-wishes', {
      description: 'wizard-mode level changes, teleport controls, armor wishes, and position prompts',
      tags: ['wizard', 'levelchange', 'teleport', 'wish', 'getpos', 'branch-tour'],
      seed: 40108,
      datetime: '20020222151500',
      nethackrc: rc({
        name: 'Magellan2',
        role: 'Wizard',
        race: 'human',
        gender: 'male',
        align: 'neutral',
        playmode: 'debug',
      }),
      moves:
        '   n#levelchange\n20\n     \u0017blessed +3 gray dragon scale mail\n\u0017blessed +3 speed boots\n\u0017blessed amulet of life saving\nT  Po Wn  \u0016?\ne\u0016?\n i\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('custom-symbols-and-bindings', {
      description: 'custom SYMBOLS and BIND option handling',
      tags: ['options', 'symbols', 'bind', 'terminal'],
      seed: 40109,
      datetime: '20010401073000',
      nethackrc: rc({
        name: 'Binder2',
        role: 'Wizard',
        race: 'human',
        gender: 'male',
        align: 'neutral',
        playmode: 'debug',
        lines: ['SYMBOLS=S_pool:~,S_fountain:{', 'BIND=v:inventory'],
      }),
      moves: '   ny v hjlhh...\u0016?\ne\u0016?\n Bi\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('save-restore-state', {
      description: 'two-segment save and restore with cross-segment storage state',
      source: 'curated-multisegment',
      tags: ['save-restore', 'storage', 'multisegment', 'record-file', 'disclosure'],
      segments: [
        {
          seed: 40110,
          datetime: '20001013090000',
          nethackrc: rc({
            name: 'Saver',
            role: 'Rogue',
            race: 'human',
            gender: 'female',
            align: 'chaotic',
            pettype: 'cat',
            options: ['disclose:yi ya yv yg yc yo'],
          }),
          moves: '   L\flKLLlJLLLKLhhhh,,da #chat\nhFhFhFhFh    nnSy',
        },
        {
          seed: 40111,
          datetime: '20001111120000',
          nethackrc: rc({
            name: 'Saver',
            role: 'Rogue',
            race: 'human',
            gender: 'female',
            align: 'chaotic',
            pettype: 'cat',
            options: ['disclose:yi ya yv yg yc yo'],
          }),
          moves: 'i \\ \u0018 \u000f + $ ) [ = " \u007f : #vanquished\n #conduct\n Sy',
        },
      ],
    }),
  );

  out.push(
    spec('hallu-display-rng-actions', {
      description: 'hallucination display RNG, inventory/menu redraws, and status-driven command text',
      tags: ['wizard', 'hallucination', 'display-rng', 'menu', 'status-effect', 'inventory'],
      seed: 40112,
      datetime: '20040929010101',
      nethackrc: rc({
        name: 'Trippy2',
        role: 'Wizard',
        race: 'human',
        gender: 'male',
        align: 'neutral',
        playmode: 'debug',
        options: ['lit_corridor'],
      }),
      moves:
        '  n#levelchange\n20\n  \u0016?\ne\u0017blessed amulet of life saving\n\u0017blessed +3 gray dragon scale mail\nT  Po Wn  #wizintrinsic\nh\n    hjklyubn   i\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('wand-zap-animation-stack', {
      description: 'wand wishes, beam/zap animation frames, monster generation, and follow-up prompts',
      tags: ['wizard', 'wish', 'zap', 'animation', 'monster', 'display-rng'],
      seed: 40113,
      datetime: '20020222151500',
      nethackrc: rc({
        name: 'Beams',
        role: 'Wizard',
        race: 'human',
        gender: 'female',
        align: 'neutral',
        playmode: 'debug',
        options: ['disclose:-i -a -v -g -c -o'],
      }),
      moves:
        ' \u00165\n\u0017wand of fire\n\u0017wand of cold\n\u0017wand of lightning\n\u0017wand of magic missile\n\u0007gas spore\nznld f h\ny y y    ',
    }),
  );

  out.push(
    spec('containers-loot-force-untrap', {
      description: 'container creation, looting, force/untrap prompts, and inventory object menus',
      tags: ['wizard', 'wish', 'container', 'loot', 'force', 'untrap', 'inventory'],
      seed: 40114,
      datetime: '20010401073000',
      nethackrc: rc({
        name: 'Chestie',
        role: 'Wizard',
        race: 'human',
        gender: 'male',
        align: 'neutral',
        playmode: 'debug',
      }),
      moves:
        '  ns#wizwish\nchest\ndq   #loot\n#force\n#untrap\n#loot\nyyo\u001b\u001b i\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('fountain-dip-quaff-name', {
      description: 'fountain interactions, dipping, quaffing, naming prompts, and escaped input',
      tags: ['fountain', 'dip', 'quaff', 'name', 'prompt', 'status-effect'],
      seed: 40115,
      datetime: '20001013090000',
      nethackrc: rc({
        name: 'Dequa2',
        role: 'Healer',
        race: 'gnome',
        gender: 'female',
        align: 'neutral',
      }),
      moves: '  n#dip\ndy#dip\neyq?ny#name\r\u001bf// h. nkljj. nbnyul. nH. n\u001bss:',
    }),
  );

  out.push(
    spec('altar-pray-turn-undead', {
      description: 'altar/prayer and turn-undead command surfaces across priest/samurai-style prompts',
      tags: ['altar', 'prayer', 'turn-undead', 'extended-command', 'status-line'],
      seed: 40116,
      datetime: '20260506120000',
      nethackrc: rc({
        name: 'Clara2',
        role: 'Priest',
        race: 'human',
        gender: 'female',
        align: 'neutral',
      }),
      moves: '  nZa.rgy#turn\ri\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  out.push(
    spec('topten-death-disclosure', {
      description: 'death, topten, and disclosure without cross-segment stale lock artifacts',
      tags: ['death', 'topten', 'disclosure', 'record-file'],
      seed: 40117,
      datetime: '20260601120000',
      nethackrc: rc({
        name: 'Mortal',
        role: 'Tourist',
        race: 'human',
        gender: 'female',
        align: 'neutral',
        playmode: 'debug',
        options: ['disclose:-i -a -v -g -c -o'],
      }),
      moves: ' \u00162\n\u0017wand of death\nzs.  yy yyyy ',
    }),
  );

  out.push(
    spec('msg-window-reversed-and-ibm', {
      description: 'alternate message window and IBM graphics serialization coverage',
      tags: ['terminal', 'symset', 'message-window', 'options', 'menu'],
      seed: 40119,
      datetime: '20001111120000',
      nethackrc: rc({
        name: 'MsgRev',
        role: 'Rogue',
        race: 'orc',
        gender: 'male',
        align: 'chaotic',
        symset: 'IBMgraphics',
        options: ['msg_window:reversed', 'mention_walls'],
      }),
      moves: '  n:kkkhhhjjjlll.ssh,ek  \u0004ji\u001b+\u001b\\\u001b\u0018 \u001bss:',
    }),
  );

  return out;
}

function readPublicSessions() {
  if (!existsSync(sessionsDir)) return [];
  return readdirSync(sessionsDir)
    .filter((name) => name.endsWith('.session.json'))
    .sort()
    .map((name) => {
      const full = join(sessionsDir, name);
      const session = JSON.parse(readFileSync(full, 'utf8'));
      return { name, full, session };
    });
}

function remixPublicSpecs(limit) {
  const publicSessions = readPublicSessions();
  const out = [];
  const maxLenByTier = 240;
  const usable = publicSessions.filter(
    ({ session }) => Array.isArray(session.segments) && session.segments.length === 1,
  );
  for (let i = 0; i < limit && usable.length; i++) {
    const entry = usable[(i * 7) % usable.length];
    const segments = entry.session.segments.map((segment, segmentIndex) => ({
      seed: 50000 + i * 101 + segmentIndex,
      datetime: datetimes[(i + segmentIndex) % datetimes.length],
      nethackrc: segment.nethackrc || '',
      moves: String(segment.moves || '').slice(0, maxLenByTier),
      steps: [],
    }));
    out.push(
      spec(`remix-${slugify(entry.name.replace(/\.session\.json$/, ''))}-${i}`, {
        description: `public keyplan remix from ${entry.name}`,
        source: `public-remix:${entry.name}`,
        tags: ['public-remix', 'seed-mutation', 'datetime-mutation'],
        segments,
      }),
    );
  }
  return out;
}

function mutateMoves(moves, index) {
  const source = String(moves || '');
  const insertions = [
    'i\u001b',
    '?a \u001b',
    'O\u001b',
    '/?fountain\r \u001b',
    ';llkk\r \u001b',
    '+\u001b\\\u001b\u0018 \u001b',
  ];
  const cut = Math.min(source.length, 12 + ((index * 11) % Math.max(1, source.length || 1)));
  const prefix = source.slice(0, cut);
  const suffix = source.slice(cut, Math.min(source.length, cut + 220));
  return `${prefix}${insertions[index % insertions.length]}${suffix}`.slice(0, 260);
}

function publicMutationSpecs(limit) {
  const publicSessions = readPublicSessions();
  const usable = publicSessions.filter(
    ({ session }) => Array.isArray(session.segments) && session.segments.length === 1,
  );
  const out = [];
  for (let i = 0; i < limit && usable.length; i++) {
    const entry = usable[(i * 5 + 3) % usable.length];
    const segment = entry.session.segments[0];
    out.push(
      spec(`mutate-${slugify(entry.name.replace(/\.session\.json$/, ''))}-${i}`, {
        description: `public keyplan with inserted menu/prompt probes from ${entry.name}`,
        source: `public-mutation:${entry.name}`,
        tags: ['public-mutation', 'inserted-menu', 'prompt', 'seed-mutation', 'datetime-mutation'],
        seed: 70000 + i * 131,
        datetime: datetimes[(i * 3) % datetimes.length],
        nethackrc: segment.nethackrc || '',
        moves: mutateMoves(segment.moves || '', i),
      }),
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
  'hjklyubn',
  'HHJJKKLL',
  '20s',
  '....',
  'ss:',
  ',,',
  '> < ',
  'i\u001b',
  '+\u001b',
  '\\\u001b',
  '\u0018 \u001b',
  'O\u001b',
  '?a \u001b',
  '/?fountain\r \u001b',
  ';llkk\r \u001b',
  '_>  >\r \u001b',
  'E- Elbereth\r',
  'Qby',
  'ta.\u001b',
  'fa\u001b',
  'za.\u001b',
  'qa\u001b',
  'ra\u001b',
  'Za.\u001b',
  'ea\u001b',
  'o\u001b',
  'c\u001b',
  '#pray\ny ',
  '#chat\nh',
  '#sit\n',
  '#enhance\n\u001b',
  '#name\r\u001b',
  '#conduct\n \u001b',
  '#vanquished\n \u001b',
];

const wizardAtoms = [
  '\u0017wand of fire\n',
  '\u0017wand of digging\n',
  '\u0017blessed +3 speed boots\n',
  '\u0017blessed amulet of life saving\n',
  '#levelchange\n2\n',
  '#levelchange\n10\n',
  '#wizwish\nmagic lamp\n',
  '#polyself\ngnome\n ',
  '#monster\njackal\n ',
  '#wizintrinsic\nh\n ',
];

function fuzzSpecs(count) {
  const rng = new Lcg(0x5eed1234);
  const out = [];
  for (let i = 0; i < count; i++) {
    const role = roles[i % roles.length];
    const isWizardMode = role === 'Wizard' || rng.chance(1, 5);
    const atomCount = 5 + rng.int(isWizardMode ? 12 : 9);
    let moves = rng.chance(2, 3) ? '  n' : '';
    for (let j = 0; j < atomCount; j++) {
      moves += rng.pick(moveAtoms);
      if (isWizardMode && rng.chance(1, 4)) moves += rng.pick(wizardAtoms);
    }
    moves = moves.slice(0, 180);
    const symset = rng.chance(4, 5) ? 'DECgraphics' : 'IBMgraphics';
    out.push(
      spec(`fuzz-${String(i).padStart(3, '0')}-${slugify(role)}-${symset.toLowerCase()}`, {
        description: `deterministic command fuzz ${i} (${role}, ${symset})`,
        source: 'deterministic-fuzz',
        tags: [
          'deterministic-fuzz',
          'movement',
          'prompt',
          'menu',
          'role-matrix',
          isWizardMode ? 'wizard' : 'normal-mode',
          symset === 'DECgraphics' ? 'decgraphics' : 'ibmgraphics',
        ],
        seed: 60000 + i * 211 + rng.int(199),
        datetime: datetimes[(i + rng.int(datetimes.length)) % datetimes.length],
        nethackrc: rc({
          name: `Fuzz${i}`,
          role,
          race: rng.pick(races),
          gender: rng.pick(genders),
          align: rng.pick(aligns),
          playmode: isWizardMode ? 'debug' : '',
          symset,
          pettype: rng.chance(1, 4) ? 'dog' : 'none',
          options: rng.chance(1, 3) ? ['msg_window:reversed'] : [],
        }),
        moves,
      }),
    );
  }
  return out;
}

function tierDefaults(tier) {
  if (tier === 'smoke') return { curatedLimit: 12, count: 8, publicRemix: 6, publicMutation: 4 };
  if (tier === 'stress') return { curatedLimit: Infinity, count: 180, publicRemix: 44, publicMutation: 96 };
  return { curatedLimit: Infinity, count: 72, publicRemix: 32, publicMutation: 36 };
}

function allSpecs(opts) {
  const defaults = tierDefaults(opts.tier);
  const curated = curatedSpecs().slice(0, defaults.curatedLimit);
  const publicCount = opts.publicRemix ?? defaults.publicRemix;
  const mutationCount = opts.publicMutation ?? defaults.publicMutation;
  const fuzzCount = opts.count ?? defaults.count;
  let specs = [
    ...curated,
    ...remixPublicSpecs(publicCount),
    ...publicMutationSpecs(mutationCount),
    ...fuzzSpecs(fuzzCount),
  ];
  if (opts.filter) {
    specs = specs.filter((s) => `${s.slug} ${s.source} ${s.description}`.includes(opts.filter));
  }
  const seen = new Set();
  return specs.map((s, index) => {
    let slug = s.slug;
    if (seen.has(slug)) slug = `${slug}-${index}`;
    seen.add(slug);
    return { ...s, slug };
  });
}

function ensureRecorder(opts) {
  if (existsSync(recorderBinary)) return;
  if (!opts.build) {
    throw new Error(
      `recorder binary missing: ${recorderBinary}\nRun with --build or build it via nethack-c/build-recorder.sh`,
    );
  }
  const child = spawnSync('bash', [buildScript], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (child.status !== 0) {
    throw new Error(`recorder build failed with exit ${child.status}`);
  }
  if (!existsSync(recorderBinary)) {
    throw new Error(`recorder build finished but binary is still missing: ${recorderBinary}`);
  }
}

function cleanOutDir(outDir, force) {
  if (force) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'inputs'), { recursive: true });
}

function recordTrace(traceSpec, opts) {
  const inputPath = join(opts.outDir, 'inputs', `${traceSpec.slug}.input.session.json`);
  const outputPath = join(opts.outDir, `${traceSpec.slug}.session.json`);
  writeFileSync(inputPath, `${JSON.stringify(sessionForSpec(traceSpec), null, 2)}\n`);

  if (opts.dryRun) {
    return { slug: traceSpec.slug, inputPath, outputPath, skipped: 'dry-run' };
  }
  if (existsSync(outputPath) && !opts.force && statSync(outputPath).isFile()) {
    return { slug: traceSpec.slug, inputPath, outputPath, skipped: 'exists' };
  }

  const child = spawnSync(process.execPath, [recordScript, inputPath, outputPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      // Display-RNG entries are ignored by the current scorer, but keeping
      // them in locally generated traces makes hallucination/debug sessions
      // more useful when the comparator grows a display-RNG channel.
      NETHACK_RNGLOG_DISP: process.env.NETHACK_RNGLOG_DISP || '1',
    },
  });

  if (child.status !== 0) {
    const detail = [child.stderr, child.stdout].filter(Boolean).join('\n').trim();
    throw new Error(`${traceSpec.slug}: recorder exit ${child.status}\n${detail}`);
  }
  canonicalizeRecordedSession(outputPath);
  return { slug: traceSpec.slug, inputPath, outputPath };
}

function canonicalizeRecordedSession(outputPath) {
  const session = JSON.parse(readFileSync(outputPath, 'utf8'));
  let changed = false;
  const normalizeScreen = (screen) => String(screen || '').replace(/^\/.*\/\.nethackrc$/gm, canonicalJsRcDisplayPath);
  for (const segment of session.segments || []) {
    for (const step of segment.steps || []) {
      if (typeof step.screen !== 'string') continue;
      const next = normalizeScreen(step.screen);
      if (next !== step.screen) {
        step.screen = next;
        changed = true;
      }
    }
    for (const frame of segment.animation_frames || []) {
      if (typeof frame.screen !== 'string') continue;
      const next = normalizeScreen(frame.screen);
      if (next !== frame.screen) {
        frame.screen = next;
        changed = true;
      }
    }
  }
  if (changed) writeFileSync(outputPath, `${JSON.stringify(session)}\n`);
}

function coverageSummary(entries) {
  const bySource = {};
  const byTag = {};
  let segments = 0;
  let moves = 0;
  for (const entry of entries) {
    const source = String(entry.source || '').split(':')[0];
    bySource[source] = (bySource[source] || 0) + 1;
    for (const tag of entry.tags || []) byTag[tag] = (byTag[tag] || 0) + 1;
    for (const segment of entry.segments || []) {
      segments++;
      moves += segment.moves || 0;
    }
  }
  return {
    sessions: entries.length,
    segments,
    moveChars: moves,
    bySource: Object.fromEntries(Object.entries(bySource).sort((a, b) => a[0].localeCompare(b[0]))),
    byTag: Object.fromEntries(Object.entries(byTag).sort((a, b) => a[0].localeCompare(b[0]))),
  };
}

function runTool(label, args, opts) {
  console.error(`[${label}] node ${args.join(' ')}`);
  const child = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
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
      });
      process.stderr.write(result.skipped ? `SKIP ${result.skipped}\n` : 'OK\n');
    } catch (error) {
      manifest.failures.push({
        slug: traceSpec.slug,
        source: traceSpec.source,
        message: error.message,
      });
      process.stderr.write(`FAIL ${error.message.split('\n')[0]}\n`);
      if (!opts.keepGoing) break;
    }
    manifest.coverage = coverageSummary(manifest.entries);
    writeFileSync(join(opts.outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  manifest.coverage = coverageSummary(manifest.entries);
  writeFileSync(join(opts.outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.error(`[trace] wrote ${join(opts.outDir, 'manifest.json')}`);

  if (manifest.failures.length) {
    console.error(`[trace] ${manifest.failures.length} recorder failures`);
    for (const failure of manifest.failures.slice(0, 10)) {
      console.error(`  ${failure.slug}: ${failure.message.split('\n')[0]}`);
    }
    if (!opts.keepGoing) process.exitCode = 1;
  }

  if (opts.score) runTool('analyze', ['tools/analyze-failures.mjs', opts.outDir], opts);
  if (opts.strict) runTool('strict', ['tools/strict-score.mjs', opts.outDir], opts);
  for (const check of opts.checks) {
    runTool(`check:${check}`, ['tools/check-traces.mjs', '--mode', check, opts.outDir], opts);
  }
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
