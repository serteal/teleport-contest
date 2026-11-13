/* NetHack 5.0	quest.h	$NHDT-Date: 1596498556 2020/08/03 23:49:16 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.11 $ */
/* Copyright (c) Mike Stephenson 1991.                            */
/* NetHack may be freely redistributed.  See license for details. */

export const struct_q_score = struct("struct_q_score", { /* Quest "scorecard" */
    first_start: Bitfield(1), /* only set the first time */
    met_leader: Bitfield(1), /* has met the leader */
    not_ready: Bitfield(3), /* rejected due to alignment, etc. */
    pissed_off: Bitfield(1), /* got the leader angry */
    got_quest: Bitfield(1), /* got the quest assignment */
    killed_leader: Bitfield(1), /* killed the quest leader */

    first_locate: Bitfield(1), /* only set the first time */
    met_intermed: Bitfield(1), /* used if the locate is a person */
    got_final: Bitfield(1), /* got the final quest assignment */

    made_goal: Bitfield(3), /* # of times on goal level */
    met_nemesis: Bitfield(1), /* has met the nemesis before */
    killed_nemesis: Bitfield(1), /* set when the nemesis is killed */
    in_battle: Bitfield(1), /* set when nemesis fighting you */

    cheater: Bitfield(1), /* set if cheating detected */
    touched_artifact: Bitfield(1), /* for a special message */
    offered_artifact: Bitfield(1), /* offered to leader */
    got_thanks: Bitfield(1), /* final message from leader */

    /* used by questpgr code when messages want to use pronouns
       (set up at game start instead of waiting until monster creation;
       1 bit each would suffice--nobody involved is actually neuter) */
    ldrgend: Bitfield(2), /* leader's gender: 0=male, 1=female, 2=neuter */
    nemgend: Bitfield(2), /* nemesis's gender */
    godgend: Bitfield(2), /* deity's gender */

    /* keep track of leader presence/absence even if leader is
       polymorphed, raised from dead, etc */
    leader_is_dead: Bitfield(1),
    leader_m_id: unsigned,
});

export const MIN_QUEST_ALIGN = 20;
/* note: align 20 matches "pious" as reported by enlightenment (cmd.c) */
export const MIN_QUEST_LEVEL = 14;
/* note: exp.lev. 14 is threshold level for 5th rank (class title, role.c) */

import { unsigned } from "../rt/ctypes.js";
import { Bitfield, struct } from "../rt/struct.js";
