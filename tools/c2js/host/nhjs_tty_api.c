#include "hack.h"
#include "dlb.h"
#include "tcap.h"
#include "wintty.h"

#include <emscripten/emscripten.h>
#include <setjmp.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define NHJS_MAX_SCREENS 8192
#define NHJS_RNG_LOG_PATH "/rng.log"
/*
 * Recorder ABI compatibility: the public traces were captured with this rc
 * path visible in NetHack's options-help pager.  The exact string length
 * affects tty line wrapping, so the JS engine must use the same display path
 * even though the file lives inside Emscripten's in-memory FS.
 */
#define NHJS_RC_PATH "/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/results/.nethackrc"

extern void rng_log_init(void);
extern void moveloop_preamble(boolean);
extern void nhjs_set_seed(unsigned long seed);
extern void nhjs_set_seed_text(const char *seed_text);
extern void nhjs_install_data_files(void);
extern boolean whoami(void);
extern NHFILE *restore_saved_game(void);
extern int dorecover(NHFILE *);

char erase_char = '\177';
char intr_char = '\003';
char kill_char = '\025';

static boolean nhjs_game_started;
static boolean nhjs_input_exhausted_flag;
static boolean nhjs_jump_active;
static int nhjs_phase;
static jmp_buf nhjs_input_jmp;

static char *nhjs_moves;
static char *nhjs_moves_next;
static char *nhjs_datetime;
static char *nhjs_rc;
static char *nhjs_seed_text;
static char *nhjs_screens[NHJS_MAX_SCREENS];
static int nhjs_screen_cursor_cols[NHJS_MAX_SCREENS];
static int nhjs_screen_cursor_rows[NHJS_MAX_SCREENS];
static int nhjs_screen_count;
static char *nhjs_animation_screens[NHJS_MAX_SCREENS];
static int nhjs_animation_cursor_cols[NHJS_MAX_SCREENS];
static int nhjs_animation_cursor_rows[NHJS_MAX_SCREENS];
static int nhjs_animation_seqs[NHJS_MAX_SCREENS];
static int nhjs_animation_ids[NHJS_MAX_SCREENS];
static int nhjs_animation_count;
static int nhjs_expected_screen_count;
static int nhjs_cursor_col;
static int nhjs_cursor_row;

static void
nhjs_stop_session(void)
{
    if (u.uhp <= 0)
        clearlocks();
    nhjs_input_exhausted_flag = TRUE;
    if (nhjs_jump_active)
        longjmp(nhjs_input_jmp, 1);
}

static char *
nhjs_strdup_or_empty(const char *s)
{
    size_t len;
    char *copy;

    if (!s)
        s = "";
    len = strlen(s);
    copy = (char *) malloc(len + 1);
    if (!copy)
        return (char *) 0;
    memcpy(copy, s, len + 1);
    return copy;
}

static boolean
nhjs_rc_has_name_option(void)
{
    const char *p = nhjs_rc;

    while (p && *p) {
        if (!strncmpi(p, "name:", 5))
            return TRUE;
        if (!strncmpi(p, "OPTIONS=", 8)) {
            const char *q = p + 8;

            while (*q && *q != '\n') {
                if (!strncmpi(q, "name:", 5))
                    return TRUE;
                ++q;
            }
        }
        while (*p && *p != '\n')
            ++p;
        if (*p == '\n')
            ++p;
    }
    return FALSE;
}

static void
nhjs_free_screens(void)
{
    int i;

    for (i = 0; i < nhjs_screen_count; ++i) {
        free(nhjs_screens[i]);
        nhjs_screens[i] = (char *) 0;
    }
    nhjs_screen_count = 0;
    for (i = 0; i < nhjs_animation_count; ++i) {
        free(nhjs_animation_screens[i]);
        nhjs_animation_screens[i] = (char *) 0;
    }
    nhjs_animation_count = 0;
}

