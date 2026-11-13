// host/qsort.js - qsort() with the comparator call order of the reference C library.
//
// The algorithm is the FreeBSD qsort (Bentley & McIlroy's quicksort, with an
// insertion sort for small or already partitioned arrays and heapsort when the
// recursion depth runs out).  NetHack itself sorts through
// nh_deterministic_qsort() (hacklib.c), which breaks ties by original index so
// that every libc gives the same order for a consistent comparator.  This
// module goes further and makes the same comparator calls, in the same order
// and with the same arguments, as the reference qsort, so even a comparator
// with side effects (sortloot_cmp may discover objects) or an inconsistent one
// behaves the same.
//
// Transcribed from FreeBSD's stdlib qsort.c and heapsort.c.
// `base` is an address in the heap mem.HEAPU8 (re-read after every
// comparison: the comparator may grow memory), `cmp(a, b)` receives two
// element addresses (C `const void *`) and returns an int.  Swaps move whole
// elements, so the C swap variants (by long, int or char) are all one copy
// here; the call sequence depends only on element positions, not on the
// element width.
//
// qsort.c:
// Copyright (c) 1992, 1993
//	The Regents of the University of California.  All rights reserved.
//
// heapsort.c:
// Copyright (c) 1991, 1993
//	The Regents of the University of California.  All rights reserved.
// This code is derived from software contributed to Berkeley by
// Ronnie Kon at Mindcraft Inc., Kevin Lew and Elmer Yglesias.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
// 1. Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
// 3. Neither the name of the University nor the names of its contributors
//    may be used to endorse or promote products derived from this software
//    without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED.  IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
// OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
// OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
// SUCH DAMAGE.

// fls(): index of the most significant set bit, counting from 1; 0 for 0
const fls = (x) => 32 - Math.clz32(x);

/**
 * qsort(base, nel, width, cmp) on the heap given by mem.HEAPU8.  heapsort()
 * needs a temporary element in the heap (the comparator is passed its
 * address): mem.fn.malloc / mem.fn.free provide it, as heapsort.c mallocs it.
 */
