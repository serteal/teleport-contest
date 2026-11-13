// C library records and array typedefs used by the game, declared from the C library
// headers the game is parsed against (wasm32-emscripten sysroot).
// setjmp.h
export const __jmp_buf = array_of(unsigned, 6);
// setjmp.h
export const jmp_buf = array_of("struct___jmp_buf_tag", 1);
// setjmp.h
export const struct___jmp_buf_tag = struct("struct___jmp_buf_tag", {
    __jb: __jmp_buf,
    __fl: unsigned,
    __ss: array_of(unsigned, Math.trunc(128/sizeof(int))),
});
// alltypes.h
export const struct___sigset_t = struct("struct___sigset_t", {
    __bits: array_of(unsigned, 2),
});
// dirent.h
export const struct_dirent = struct("struct_dirent", {
    d_ino: ulong,
    d_off: long,
    d_reclen: ushort,
    d_type: uchar,
    d_name: array_of(char, 256),
});
// fcntl.h
export const struct_flock = struct("struct_flock", {
    l_type: short,
    l_whence: short,
    l_start: long,
    l_len: long,
    l_pid: int,
});
// pwd.h
export const struct_passwd = struct("struct_passwd", {
    pw_name: ptr_to(char),
    pw_passwd: ptr_to(char),
    pw_uid: unsigned,
    pw_gid: unsigned,
    pw_gecos: ptr_to(char),
    pw_dir: ptr_to(char),
    pw_shell: ptr_to(char),
});
// regex.h
export const struct_re_pattern_buffer = struct("struct_re_pattern_buffer", {
    re_nsub: unsigned,
    __opaque: ptr_to(void_t),
    __padding: array_of(ptr_to(void_t), 4),
    __nsub2: unsigned,
    __padding2: char,
});
// signal.h
export const struct_sigaction = struct("struct_sigaction", {
    __sa_handler: union("struct_sigaction.__sa_handler", { sa_handler: fnptr_t, sa_sigaction: fnptr_t, }),
    sa_mask: "struct___sigset_t",
    sa_flags: int,
    sa_restorer: fnptr_t,
});
// stat.h
export const struct_stat = struct("struct_stat", {
    st_dev: unsigned,
    st_mode: unsigned,
    st_nlink: unsigned,
    st_uid: unsigned,
    st_gid: unsigned,
    st_rdev: unsigned,
    st_size: long,
    st_blksize: int,
    st_blocks: int,
    st_atim: "struct_timespec",
    st_mtim: "struct_timespec",
    st_ctim: "struct_timespec",
    st_ino: ulong,
});
// alltypes.h
export const struct_timespec = struct("struct_timespec", {
    tv_sec: long,
    tv_nsec: int,
});
// time.h
export const struct_tm = struct("struct_tm", {
    tm_sec: int,
    tm_min: int,
    tm_hour: int,
    tm_mday: int,
    tm_mon: int,
    tm_year: int,
    tm_wday: int,
    tm_yday: int,
    tm_isdst: int,
    tm_gmtoff: int,
    tm_zone: ptr_to(char),
});
import { char, int, long, short, sizeof, uchar, ulong, unsigned, ushort } from "../rt/ctypes.js";
import { array_of, fnptr_t, ptr_to, struct, union, void_t } from "../rt/struct.js";