static void
nhjs_mkdir_parent_dirs(const char *path)
{
    char tmp[BUFSZ];
    char *p;

    if (!path || !*path)
        return;
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

    nhjs_mkdir_parent_dirs(path);
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

static void
nhjs_prepare_runtime_files(void)
{
    (void) mkdir("/save", 0777);
    (void) mkdir("save", 0777);
    nhjs_touch_file("/record");
    nhjs_touch_file("record");
    nhjs_touch_file("/logfile");
    nhjs_touch_file("logfile");
    nhjs_touch_file("/xlogfile");
    nhjs_touch_file("xlogfile");
    nhjs_touch_file("/livelog");
    nhjs_touch_file("livelog");
}

static void
nhjs_write_rc_files(void)
{
    const char *sysconf =
        "WIZARDS=*\n"
        "EXPLORERS=*\n"
        "SHELLERS=*\n"
        "MAXPLAYERS=10\n";

    nhjs_write_file("/sysconf", sysconf);
    nhjs_write_file("sysconf", sysconf);
    nhjs_write_file(NHJS_RC_PATH, nhjs_rc ? nhjs_rc : "");
}

static void
nhjs_wd_message(void)
{
    if (iflags.wiz_error_flag) {
        if (sysopt.wizards && sysopt.wizards[0]) {
            char *tmp = build_english_list(sysopt.wizards);

            pline("Only user%s %s may access debug (wizard) mode.",
                  strchr(sysopt.wizards, ' ') ? "s" : "", tmp);
            free(tmp);
        } else {
            You("cannot access debug (wizard) mode.");
        }
        wizard = FALSE;
        if (!iflags.explore_error_flag)
            pline("Entering explore/discovery mode instead.");
    } else if (iflags.explore_error_flag) {
        You("cannot access explore mode.");
        discover = iflags.deferred_X = FALSE;
    } else if (discover) {
        You("are in non-scoring explore/discovery mode.");
    }
}

static void
nhjs_apply_locknum_options(void)
{
#ifdef MAX_NR_OF_PLAYERS
    if (!gl.locknum || gl.locknum > MAX_NR_OF_PLAYERS)
        gl.locknum = MAX_NR_OF_PLAYERS;
#endif
#ifdef SYSCF
    if (!gl.locknum || (sysopt.maxplayers && gl.locknum > sysopt.maxplayers))
        gl.locknum = sysopt.maxplayers;
#endif
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
            fp = fopen(fq_lock, "rb");
            if (!fp)
                goto gotlock;
            fclose(fp);
        } while (i < gl.locknum);

        nhjs_stop_session();
        return;
    }

    fq_lock = fqname(gl.lock, LEVELPREFIX, 0);
    fp = fopen(fq_lock, "rb");
    if (fp) {
        fclose(fp);
        c = iflags.window_inited ? y_n(destroy_old_game_prompt) : 'n';
        if (c == 'y' || c == 'Y') {
            for (i = 1; i <= MAXDUNGEON * MAXLEVEL + 1; i++) {
                set_levelfile_name(gl.lock, i);
                (void) unlink(fqname(gl.lock, LEVELPREFIX, 0));
            }
            set_levelfile_name(gl.lock, 0);
            fq_lock = fqname(gl.lock, LEVELPREFIX, 0);
            if (unlink(fq_lock))
                error("Couldn't destroy old game.");
        } else {
            nhjs_stop_session();
            return;
        }
    }

 gotlock:
    fp = fopen(fq_lock, "wb");
    if (!fp)
        error("cannot create lock file (%s).", fq_lock);
    if (fwrite((genericptr_t) &svh.hackpid, sizeof svh.hackpid, 1, fp) != 1)
        error("cannot write lock (%s)", fq_lock);
    if (fclose(fp))
        error("cannot close lock (%s)", fq_lock);
}

