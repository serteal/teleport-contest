/* nhjs_tty_api.c - session driver of the port.
 *
 * A segment runs the real sys/unix/unixmain.c main() (renamed
 * nhjs_unix_main) as `nethack -u <name>`, in a fixed process environment.
 * The game is single threaded and synchronous:
 *
 *   - Keys are pulled one byte at a time from the JS host
 *     (nhjs_js_key(index)); the read position lives here, in the heap.
 *     When the host has no byte at that position the read unwinds with
 *     longjmp() back to nhjs_session_run(), which returns 0.
 *   - Every NOMUX capture marker (an "input" frame each time the game is
 *     about to read a key, "anim" frames in between) is handed to
 *     nhjs_js_capture() as soon as it is produced.
 *   - main() hands the game loop over to nhjs_session_run() when it
 *     reaches moveloop(); from then on moveloop_core() is called from
 *     here, and nhjs_js_boundary() is called at the top of every
 *     iteration (and once before moveloop_preamble()).  These are the
 *     points from which a snapshot of the heap and filesystem can be
 *     resumed by simply calling nhjs_session_run() again.
 *
 * Exit paths (exit(), abort(), error()) end the segment by throwing out of
 * the engine; the JS host keeps every frame captured before that.
 */

export const NHJS_RNG_LOG_PATH = "/rng.log";
/*
 * HOME of the game's process; NetHack reads $HOME/.nethackrc.  The path
 * is shown in the options help pager, so it is kept exactly as it is.
 */
export const NHJS_HOME = "/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results";

export const NHJS_RC_PATH = "/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results/.nethackrc";

global_scalar("erase_char", char, ord('\x7f'));
global_scalar("intr_char", char, ord('\x03'));
global_scalar("kill_char", char, ord('\x15'));

/* host callbacks (js/rt/port.js binds them to js/host/boot.js) */

    const NHJS_NOT_STARTED = 0;
    const NHJS_IN_MAIN = NHJS_NOT_STARTED + 1;
    const NHJS_ENTERED = NHJS_IN_MAIN + 1;
    const NHJS_LOOP = NHJS_ENTERED + 1;

export const NHJS_JUMP_EXHAUSTED = 1;
export const NHJS_JUMP_ENTERED = 2;

const nhjs_phase = static_var("nhjs_phase", unsigned);
const nhjs_resuming = static_var("nhjs_resuming", schar);
const nhjs_jump_active = static_var("nhjs_jump_active", schar);
const nhjs_jmp = static_array("nhjs_jmp", jmp_buf.of, jmp_buf.n);
const nhjs_key_index = static_var("nhjs_key_index", int);

const nhjs_seed_text = static_var("nhjs_seed_text", ptr_to(char));
const nhjs_datetime = static_var("nhjs_datetime", ptr_to(char));
const nhjs_rc = static_var("nhjs_rc", ptr_to(char));
const nhjs_arg0 = init_string(static_array("nhjs_arg0", char, sizeof_string("nethack")), _("nethack"), true);
const nhjs_arg1 = init_string(static_array("nhjs_arg1", char, sizeof_string("-u")), _("-u"), true);
const nhjs_argv = static_array("nhjs_argv", ptr_to(char), 4);

function nhjs_strdup(s) { /* char * */
    let len = strlen(s ? s : _(""));
    let copy = malloc(unsigned(len + 1));

    if (copy)
        memcpy(copy, s ? s : _(""), unsigned(len + 1));
    return copy;
}

function nhjs_mkdir_parents(path) { /* void */
    const $frame = stack_frame(); try {
    let tmp = stack_array(char, BUFSZ);
    let p;

    strncpy(tmp, path, sizeof(array_of(char, BUFSZ)) - 1);
    chars[tmp + (sizeof(array_of(char, BUFSZ)) - 1)] = ord('\0');
    for (p = tmp + 1; chars[p]; ++p) {
        if (chars[p] != ord('/'))
            continue;
        chars[p] = ord('\0');
        mkdir(tmp, 0o777);
        chars[p] = ord('/');
    }
    } finally { stack_pop($frame); }
}

function nhjs_write_file(path, text) { /* void */
    let fp;

    nhjs_mkdir_parents(path);
    fp = fopen(path, _("wb"));
    if (!fp)
        return;
    if (text && chars[text])
        fwrite(text, 1, strlen(text), fp);
    fclose(fp);
}

