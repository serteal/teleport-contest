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

#include "hack.h"
#include "dlb.h"
#include "tcap.h"
#include "wintty.h"

#include <setjmp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define NHJS_RNG_LOG_PATH "/rng.log"
/*
 * HOME of the game's process; NetHack reads $HOME/.nethackrc.  The path
 * is shown in the options help pager, so it is kept exactly as it is.
 */
#define NHJS_HOME \
    "/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results"
#define NHJS_RC_PATH NHJS_HOME "/.nethackrc"

extern int nhjs_unix_main(int, char **);
extern void rng_log_init(void);
extern void moveloop_preamble(boolean);
extern void maybe_do_tutorial(void);
extern void nhjs_install_data_files(void);

char erase_char = '\177';
char intr_char = '\003';
char kill_char = '\025';

/* host callbacks (js/rt/port.js binds them to js/host/boot.js) */
extern int nhjs_js_key(int index);
extern void nhjs_js_capture(int anim, int seq, int anim_id, int cx, int cy,
                            const char *screen);
extern void nhjs_js_boundary(int where);

enum nhjs_phase {
    NHJS_NOT_STARTED = 0, /* nhjs_unix_main() has not been called */
    NHJS_IN_MAIN,         /* inside main(): options, character selection */
    NHJS_ENTERED,         /* main() reached moveloop() */
    NHJS_LOOP             /* moveloop_core() iterations */
};

#define NHJS_JUMP_EXHAUSTED 1
#define NHJS_JUMP_ENTERED 2

static enum nhjs_phase nhjs_phase;
static boolean nhjs_resuming;
static boolean nhjs_jump_active;
static jmp_buf nhjs_jmp;
static int nhjs_key_index;

static char *nhjs_seed_text;
static char *nhjs_datetime;
static char *nhjs_rc;
static char nhjs_arg0[] = "nethack";
static char nhjs_arg1[] = "-u";
static char *nhjs_argv[4];

static char *
nhjs_strdup(const char *s)
{
    size_t len = strlen(s ? s : "");
    char *copy = (char *) malloc(len + 1);

    if (copy)
        memcpy(copy, s ? s : "", len + 1);
    return copy;
}

static void
nhjs_mkdir_parents(const char *path)
{
    char tmp[BUFSZ];
    char *p;

    (void) strncpy(tmp, path, sizeof tmp - 1);
    tmp[sizeof tmp - 1] = '\0';
    for (p = tmp + 1; *p; ++p) {
        if (*p != '/')
            continue;
        *p = '\0';
        (void) mkdir(tmp, 0777);
        *p = '/';
    }
}

static void
nhjs_write_file(const char *path, const char *text)
{
    FILE *fp;

    nhjs_mkdir_parents(path);
    fp = fopen(path, "wb");
    if (!fp)
        return;
    if (text && *text)
        (void) fwrite(text, 1, strlen(text), fp);
    fclose(fp);
}

static void
nhjs_touch_file(const char *path)
{
    FILE *fp = fopen(path, "ab");

    if (fp)
        fclose(fp);
}