static int
nhjs_next_input(void)
{
    unsigned char ch;

    if (!nhjs_moves_next || !*nhjs_moves_next) {
        nhjs_stop_session();
        return '\033';
    }
    ch = (unsigned char) *nhjs_moves_next++;
    if (ch == '\r')
        return '\n'; /* Recorder tty delivers Return to NetHack as LF. */
    if (ch == '\b')
        return '\177'; /* Browser/session traces encode Backspace as ^H. */
    return ch;
}

int
nhjs_tgetch(void)
{
    return nhjs_next_input();
}

void
nhjs_tty_capture_boundary(const char *kind, int seq, int anim, int cx, int cy,
                          const char *screen)
{
    if (!kind)
        return;
    if (!strcmp(kind, "anim")) {
        if (nhjs_animation_count >= NHJS_MAX_SCREENS)
            return;
        nhjs_animation_screens[nhjs_animation_count] =
            nhjs_strdup_or_empty(screen);
        if (nhjs_animation_screens[nhjs_animation_count]) {
            nhjs_animation_cursor_cols[nhjs_animation_count] = cx;
            nhjs_animation_cursor_rows[nhjs_animation_count] = cy;
            nhjs_animation_seqs[nhjs_animation_count] = seq;
            nhjs_animation_ids[nhjs_animation_count] = anim;
            nhjs_animation_count++;
        }
        nhjs_cursor_col = cx;
        nhjs_cursor_row = cy;
        return;
    }
    if (strcmp(kind, "input"))
        return;
    if (nhjs_expected_screen_count > 0
        && nhjs_screen_count >= nhjs_expected_screen_count) {
        nhjs_cursor_col = cx;
        nhjs_cursor_row = cy;
        return;
    }
    if (nhjs_screen_count >= NHJS_MAX_SCREENS)
        return;
    nhjs_screens[nhjs_screen_count] = nhjs_strdup_or_empty(screen);
    if (nhjs_screens[nhjs_screen_count]) {
        nhjs_screen_cursor_cols[nhjs_screen_count] = cx;
        nhjs_screen_cursor_rows[nhjs_screen_count] = cy;
        nhjs_screen_count++;
    }
    nhjs_cursor_col = cx;
    nhjs_cursor_row = cy;
}

void
getwindowsz(void)
{
    CO = 80;
    LI = 24;
}

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
    iflags.echo = ON;
    iflags.cbreak = OFF;
}

void
setftty(void)
{
    iflags.cbreak = ON;
    iflags.echo = OFF;
    if (WINDOWPORT(tty))
        term_start_screen();
}

void
chdirx(const char *dir, boolean wr)
{
    (void) wr;
    if (dir && *dir)
        (void) chdir(dir);
}

#ifdef ENHANCED_SYMBOLS
void
tty_utf8graphics_fixup(void)
{
}
#endif

static void
nhjs_maybe_do_tutorial(void)
{
    s_level *sp = find_level("tut-1");

    if (!sp)
        return;
    if (ask_do_tutorial()) {
        assign_level(&u.ucamefrom, &u.uz);
        iflags.nofollowers = TRUE;
        schedule_goto(&sp->dlevel, UTOTYPE_NONE,
                      "Entering the tutorial.", (char *) 0);
        deferred_goto();
        vision_recalc(0);
        docrt();
        iflags.nofollowers = FALSE;
    }
}