function nhjs_touch_file(path) { /* void */
    let fp = fopen(path, _("ab"));

    if (fp)
        fclose(fp);
}

/* Session parameters; must be called before nhjs_install_files(). */
export function nhjs_session_init(seed_text, datetime,
                  nethackrc, name) { /* void */
    free(nhjs_seed_text[0]);
    free(nhjs_datetime[0]);
    free(nhjs_rc[0]);
    nhjs_seed_text[0] = nhjs_strdup((seed_text && chars[seed_text]) ? seed_text : _("0"));
    nhjs_datetime[0] = nhjs_strdup(datetime);
    nhjs_rc[0] = nhjs_strdup(nethackrc);
    nhjs_argv[0] = nhjs_arg0;
    nhjs_argv[1] = nhjs_arg1;
    nhjs_argv[2] = nhjs_strdup(name); /* `nethack -u <name>` */
    nhjs_argv[3] = 0;
    nhjs_phase[0] = NHJS_NOT_STARTED;
    nhjs_key_index[0] = 0;
    nhjs_jump_active[0] = FALSE;

    /* the process environment; no USER/LOGNAME, so getlogin() fails */
    unsetenv(_("USER"));
    unsetenv(_("LOGNAME"));
    unsetenv(_("NETHACKOPTIONS"));
    unsetenv(_("TERM"));
    setenv(_("HOME"), _(NHJS_HOME), 1);
    setenv(_("TZ"), _("UTC"), 1); /* calendar.c renders New York time itself */
    setenv(_("NETHACKDIR"), _("/"), 1);
    setenv(_("HACKDIR"), _("/"), 1);
    setenv(_("MAIL"), _("/var/mail/nhjs"), 1); /* an empty mail spool */
    setenv(_("NETHACK_RNGLOG"), _(NHJS_RNG_LOG_PATH), 1);
    setenv(_("NETHACK_RNGLOG_DISP"), _("1"), 1);
    setenv(_("NETHACK_NO_DELAY"), _("1"), 1);
    setenv(_("NOMUX_MARKERS"), _("1"), 1);
    setenv(_("NHJS_SUPPRESS_NOMUX_MARKERS"), _("1"), 1);
    setenv(_("NETHACK_SEED"), nhjs_seed_text[0], 1);
    if (chars[nhjs_datetime[0]])
        setenv(_("NETHACK_FIXED_DATETIME"), nhjs_datetime[0], 1);
    else
        unsetenv(_("NETHACK_FIXED_DATETIME"));
}

/* Game data files (dat/), then the playground, sysconf and
   $HOME/.nethackrc.  The JS host restores the files a
   previous segment left (saves, bones, record, ...) after this. */
export function nhjs_install_data() { /* void */
    nhjs_install_data_files();
}

export function nhjs_install_files() { /* void */
    let sysconf = init_string(static_array("nhjs_install_files.sysconf", char, sizeof_string("WIZARDS=*\n" + "EXPLORERS=*\n" + "SHELLERS=*\n" + "MAXPLAYERS=10\n")), _("WIZARDS=*\n" +
                                  "EXPLORERS=*\n" +
                                  "SHELLERS=*\n" +
                                  "MAXPLAYERS=10\n"), true);

    mkdir(_("/save"), 0o777);
    nhjs_touch_file(_("/record"));
    nhjs_touch_file(_("/logfile"));
    nhjs_touch_file(_("/xlogfile"));
    nhjs_touch_file(_("/livelog"));
    nhjs_write_file(_("/sysconf"), sysconf);
    nhjs_write_file(_(NHJS_RC_PATH), nhjs_rc[0] ? nhjs_rc[0] : _(""));
}

/* moveloop() calls this instead of running the loop itself */
export function nhjs_moveloop_entry(resuming) { /* void */
    nhjs_resuming[0] = resuming;
    nhjs_phase[0] = NHJS_ENTERED;
    longjmp(nhjs_jmp[0], NHJS_JUMP_ENTERED);
}

/* top of every moveloop_core() iteration */
export function nhjs_moveloop_boundary() { /* void */
    nhjs_js_boundary(1);
}

/* Run until the host runs out of keys (returns 0).  The game ending
   (exit(), abort()) throws instead. */
