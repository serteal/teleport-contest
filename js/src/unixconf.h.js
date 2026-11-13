/* NetHack 5.0	unixconf.h	$NHDT-Date: 1711213886 2024/03/23 17:11:26 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.57 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Some include files are in a different place under SYSV
 *      BSD                SYSV
 * <sys/time.h>         <time.h>
 * <sgtty.h>            <termio.h>
 *
 * Some routines are called differently
 * index                strchr
 * rindex               strrchr
 *
 */

/* define exactly one of the following four choices */
/* #define BSD 1 *//* define for 4.n/Free/Open/Net BSD  */
                     /* also for relatives like SunOS 4.x, DG/UX, and */
                     /* older versions of Linux */
/* #define ULTRIX *//* define for Ultrix v3.0 or higher (but not lower) */
                     /* Use BSD for < v3.0 */
                     /* "ULTRIX" not to be confused with "ultrix" */

                     /* of Linux */
/* #define HPUX *//* Hewlett-Packard's Unix, version 6.5 or higher */
                     /* use SYSV for < v6.5 */

/* define any of the following that are appropriate */

                       /* including Solaris 2+ */

                       /* e.g. Suns sharing a playground through NFS */
/* #define SUNOS4 *//* SunOS 4.x */

/* #define CYGWIN32 *//* Unix on Win32 -- use with case sensitive defines */
/* #define GENIX *//* Yet Another Unix Clone */
/* #define HISX *//* Bull Unix for XPS Machines */
/* #define BOS *//* Bull Open Software - Unix for DPX/2 Machines */
/* #define UNIXPC *//* use in addition to SYSV for AT&T 7300/3B1 */
/* #define AIX_31 *//* In AIX 3.1 (IBM RS/6000) use BSD ioctl's to gain
                        * job control (note that AIX is SYSV otherwise)
                        * Also define this for AIX 3.2 */

/* #undef TERMINFO -- the built-in ANSI terminal sequences are used */
                       /* Should be defined for most SYSV, SVR4 (including
                        * Solaris 2+), HPUX, and Linux systems.  In
                        * particular, it should NOT be defined for the UNIXPC
                        * unless you remove the use of the shared library in
                        * the Makefile */

                    /* Define for many recent OS releases, including
                     * those with specific defines (since types are
                     * changing toward the standard from earlier chaos).
                     * For example, platforms using the GNU libraries,
                     * Linux, Solaris 2.x
                     */

/* #define RANDOM *//* if neither random/srandom nor lrand48/srand48
                        is available from your system */

/*
 * The next two defines are intended mainly for the Andrew File System,
 * which does not allow hard links.  If NO_FILE_LINKS is defined, lock files
 * will be created in LOCKDIR using open() instead of in the playground using
 * link().
 *              Ralf Brown, 7/26/89 (from v2.3 hack of 10/10/88)
 */

/* #define NO_FILE_LINKS *//* if no hard links */
/* #define LOCKDIR "/usr/games/lib/nethackdir" *//* where to put locks */

/*
 * If you want the static parts of your playground on a read-only file
 * system, define VAR_PLAYGROUND to be where the variable parts are kept.
 */
/* #define VAR_PLAYGROUND "/var/lib/games/nethack" */

/*
 * Define DEF_PAGER as your default pager, e.g. "/bin/cat" or "/usr/ucb/more"
 * If defined, it can be overridden by the environment variable PAGER.
 * NetHack will use its internal pager if DEF_PAGER is not defined _or_
 * if DLB is defined since an external pager won't know how to access the
 * contents of the dlb container file.
 * (Note: leaving DEF_PAGER undefined is preferable for security reasons.)
 */
/* #define DEF_PAGER "/usr/bin/less" */

/*
 * Define PORT_HELP to be the name of the port-specific help file.
 * This file is found in HACKDIR.
 * Normally, you shouldn't need to change this.
 * There is currently no port-specific help for Unix systems.
 */
/* #define PORT_HELP "Unixhelp" */

/*
 * To enable the `timed_delay' option for using a timer rather than extra
 * screen output when pausing for display effect.  Requires that `msleep'
 * function be available (with time argument specified in milliseconds).
 * Various output devices can produce wildly varying delays when the
 * "extra output" method is used, but not all systems provide access to
 * a fine-grained timer.
 */
/* #define TIMED_DELAY *//* usleep() */