static void
nhjs_start_game(void)
{
    char *argv[2];
    int argc = 1;
    boolean plsel_once = FALSE, resuming = FALSE;
    NHFILE *nhfp = (NHFILE *) 0;

    argv[0] = (char *) "nethack";
    argv[1] = (char *) 0;
    nhjs_install_data_files();
    nhjs_write_rc_files();
    nhjs_prepare_runtime_files();
    nhjs_phase = 1;
    setenv("USER", "player", 1);
    setenv("LOGNAME", "player", 1);
    setenv("HOME", "/", 1);
    setenv("TZ", "UTC", 1);
    setenv("NETHACKOPTIONS", NHJS_RC_PATH, 1);
    setenv("NETHACKDIR", "/", 1);
    setenv("HACKDIR", "/", 1);
    setenv("NETHACK_RNGLOG", NHJS_RNG_LOG_PATH, 1);
    setenv("NETHACK_RNGLOG_DISP", "1", 1);
    setenv("NETHACK_NO_DELAY", "1", 1);
    setenv("NOMUX_MARKERS", "1", 1);
    setenv("NHJS_NOMUX_CAPTURE", "1", 1);
    setenv("NHJS_SUPPRESS_NOMUX_MARKERS", "1", 1);
    unsetenv("TERM");
    setenv("NETHACK_SEED", (nhjs_seed_text && *nhjs_seed_text)
                             ? nhjs_seed_text : "0", 1);
    if (nhjs_datetime && *nhjs_datetime)
        setenv("NETHACK_FIXED_DATETIME", nhjs_datetime, 1);
    else
        unsetenv("NETHACK_FIXED_DATETIME");

    CO = 80;
    LI = 24;
    nhjs_phase = 2;
    early_init(argc, argv);
    nhjs_phase = 3;
    rng_log_init();
    gh.hname = argv[0];
    svh.hackpid = 1;
    (void) umask(0777 & ~FCMASK);
    nhjs_phase = 4;
    choose_windows("tty");
    nhjs_phase = 5;
    initoptions();
    nhjs_apply_locknum_options();
    nhjs_phase = 6;
    (void) whoami();
    u.uhp = 1;
    program_state.preserve_locks = 1;
    sethanguphandler((void (*)(int)) 0);
    nhjs_phase = 7;
    init_nhwindows(&argc, argv);
    nhjs_phase = 8;
    set_playmode();
    if (wizard)
        gl.locknum = 0;
    gp.plnamelen = 0;
    if (!nhjs_rc_has_name_option())
        svp.plname[0] = '\0';
    plnamesuffix();
    nhjs_phase = 9;
    dlb_init();
    nhjs_phase = 10;
    vision_init();
    nhjs_phase = 11;
    init_sound_disp_gamewindows();

attempt_restore:
    if (*svp.plname) {
        getlock();
#if defined(HANGUPHANDLING)
        program_state.preserve_locks = 0;
#endif
    }

    if (*svp.plname && (nhfp = restore_saved_game()) != 0) {
        const char *fq_save = fqname(gs.SAVEF, SAVEPREFIX, 1);

        (void) chmod(fq_save, 0);
        if (ge.early_raw_messages)
            raw_print("Restoring save file...");
        else
            pline("Restoring save file...");
        mark_synch();
        if (dorecover(nhfp)) {
            resuming = TRUE;
            nhjs_wd_message();
            if (discover || wizard) {
                if (y_n("Do you want to keep the save file?") == 'n') {
                    (void) delete_savefile();
                } else {
                    (void) chmod(fq_save, FCMASK);
                    nh_compress(fq_save);
                }
            }
        }
        if (program_state.in_self_recover)
            program_state.in_self_recover = FALSE;
    }

    if (!resuming) {
        boolean neednewlock = !*svp.plname;

        nhjs_phase = 12;
        if (!iflags.renameinprogress || iflags.defer_plname || neednewlock) {
            if (!plsel_once)
                player_selection();
            plsel_once = TRUE;
            if (neednewlock && *svp.plname)
                goto attempt_restore;
            if (iflags.renameinprogress) {
                if (!gl.locknum) {
                    delete_levelfile(0);
                    getlock();
                }
                goto attempt_restore;
            }
        }
        nhjs_phase = 13;
        newgame();
        nhjs_wd_message();
    }

    nhjs_phase = 14;
    moveloop_preamble(resuming);
    nhjs_game_started = TRUE;
    nhjs_phase = 15;
    if (!resuming)
        nhjs_maybe_do_tutorial();
}

