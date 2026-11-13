/*Written by Timothy B. Terriberry (tterribe@xiph.org) 1999-2009
  CC0 (Public domain) - see http://creativecommons.org/publicdomain/zero/1.0/
  for details.
  Based on the public domain ISAAC implementation by Robert J. Jenkins Jr.*/

/*
 * Changes for NetHack:
 *      include config.h;
 *      skip rest of file if USE_ISAAC64 isn't defined there;
 *      re-do 'inline' handling.
 */

export const ISAAC64_MASK = (0xFFFFFFFFFFFFFFFFn);

/* Extract ISAAC64_SZ_LOG bits (starting at bit 3). */
function lower_bits(x) { /* uint32_t */
    return unsigned((x & u64(((ISAAC64_SZ-1) << 3))) >>3n);
}

/* Extract next ISAAC64_SZ_LOG bits (starting at bit ISAAC64_SZ_LOG+2). */
function upper_bits(y) { /* uint32_t */
    return unsigned((y >> BigInt((ISAAC64_SZ_LOG+3))) & u64((ISAAC64_SZ-1)));
}

function isaac64_update(_ctx) { /* void */
  let m;
  let r;
  let a;
  let b;
  let x;
  let y;
  let i;
  m=_ctx.m;
  r=_ctx.r;
  a=_ctx.a;
  b=u64(_ctx.b+(++_ctx.c));
  for(i=0;i<Math.trunc(ISAAC64_SZ/2);i++){
    x=m[i];
    a=u64(u64(~(a^u64(a<<21n)))+m[i+Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
    x=m[++i];
    a=u64((a^a>>5n)+m[i+Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
    x=m[++i];
    a=u64((a^u64(a<<12n))+m[i+Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
    x=m[++i];
    a=u64((a^a>>33n)+m[i+Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
  }
  for(i=Math.trunc(ISAAC64_SZ/2);i<ISAAC64_SZ;i++){
    x=m[i];
    a=u64(u64(~(a^u64(a<<21n)))+m[i-Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
    x=m[++i];
    a=u64((a^a>>5n)+m[i-Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
    x=m[++i];
    a=u64((a^u64(a<<12n))+m[i-Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
    x=m[++i];
    a=u64((a^a>>33n)+m[i-Math.trunc(ISAAC64_SZ/2)]);
    m[i]=y=u64(u64(m[lower_bits(x)]+a)+b);
    r[i]=b=u64(m[upper_bits(y)]+x);
  }
  _ctx.b=b;
  _ctx.a=a;
  _ctx.n=ISAAC64_SZ;
}

function isaac64_mix(_x) { /* void */
  let SHIFT = static_array("isaac64_mix.SHIFT", uchar, 8, [9,9,23,15,14,20,17,14]);
  let i;
  for(i=0;i<8;i++){
    _x[i] = u64(_x[i] - (_x[(i+4)&7]));
    _x[(i+5)&7]^=_x[(i+7)&7]>>BigInt(uchars[SHIFT + i]);
    _x[(i+7)&7] = u64(_x[(i+7)&7] + (_x[i]));
    i++;
    _x[i] = u64(_x[i] - (_x[(i+4)&7]));
    _x[(i+5)&7]^=u64(_x[(i+7)&7]<<BigInt(uchars[SHIFT + i]));
    _x[(i+7)&7] = u64(_x[(i+7)&7] + (_x[i]));
  }
}

export function isaac64_init(_ctx, _seed, _nseed) { /* void */
  _ctx.a=_ctx.b=_ctx.c=0n;
  memset(addr_of(_ctx.r),0,sizeof_member(_ctx, "r"));
  isaac64_reseed(_ctx,_seed,_nseed);
}

export function isaac64_reseed(_ctx, _seed, _nseed) { /* void */
    const $frame = stack_frame(); try {
  let m;
  let r;
  let x = stack_array(uint64_t, 8);
  let i;
  let j;
  m=_ctx.m;
  r=_ctx.r;
  if(_nseed>ISAAC64_SEED_SZ_MAX)_nseed=ISAAC64_SEED_SZ_MAX;
  for(i=0;i<_nseed>>3;i++){
    r[i]^=u64(u64((uchars[_seed + (i<<3|7)]))<<56n)|u64(u64((uchars[_seed + (i<<3|6)]))<<48n)|
     u64(u64((uchars[_seed + (i<<3|5)]))<<40n)|u64(u64((uchars[_seed + (i<<3|4)]))<<32n)|
     u64(u64((uchars[_seed + (i<<3|3)]))<<24n)|u64(u64((uchars[_seed + (i<<3|2)]))<<16n)|
     u64(u64((uchars[_seed + (i<<3|1)]))<<8n)|u64(uchars[_seed + (i<<3)]);
  }
  _nseed-=i<<3;
  if(_nseed>0){
    let ri;
    ri=u64(uchars[_seed + (i<<3)]);
    for(j=1;j<_nseed;j++)ri|=u64(u64((uchars[_seed + (i<<3|j)]))<<BigInt((j<<3)));
    r[i++]^=ri;
  }
  x[0]=x[1]=x[2]=x[3]=x[4]=x[5]=x[6]=x[7]=0x9E3779B97F4A7C13n;
  for(i=0;i<4;i++)isaac64_mix(x);
  for(i=0;i<ISAAC64_SZ;i+=8){
    for(j=0;j<8;j++)x[j] = u64(x[j] + (r[i+j]));
    isaac64_mix(x);
    memcpy(addr_of(m.subarray(i)),addr_of(x),sizeof(array_of(uint64_t, 8)));
  }
  for(i=0;i<ISAAC64_SZ;i+=8){
    for(j=0;j<8;j++)x[j] = u64(x[j] + (m[i+j]));
    isaac64_mix(x);
    memcpy(addr_of(m.subarray(i)),addr_of(x),sizeof(array_of(uint64_t, 8)));
  }
  isaac64_update(_ctx);
    } finally { stack_pop($frame); }
}

export function isaac64_next_uint64(_ctx) { /* uint64_t */
  if(!_ctx.n)isaac64_update(_ctx);
  return _ctx.r[--_ctx.n];
}

export function isaac64_next_uint(_ctx, _n) { /* uint64_t */
  let r;
  let v;
  let d;
  do{
    r=isaac64_next_uint64(_ctx);
    v=r%_n;
    d=u64(r-v);
  }
  while((u64(u64(d+_n)-1n)&ISAAC64_MASK)<d);
  return v;
}

/*isaac64.c*/

import { ISAAC64_SEED_SZ_MAX, ISAAC64_SZ, ISAAC64_SZ_LOG } from "./isaac64.h.js";
import { sizeof, uchar, uint64_t, unsigned } from "../rt/ctypes.js";
import { stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { u64 } from "../rt/int64.js";
import { memcpy, memset } from "../rt/libc.js";
import { stack_array, static_array } from "../rt/locals.js";
import { addr_of, array_of, sizeof_member } from "../rt/struct.js";