export function nhjs_session_run() { /* int */
    let $jv = 0, $jb = null, $goto = null;
    var jump;

    nhjs_jump_active[0] = TRUE;
    $goto_setjmp: for (;;) { try { switch ($goto) { default: case "setjmp": $goto = null; jump = ($jb = nhjs_jmp[0], $jv); $jv = 0;
    if (jump == NHJS_JUMP_EXHAUSTED) {
        nhjs_jump_active[0] = FALSE;
        return 0;
    }
    if (nhjs_phase[0] == NHJS_NOT_STARTED) {
        nhjs_phase[0] = NHJS_IN_MAIN;
        nhjs_unix_main(3, nhjs_argv);
    }
    if (nhjs_phase[0] == NHJS_ENTERED) {
        nhjs_js_boundary(0);
        moveloop_preamble(nhjs_resuming[0]);
        if (!nhjs_resuming[0])
            maybe_do_tutorial();
        nhjs_phase[0] = NHJS_LOOP;
    }
    for (;;)
        moveloop_core();
    /*NOTREACHED*/
    return 1; } break; } catch ($e) { $jv = setjmp_caught($e, $jb); $goto = "setjmp"; continue $goto_setjmp; } }
}

export function nhjs_key_position() { /* int */
    return nhjs_key_index[0];
}

export function nhjs_started() { /* int */
    return +(nhjs_phase[0] >= NHJS_ENTERED);
}

export function nhjs_rng_log_path() { /* const char * */
    return _(NHJS_RNG_LOG_PATH);
}

/* tgetch(): the next input byte, verbatim */
export function nhjs_tgetch() { /* int */
    let ch = nhjs_js_key(nhjs_key_index[0]);

    if (ch < 0) {
        if (nhjs_jump_active[0])
            longjmp(nhjs_jmp[0], NHJS_JUMP_EXHAUSTED);
        return EOF;
    }
    nhjs_key_index[0]++;
    return ch & 0xff;
}

export function nhjs_tty_capture_boundary(kind, seq, anim, cx, cy,
                          screen) { /* void */
    if (!kind)
        return;
    if (!strcmp(kind, _("anim")))
        nhjs_js_capture(1, seq, anim, cx, cy, screen ? screen : _(""));
    else if (!strcmp(kind, _("input")))
        nhjs_js_capture(0, seq, anim, cx, cy, screen ? screen : _(""));
}

/*
 * getlock() from sys/unix/unixunix.c.  A lock left behind by an earlier
 * segment belongs to a process that no longer exists, so veryold() (an
 * INSURANCE build: no size check) finds it stale once it has read a pid
 * from it, and the old game is erased without a prompt.
 */
function nhjs_lock_is_stale(fq_lock) { /* boolean */
    const $frame = stack_frame(); try {
    let st = stack_struct(struct_stat);

    return +(!stat(fq_lock, st) && st.st_size >= sizeof(int));
    } finally { stack_pop($frame); }
}

function nhjs_eraseoldlocks() { /* int */
    let i;

    program_state.preserve_locks = 0;
    for (i = 1; i <= MAXDUNGEON * MAXLEVEL + 1; i++) {
        set_levelfile_name(gl.lock, i);
        unlink(fqname(gl.lock, LEVELPREFIX, 0));
    }
    set_levelfile_name(gl.lock, 0);
    if (unlink(fqname(gl.lock, LEVELPREFIX, 0)))
        return 0;
    return 1;
}

export function getlock() { /* void */
    var destroy_old_game_prompt = init_string(static_array("getlock.destroy_old_game_prompt", char, sizeof_string("There is already a game in progress under your name.  Destroy old game?")), _("There is already a game in progress under your name.  Destroy old game?"), true);

    var i = 0, c;
    var fq_lock;
    var fp;

    if (!gl.locknum)
        sprintf(gl.lock, _("%u%s"), getuid(), svp.plname);
    regularize(gl.lock);
    set_levelfile_name(gl.lock, 0);

    gotlock: { if (gl.locknum) {
        if (gl.locknum > 25)
            gl.locknum = 25;
        do {
            chars[gl.lock + 0] = ord('a') + i++;
            fq_lock = fqname(gl.lock, LEVELPREFIX, 0);
            if (access(fq_lock, F_OK))
                break gotlock;;
            if (nhjs_lock_is_stale(fq_lock) && nhjs_eraseoldlocks())
                break gotlock;;
        } while (i < gl.locknum);
        error(_("Too many hacks running now."));
    } else {
        fq_lock = fqname(gl.lock, LEVELPREFIX, 0);
        if (access(fq_lock, F_OK))
            break gotlock;;
        if (nhjs_lock_is_stale(fq_lock) && nhjs_eraseoldlocks())
            break gotlock;;
        c = iflags.window_inited ? y_n(destroy_old_game_prompt) : ord('n');
        if (c == ord('y') || c == ord('Y')) {
            if (nhjs_eraseoldlocks())
                break gotlock;;
            error(_("Couldn't destroy old game."));
        } else {
            error(_("%s"), _(""));
        }
    }
 }
    fp = fopen(fq_lock, _("wb"));
    if (!fp)
        error(_("cannot creat lock file (%s)."), fq_lock);
    if (fwrite(addr_of(ref_of(svh, "hackpid")), sizeof(int), 1, fp) != 1)
        error(_("cannot write lock (%s)"), fq_lock);
    if (fclose(fp))
        error(_("cannot close lock (%s)"), fq_lock);
}

