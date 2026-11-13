/* NetHack 5.0	mail.h	$NHDT-Date: 1596498544 2020/08/03 23:49:04 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.10 $ */
/*      Copyright (c) 2015 by Kenneth Lorber              */
/* NetHack may be freely redistributed.  See license for details. */

/* used by ckmailstatus() to pass information to the mail-daemon in newmail()
 */

export const MSG_OTHER = 0;
export const MSG_MAIL = 1;

export const struct_mail_info = struct("struct_mail_info", {
    message_typ: int, /* MSG_foo value */
    display_txt: ptr_to(char), /* text for daemon to verbalize */
    object_nam: ptr_to(char), /* text to tag object with */
    response_cmd: ptr_to(char), /* command to eventually execute */
});

import { char, int } from "../rt/ctypes.js";
import { ptr_to, struct } from "../rt/struct.js";