/* Session parameters; must be called before nhjs_install_files(). */
void
nhjs_session_init(const char *seed_text, const char *datetime,
                  const char *nethackrc, const char *name)
{
    free(nhjs_seed_text);
    free(nhjs_datetime);
    free(nhjs_rc);
    nhjs_seed_text = nhjs_strdup((seed_text && *seed_text) ? seed_text : "0");
    nhjs_datetime = nhjs_strdup(datetime);
    nhjs_rc = nhjs_strdup(nethackrc);
    nhjs_argv[0] = nhjs_arg0;
    nhjs_argv[1] = nhjs_arg1;
    nhjs_argv[2] = nhjs_strdup(name); /* `nethack -u <name>` */
    nhjs_argv[3] = (char *) 0;
    nhjs_phase = NHJS_NOT_STARTED;
    nhjs_key_index = 0;
    nhjs_jump_active = FALSE;

    /* the process environment; no USER/LOGNAME, so getlogin() fails */
    unsetenv("USER");
    unsetenv("LOGNAME");
    unsetenv("NETHACKOPTIONS");
    unsetenv("TERM");
    setenv("HOME", NHJS_HOME, 1);
    setenv("TZ", "UTC", 1); /* calendar.c renders New York time itself */
    setenv("NETHACKDIR", "/", 1);
    setenv("HACKDIR", "/", 1);
    setenv("MAIL", "/var/mail/nhjs", 1); /* an empty mail spool */
    setenv("NETHACK_RNGLOG", NHJS_RNG_LOG_PATH, 1);
    setenv("NETHACK_RNGLOG_DISP", "1", 1);
    setenv("NETHACK_NO_DELAY", "1", 1);
    setenv("NOMUX_MARKERS", "1", 1);
    setenv("NHJS_SUPPRESS_NOMUX_MARKERS", "1", 1);
    setenv("NETHACK_SEED", nhjs_seed_text, 1);
    if (*nhjs_datetime)
        setenv("NETHACK_FIXED_DATETIME", nhjs_datetime, 1);
    else
        unsetenv("NETHACK_FIXED_DATETIME");
}

/* Game data files (dat/), then the playground, sysconf and
   $HOME/.nethackrc.  The JS host restores the files a
   previous segment left (saves, bones, record, ...) after this. */
void
nhjs_install_data(void)
{
    nhjs_install_data_files();
}

void
nhjs_install_files(void)
{
    static const char sysconf[] = "WIZARDS=*\n"
                                  "EXPLORERS=*\n"
                                  "SHELLERS=*\n"
                                  "MAXPLAYERS=10\n";

    (void) mkdir("/save", 0777);
    nhjs_touch_file("/record");
    nhjs_touch_file("/logfile");
    nhjs_touch_file("/xlogfile");
    nhjs_touch_file("/livelog");
    nhjs_write_file("/sysconf", sysconf);
    nhjs_write_file(NHJS_RC_PATH, nhjs_rc ? nhjs_rc : "");
}

/* moveloop() calls this instead of running the loop itself */
void
nhjs_moveloop_entry(boolean resuming)
{
    nhjs_resuming = resuming;
    nhjs_phase = NHJS_ENTERED;
    longjmp(nhjs_jmp, NHJS_JUMP_ENTERED);
}

/* top of every moveloop_core() iteration */
void
nhjs_moveloop_boundary(void)
{
    nhjs_js_boundary(1);
}

/* Run until the host runs out of keys (returns 0).  The game ending
   (exit(), abort()) throws instead. */
int
nhjs_session_run(void)
{
    int jump;

    nhjs_jump_active = TRUE;
    jump = setjmp(nhjs_jmp);
    if (jump == NHJS_JUMP_EXHAUSTED) {
        nhjs_jump_active = FALSE;
        return 0;
    }
    if (nhjs_phase == NHJS_NOT_STARTED) {
        nhjs_phase = NHJS_IN_MAIN;
        (void) nhjs_unix_main(3, nhjs_argv);
    }
    if (nhjs_phase == NHJS_ENTERED) {
        nhjs_js_boundary(0);
        moveloop_preamble(nhjs_resuming);
        if (!nhjs_resuming)
            maybe_do_tutorial();
        nhjs_phase = NHJS_LOOP;
    }
    for (;;)
        moveloop_core();
    /*NOTREACHED*/
    return 1;
}

int
nhjs_key_position(void)
{
    return nhjs_key_index;
}

int
nhjs_started(void)
{
    return nhjs_phase >= NHJS_ENTERED;
}

const char *
nhjs_rng_log_path(void)
{
    return NHJS_RNG_LOG_PATH;
}

/* tgetch(): the next input byte, verbatim */
int
nhjs_tgetch(void)
{
    int ch = nhjs_js_key(nhjs_key_index);

    if (ch < 0) {
        if (nhjs_jump_active)
            longjmp(nhjs_jmp, NHJS_JUMP_EXHAUSTED);
        return EOF;
    }
    nhjs_key_index++;
    return ch & 0xff;
}