export function getwindowsz() { /* void */
    gt.tc_gbl_data.tc_CO = 80;
    gt.tc_gbl_data.tc_LI = 24;
}

/*
 * Terminal modes (sys/share/unixtty.c).  The game's stdin is not a
 * terminal: every tcgetattr()/tcsetattr() fails and
 * silently does nothing, so the saved state `inittyb' stays all zero
 * except for the control characters that gettty() seeds.  Hence:
 *   gettty():  erase ^?, kill ^U, intr ^C; ospeed = speednum(0) = 0;
 *              the window size ioctl fails too, so LI and CO keep
 *              the 24x80 of the terminal description.
 *   settty():  iflags.echo = (0 & ECHO) = OFF,
 *              iflags.cbreak = !(0 & ICANON) = ON.
 *   setftty(): iflags.cbreak = ON, iflags.echo = OFF.
 *   intron(), introff(), setioctls(): only change termios (no effect).
 * So once the window system is up, cbreak is ON and echo OFF at all times;
 * getret()/xwaitforspace() behave as in cbreak mode even after settty().
 */
export function gettty() { /* void */
    erase_char = ord('\x7f');
    kill_char = ord('\x15');
    intr_char = ord('\x03');
    getwindowsz();
}

export function settty(s) { /* void */
    if ((windowprocs.wp_id == wp_tty))
        term_end_screen();
    if (s)
        raw_print()(s);
    /* the restored mode is the zeroed inittyb: no ECHO, no ICANON */
    iflags.echo = OFF;
    iflags.cbreak = ON;
}

export function setftty() { /* void */
    iflags.cbreak = ON;
    iflags.echo = OFF;
    if ((windowprocs.wp_id == wp_tty))
        term_start_screen();
}

export function tty_utf8graphics_fixup() { /* void */
}

import { BUFSZ, FALSE, MAXDUNGEON, MAXLEVEL, TRUE } from "../../src/global.h.js";
import { LEVELPREFIX, OFF, ON } from "../../src/hack.h.js";
import { y_n } from "../../src/hack.h.macros.js";
import { wp_tty } from "../../src/winprocs.h.js";
import { raw_print } from "../../src/winprocs.h.macros.js";
import { jmp_buf, struct_stat } from "../../libc/records.js";
import { char, int, ord, schar, sizeof, sizeof_string, unsigned } from "../../rt/ctypes.js";
import { global_scalar } from "../../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../../rt/heap.js";
import {
    EOF, F_OK, access, fclose, fopen, free, fwrite, getuid, longjmp, malloc, memcpy, mkdir, setenv,
    sprintf, stat, strcmp, strlen, strncpy, unlink, unsetenv,
} from "../../rt/libc.js";
import {
    init_string, stack_array, stack_struct, static_array, static_var,
} from "../../rt/locals.js";
import {
    nhjs_install_data_files, nhjs_js_boundary, nhjs_js_capture, nhjs_js_key,
} from "../../rt/port.js";
import { setjmp_caught } from "../../rt/setjmp.js";
import { _ } from "../../rt/strings.js";
import { addr_of, array_of, ptr_to, ref_of } from "../../rt/struct.js";
import { maybe_do_tutorial, moveloop_core, moveloop_preamble } from "../../src/allmain.js";
import { gl, gt, iflags, program_state, svh, svp } from "../../src/decl.js";
import { fqname, set_levelfile_name } from "../../src/files.js";
import { windowprocs } from "../../src/windows.js";
import { error, regularize } from "./nhjs_host.js";
import { nhjs_unix_main } from "../unix/unixmain.js";
import { term_end_screen, term_start_screen } from "../../win/tty/termcap.js";