EMSCRIPTEN_KEEPALIVE
void
nhjs_session_init(const char *seed_text, const char *datetime,
                  const char *nethackrc, const char *moves)
{
    free(nhjs_moves);
    free(nhjs_datetime);
    free(nhjs_rc);
    free(nhjs_seed_text);
    nhjs_free_screens();
    nhjs_moves = nhjs_strdup_or_empty(moves);
    nhjs_datetime = nhjs_strdup_or_empty(datetime);
    nhjs_rc = nhjs_strdup_or_empty(nethackrc);
    nhjs_seed_text = nhjs_strdup_or_empty(seed_text);
    nhjs_moves_next = nhjs_moves;
    nhjs_expected_screen_count = nhjs_moves ? (int) strlen(nhjs_moves) + 1 : 1;
    nhjs_game_started = FALSE;
    nhjs_input_exhausted_flag = FALSE;
    nhjs_jump_active = FALSE;
    nhjs_phase = 0;
    nhjs_cursor_col = 0;
    nhjs_cursor_row = 0;
    nhjs_set_seed_text(nhjs_seed_text);
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_session_run(int max_iterations)
{
    int i;

    if (max_iterations <= 0)
        max_iterations = 10000;
    nhjs_jump_active = TRUE;
    if (setjmp(nhjs_input_jmp)) {
        nhjs_jump_active = FALSE;
        return 0;
    }
    if (!nhjs_game_started)
        nhjs_start_game();
    for (i = 0; i < max_iterations && !nhjs_input_exhausted_flag; ++i)
        moveloop_core();
    nhjs_jump_active = FALSE;
    return nhjs_input_exhausted_flag ? 0 : 1;
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_screen_count(void)
{
    return nhjs_screen_count;
}

EMSCRIPTEN_KEEPALIVE
const char *
nhjs_get_screen(int idx)
{
    if (idx < 0 || idx >= nhjs_screen_count)
        return "";
    return nhjs_screens[idx] ? nhjs_screens[idx] : "";
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_animation_count(void)
{
    return nhjs_animation_count;
}

EMSCRIPTEN_KEEPALIVE
const char *
nhjs_get_animation_screen(int idx)
{
    if (idx < 0 || idx >= nhjs_animation_count)
        return "";
    return nhjs_animation_screens[idx] ? nhjs_animation_screens[idx] : "";
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_animation_cursor_col(int idx)
{
    if (idx < 0 || idx >= nhjs_animation_count)
        return 0;
    return nhjs_animation_cursor_cols[idx];
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_animation_cursor_row(int idx)
{
    if (idx < 0 || idx >= nhjs_animation_count)
        return 0;
    return nhjs_animation_cursor_rows[idx];
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_animation_seq(int idx)
{
    if (idx < 0 || idx >= nhjs_animation_count)
        return 0;
    return nhjs_animation_seqs[idx];
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_animation_id(int idx)
{
    if (idx < 0 || idx >= nhjs_animation_count)
        return 0;
    return nhjs_animation_ids[idx];
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_screen_cursor_col(int idx)
{
    if (idx < 0 || idx >= nhjs_screen_count)
        return 0;
    return nhjs_screen_cursor_cols[idx];
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_screen_cursor_row(int idx)
{
    if (idx < 0 || idx >= nhjs_screen_count)
        return 0;
    return nhjs_screen_cursor_rows[idx];
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_cursor_col(void)
{
    return nhjs_cursor_col;
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_get_cursor_row(void)
{
    return nhjs_cursor_row;
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_input_exhausted(void)
{
    return nhjs_input_exhausted_flag ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_started(void)
{
    return nhjs_game_started ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
const char *
nhjs_rng_log_path(void)
{
    return NHJS_RNG_LOG_PATH;
}

EMSCRIPTEN_KEEPALIVE
int
nhjs_debug_phase(void)
{
    return nhjs_phase;
}