void
nhjs_tty_capture_boundary(const char *kind, int seq, int anim, int cx, int cy,
                          const char *screen)
{
    if (!kind)
        return;
    if (!strcmp(kind, "anim"))
        nhjs_js_capture(1, seq, anim, cx, cy, screen ? screen : "");
    else if (!strcmp(kind, "input"))
        nhjs_js_capture(0, seq, anim, cx, cy, screen ? screen : "");
}

/*
 * getlock() from sys/unix/unixunix.c.  A lock left behind by an earlier
 * segment belongs to a process that no longer exists, so veryold() (an
 * INSURANCE build: no size check) finds it stale once it has read a pid
 * from it, and the old game is erased without a prompt.
 */
static boolean
nhjs_lock_is_stale(const char *fq_lock)
{
    struct stat st;

    return !stat(fq_lock, &st) && st.st_size >= (off_t) sizeof (int);
}

static int
nhjs_eraseoldlocks(void)
{
    int i;

    program_state.preserve_locks = 0;
    for (i = 1; i <= MAXDUNGEON * MAXLEVEL + 1; i++) {
        set_levelfile_name(gl.lock, i);
        (void) unlink(fqname(gl.lock, LEVELPREFIX, 0));
    }
    set_levelfile_name(gl.lock, 0);
    if (unlink(fqname(gl.lock, LEVELPREFIX, 0)))
        return 0;
    return 1;
}

void
getlock(void)
{
    static const char destroy_old_game_prompt[] =
        "There is already a game in progress under your name.  Destroy old game?";
    int i = 0, c;
    const char *fq_lock;
    FILE *fp;

    if (!gl.locknum)
        Sprintf(gl.lock, "%u%s", (unsigned) getuid(), svp.plname);
    regularize(gl.lock);
    set_levelfile_name(gl.lock, 0);

    if (gl.locknum) {
        if (gl.locknum > 25)
            gl.locknum = 25;
        do {
            gl.lock[0] = 'a' + i++;
            fq_lock = fqname(gl.lock, LEVELPREFIX, 0);
            if (access(fq_lock, F_OK))
                goto gotlock;
            if (nhjs_lock_is_stale(fq_lock) && nhjs_eraseoldlocks())
                goto gotlock;
        } while (i < gl.locknum);
        error("Too many hacks running now.");
    } else {
        fq_lock = fqname(gl.lock, LEVELPREFIX, 0);
        if (access(fq_lock, F_OK))
            goto gotlock;
        if (nhjs_lock_is_stale(fq_lock) && nhjs_eraseoldlocks())
            goto gotlock;
        c = iflags.window_inited ? y_n(destroy_old_game_prompt) : 'n';
        if (c == 'y' || c == 'Y') {
            if (nhjs_eraseoldlocks())
                goto gotlock;
            error("Couldn't destroy old game.");
        } else {
            error("%s", "");
        }
    }

 gotlock:
    fp = fopen(fq_lock, "wb");
    if (!fp)
        error("cannot creat lock file (%s).", fq_lock);
    if (fwrite((genericptr_t) &svh.hackpid, sizeof svh.hackpid, 1, fp) != 1)
        error("cannot write lock (%s)", fq_lock);
    if (fclose(fp))
        error("cannot close lock (%s)", fq_lock);
}

void
getwindowsz(void)
{
    CO = 80;
    LI = 24;
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
void
gettty(void)
{
    erase_char = '\177';
    kill_char = '\025';
    intr_char = '\003';
    getwindowsz();
}

void
settty(const char *s)
{
    if (WINDOWPORT(tty))
        term_end_screen();
    if (s)
        raw_print(s);
    /* the restored mode is the zeroed inittyb: no ECHO, no ICANON */
    iflags.echo = OFF;
    iflags.cbreak = ON;
}

void
setftty(void)
{
    iflags.cbreak = ON;
    iflags.echo = OFF;
    if (WINDOWPORT(tty))
        term_start_screen();
}

#ifdef ENHANCED_SYMBOLS
void
tty_utf8graphics_fixup(void)
{
}
#endif