export function qsort(mem, base, nel, width, cmp) {
  const es = width;
  const tmp = new Uint8Array(es);

  const swap = (a, b) => {
    const H = mem.HEAPU8;
    tmp.set(H.subarray(a, a + es));
    H.copyWithin(a, b, b + es);
    H.set(tmp, b);
  };
  // swap n bytes at a and b (n is a multiple of es), front to back: the two
  // ranges can overlap (after the scan pointers met on one element)
  const vecswap = (a, b, n) => {
    for (let i = 0; i < n; i += es) swap(a + i, b + i);
  };
  const med3 = (a, b, c) =>
    cmp(a, b) < 0
      ? (cmp(b, c) < 0 ? b : (cmp(a, c) < 0 ? c : a))
      : (cmp(b, c) > 0 ? b : (cmp(a, c) < 0 ? a : c));

  // insertion sort; false if more than swapLimit swaps were needed (0: no limit)
  const isort = (a, n, swapLimit) => {
    let swapCnt = 0;
    for (let pm = a + es; pm < a + n * es; pm += es) {
      for (let pl = pm; pl > a && cmp(pl - es, pl) > 0; pl -= es) {
        swap(pl, pl - es);
        if (swapLimit && ++swapCnt > swapLimit) return false;
      }
    }
    return true;
  };

  const sort = (a, n, depthLimit) => {
    for (;;) {
      let swapCnt = 0;
      if (depthLimit-- <= 0) {
        heapsort(mem, a, n, es, cmp);
        return;
      }
      if (n <= 7) {
        isort(a, n, 0);
        return;
      }

      let pl = a;
      let pm = a + (n >>> 1) * es;
      let pn = a + (n - 1) * es;
      if (n > 40) {
        const d = (n >>> 3) * es;
        pl = med3(pl, pl + d, pl + 2 * d);
        pm = med3(pm - d, pm, pm + d);
        pn = med3(pn - 2 * d, pn - d, pn);
      }
      pm = med3(pl, pm, pn);

      swap(a, pm);
      let pa = a + es, pb = pa;
      let pc = a + (n - 1) * es, pd = pc;
      let r;
      for (;;) {
        while (pb <= pc && (r = cmp(pb, a)) <= 0) {
          if (r === 0) {
            swapCnt = 1;
            swap(pa, pb);
            pa += es;
          }
          pb += es;
        }
        while (pb <= pc && (r = cmp(pc, a)) >= 0) {
          if (r === 0) {
            swapCnt = 1;
            swap(pc, pd);
            pd -= es;
          }
          pc -= es;
        }
        if (pb > pc) break;
        swap(pb, pc);
        swapCnt = 1;
        pb += es;
        pc -= es;
      }

      pn = a + n * es;
      let d1 = Math.min(pa - a, pb - pa);
      vecswap(a, pb - d1, d1);
      d1 = Math.min(pd - pc, pn - pd - es);
      vecswap(pb, pn - d1, d1);

      // nothing moved: try an insertion sort, giving up after 1 + n/4 swaps
      if (swapCnt === 0 && isort(a, n, 1 + (n >>> 2))) return;

      d1 = pb - pa;
      const d2 = pd - pc;
      if (d1 <= d2) {
        // recurse on the left partition, then iterate on the right one
        if (d1 > es) sort(a, d1 / es, depthLimit);
        if (d2 > es) {
          a = pn - d2;
          n = d2 / es;
          continue;
        }
      } else {
        // recurse on the right partition, then iterate on the left one
        if (d2 > es) sort(pn - d2, d2 / es, depthLimit);
        if (d1 > es) {
          n = d1 / es;
          continue;
        }
      }
      return;
    }
  };

  sort(base, nel, 2 * (fls(nel) - 1));
}

/**
 * heapsort(vbase, nmemb, size, compar) of heapsort.c (Floyd's variant: sift
 * the hole down to a leaf, then the displaced element back up).
 */
export function heapsort(mem, vbase, nmemb, size, compar) {
  if (nmemb <= 1) return 0;
  const k = mem.fn.malloc(size);
  const copy = (dst, src) => mem.HEAPU8.copyWithin(dst, src, src + size);
  const tmp = new Uint8Array(size);
  const swap = (a, b) => {
    const H = mem.HEAPU8;
    tmp.set(H.subarray(a, a + size));
    H.copyWithin(a, b, b + size);
    H.set(tmp, b);
  };
  // items are numbered from 1 to nmemb
  const base = vbase - size;

  const create = (initval, n) => {
    for (let parI = initval, childI; (childI = parI * 2) <= n; parI = childI) {
      let child = base + childI * size;
      if (childI < n && compar(child, child + size) < 0) {
        child += size;
        ++childI;
      }
      const par = base + parI * size;
      if (compar(child, par) <= 0) break;
      swap(par, child);
    }
  };
  const select = (n) => {
    let parI = 1, childI;
    for (; (childI = parI * 2) <= n; parI = childI) {
      let child = base + childI * size;
      if (childI < n && compar(child, child + size) < 0) {
        child += size;
        ++childI;
      }
      copy(base + parI * size, child);
    }
    for (;;) {
      childI = parI;
      parI = Math.floor(childI / 2);
      const child = base + childI * size;
      const par = base + parI * size;
      if (childI === 1 || compar(k, par) < 0) {
        copy(child, k);
        break;
      }
      copy(child, par);
    }
  };

  for (let l = Math.floor(nmemb / 2) + 1; --l; ) create(l, nmemb);
  while (nmemb > 1) {
    copy(k, base + nmemb * size);
    copy(base + nmemb * size, base + size);
    --nmemb;
    select(nmemb);
  }
  mem.fn.free(k);
  return 0;
}