/*
 * At start of game, if there are lock and level files for current
 * character in the playground directory, ask whether to recover them
 * (into a save file).
 */
/* #define SELF_RECOVER */

/*
 * At start of game, if there is no save file to restore or lock and
 * level files to recover but there is a panic save file for the current
 * character, tell the player that it exists and ask whether to start a
 * new game.  Does not attempt to rename and restore the panic save file.
 */

/* #define AVOID_WIN_IOCTL *//* ensure USE_WIN_IOCTL remains undefined */

/*
 * If you define MAIL, then the player will be notified of new mail
 * when it arrives.  If you also define DEF_MAILREADER then this will
 * be the default mail reader, and can be overridden by the environment
 * variable MAILREADER; otherwise an internal pager will be used.
 * A stat system call is done on the mailbox every MAILCKFREQ moves.
 */

/* The Andrew Message System does mail a little differently from normal
 * UNIX.  Mail is deposited in the user's own directory in ~/Mailbox
 * (another directory).  MAILBOX is the element that will be added on to
 * the user's home directory path to generate the Mailbox path - just in
 * case other Andrew sites do it differently from CMU.
 *              dan lovinger
 *              dl2n+@andrew.cmu.edu (dec 19 1989)
 */

/* #define AMS *//* use Andrew message system for mail */

/* NO_MAILREADER is for kerberos authenticating filesystems where it is
 * essentially impossible to securely exec child processes, like mail
 * readers, when the game is running under a special token.
 *              dan
 */

/* #define NO_MAILREADER *//* have mail daemon just tell player of mail */

export const DEF_MAILREADER = "/usr/bin/mailx";

/* If SIMPLE_MAIL is defined, the mail spool file format is
   "sender:message", one mail per line, and mails are
   read within game, from demon-delivered mail scrolls.
   The mail spool file will be deleted once the player
   has read the message. */
/* #define SIMPLE_MAIL */

/* How often mail spool file is checked for new messages, in turns */
export const MAILCKFREQ = 50;

/* If SERVER_ADMIN_MSG is defined and the file exists, players get
   a message from the user defined in the file.  The file format
   is "sender:message" all in one line. */
/* #define SERVER_ADMIN_MSG "adminmsg" */

/* How often admin message file is checked for new messages, in turns */

/*
 * Some terminals or terminal emulators send two character sequence "ESC c"
 * when Alt+c is pressed.  The altmeta run-time option allows the user to
 * request that "ESC c" be treated as M-c.
 */

/* Some implementations of compress need a 'quiet' option.
 * If you've got one of these versions, put -q here.
 * You can also include any other strange options your compress needs.
 * If you have a normal compress, just leave it commented out.
 */
/* #define COMPRESS_OPTIONS "-q" */

export const FCMASK = 0o660;

/* fcntl(2) is a POSIX-portable call for manipulating file descriptors.
 * Comment out the USE_FCNTL if for some reason you have a strange
 * OS/filesystem combination for which fcntl(2) does not work. */

/*
 * The remainder of the file should not need to be changed.
 */

/*
 * BSD/ULTRIX systems are normally the only ones that can suspend processes.
 * Suspending NetHack processes cleanly should be easy to add to other systems
 * that have SIGTSTP in the Berkeley sense.  Currently the only such systems
 * known to work are HPUX and AIX 3.1; other systems will probably require
 * tweaks to unixtty.c and ioctl.c.
 *
 * POSIX defines a slightly different type of job control, which should be
 * equivalent for NetHack's purposes.  POSIX_JOB_CONTROL should work on
 * various recent SYSV versions (with possibly tweaks to unixtty.c again).
 */

/*
 * Define SAFERHANGUP to delay hangup processing until the main command
 * loop. 'safer' because it avoids certain cheats and also avoids losing
 * objects being thrown when the hangup occurs.  All unix windowports
 * support SAFERHANGUP (couldn't define it here otherwise).
 */

/* these might be needed for include/system.h;
   default comes from system's time.h */
/* #define NEED_TIME_DECL 1 */
/* #define NEED_LOCALTIME_DECL 1 */
/* #define NEED_CTIME_DECL 1 */
/* these might be needed for src/hacklib.c;
   default is 'time_t *' */
/* #define TIME_type long * */
/* #define LOCALTIME_type long * */

export const HLOCK = "perm";
