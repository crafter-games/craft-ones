import type { WeaponId } from "@craft-ones/shared";

const INK = "#34333e";
export const WEAPON_ART = {
  rocket: { backGrip: [-5, 7], frontGrip: [13, 6], shotSize: [30, 22] },
  sticky: { backGrip: [0, 6], frontGrip: [10, 7], shotSize: [26, 26] },
  grenade: { backGrip: [2, 6], frontGrip: [10, 7], shotSize: [24, 24] },
  mortar: { backGrip: [-5, 9], frontGrip: [12, 9], shotSize: [27, 22] },
  dynamite: { backGrip: [-3, 7], frontGrip: [12, 7], shotSize: [27, 23] },
  grapple: { backGrip: [-7, 8], frontGrip: [10, 7], shotSize: [28, 22] },
} as const;
/** Original toy-like silhouettes, flat shadow planes and warm metal highlights. */
export function weaponMarkup(kind: WeaponId, projectile = false): string {
  const wrap = (s: string) =>
    `<g stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">${s}</g>`;
  if (kind === "sticky")
    return wrap(
      `<path d="M-7-5L-11-9L-14-5L-10 0L-13 5L-9 9L-5 7L0 13L5 10L11 12L14 7L19 5L17 0L20-5L15-9L10-7L6-12L1-9L-3-11Z" fill="#b4c782"/><path d="M-7-4Q4-12 13-4Q20 5 10 11Q1 15-6 8Q-12 3-7-4Z" fill="#829b69"/><path d="M7-6Q16-3 13 6Q8 12 0 9L5 4Z" fill="#586f56" stroke="none"/><path d="M-5-2L0-5L-1 1L-6 3Z" fill="#dce7a9" stroke="none"/><circle cx="5" cy="2" r="4" fill="#e6ac70"/><path d="M5-2V2L8 3" fill="none"/><path d="M4-9L5-15Q11-19 13-14" fill="none" stroke="#f1d7a1" stroke-width="2.5"/><path d="m13-14 4-3m-4 3 5 1" stroke="#f3b55c"/>`,
    );
  if (kind === "grenade")
    return wrap(
      `<path d="M1-9H11V-4H1Z" fill="#889da0"/><path d="M0-6Q-6-1-4 8Q-2 15 7 14Q17 13 18 4Q19-3 11-6Z" fill="#75905a"/><path d="M8-5Q18-2 16 7Q12 15 3 12L7 8Z" fill="#50674b" stroke="none"/><path d="M0-2L4-4L3 5L-1 6Z" fill="#b2c97e" stroke="none"/><path d="M-3 2Q5 5 17 2M-2 8Q6 11 15 7M5-5Q1 3 5 13M11-4Q15 4 10 13" fill="none" stroke="#3f5444" stroke-width="1.3"/><path d="M4-10L13-10L19-4L18 3" fill="none" stroke="#c5d6ca" stroke-width="3"/><circle cx="0" cy="-12" r="4" fill="none" stroke="#e6ce93" stroke-width="2.2"/>`,
    );
  if (kind === "dynamite")
    return wrap(
      `<path d="M-6-8Q-15-13-18-6Q-22-1-16 4L16 10Q23 9 23 4Q24-2 18-3Z" fill="#ad4c49"/><path d="M-15-8H17Q22-8 22-2T17 4H-15Q-21 4-21-2T-15-8Z" fill="#e67f61"/><path d="M-13 1H18Q23 1 23 7T18 13H-13Q-19 13-19 7T-13 1Z" fill="#c95d52"/><path d="M-13 3H16M-14-6H15" stroke="#ffb883" stroke-width="2"/><ellipse cx="18" cy="7" rx="4" ry="6" fill="#a14544"/><path d="M-3-9H4L6 14H-2Z" fill="#d7be89"/><path d="M0-8L2 13" stroke="#f5e4b1"/><path d="M18-8Q27-15 18-19Q13-20 14-15" fill="none" stroke="#f1d7a1" stroke-width="2.5"/><path d="m14-17-4-2m4 2-1-5m1 5 4-3" stroke="#edaa5b"/>`,
    );
  if (projectile && kind === "rocket")
    return wrap(
      `<path d="M-14-5L-24-10L-20-1L-25 7L-13 4" fill="#719b98"/><path d="M-15-6H7Q16-5 23 0Q16 6 7 6H-15Z" fill="#e4ddbc"/><path d="M-14 2H12L7 6H-14Z" fill="#aaa78d" stroke="none"/><path d="M9-6Q18-4 23 0L10 6Z" fill="#e98465"/><path d="M-11-3H5" stroke="#fff4d1" stroke-width="2"/><path d="M-17-3L-28 0L-17 3" fill="#f5bb66" stroke="none"/>`,
    );
  if (projectile && kind === "mortar")
    return wrap(
      `<path d="M-12-7L-20-10L-16 0L-20 10L-12 7" fill="#8c829c"/><path d="M-13-7H5Q17-6 21 0Q17 7 5 8H-13Z" fill="#ad9cbc"/><path d="M-10 3H15L5 8H-10Z" fill="#716582" stroke="none"/><path d="M5-7L10-6V7L5 8Z" fill="#e4bc74"/><path d="M-8-4H1" stroke="#e8d9e6" stroke-width="2"/>`,
    );
  if (projectile && kind === "grapple")
    return wrap(
      `<path d="M-23 0H14M7 0L19-14L24-12L18-4M7 0L19 14L24 12L18 4" fill="none" stroke="${INK}" stroke-width="5"/><path d="M-22-1H14M8-1L19-13L23-12M8 1L19 13L23 12" fill="none" stroke="#c4d8d3" stroke-width="2"/><path d="M-11-4H-3V4H-11Z" fill="#cea775"/>`,
    );
  if (kind === "rocket")
    return wrap(
      `<path d="M-14 3L-16 14L-9 15L-5 4" fill="#9f7754"/><path d="M-22-8L-16-10L21-7V7L-16 10L-22 7Z" fill="#607e80"/><path d="M-20 3L19 2V7L-16 10L-20 7Z" fill="#40565e" stroke="none"/><path d="M-14-7L15-5" stroke="#afd0bd" stroke-width="2.5"/><path d="M-7-10L-1-9V9L-7 10Z" fill="#a3b98b"/><path d="M18-10H26V10H18Z" fill="#ddb477"/><ellipse cx="26" cy="0" rx="3" ry="10" fill="#4b4c50"/><ellipse cx="26" cy="0" rx="1.3" ry="6" fill="#222f35" stroke="none"/><path d="M3-7V-13H9V-7" fill="#718d88"/><path d="M3-13H11" stroke="#f2d69b"/><circle cx="-12" cy="1" r="2.1" fill="#e9c87f" stroke="none"/>`,
    );
  if (kind === "mortar")
    return wrap(
      `<path d="M-10 7L-18 17H-10L-2 7M10 7L17 17H25L17 5" fill="#756777"/><path d="M-20-10L-13-13L22-10V10H-14L-20 5Z" fill="#9788a5"/><path d="M-17 3H19V10H-13L-17 7Z" fill="#625a74" stroke="none"/><path d="M-12-10H16" stroke="#d2c1d2" stroke-width="2.5"/><path d="M-4-13H3V10H-4Z" fill="#d4af74"/><ellipse cx="23" cy="0" rx="5" ry="12" fill="#b0a2b9"/><ellipse cx="24" cy="0" rx="3" ry="8" fill="#343541"/><path d="M-18-3H-13M7-4H12" stroke="#e4cf9d"/><circle cx="-9" cy="2" r="2" fill="#dccaac" stroke="none"/>`,
    );
  return wrap(
    `<path d="M-18 4L-20 15L-12 16L-6 3" fill="#ae8059"/><path d="M-18-7L-10-10H12L17-5V5L10 9H-16Z" fill="#5c8b8c"/><path d="M-16 3H14L10 9H-16Z" fill="#3f656d" stroke="none"/><circle cx="-7" cy="0" r="7" fill="#d3b887"/><circle cx="-7" cy="0" r="4.5" fill="none" stroke="#876e56"/><circle cx="-7" cy="0" r="2" fill="#e9d9ad" stroke="none"/><path d="M1-4H22V2H1Z" fill="#afc9bf"/><path d="M17-1L25-12L29-10L25-4M17 1L25 12L29 10L25 4" fill="none" stroke="#34333e" stroke-width="4"/><path d="M17-1L25-11L28-10M17 1L25 11L28 10" fill="none" stroke="#d4e1cf" stroke-width="1.6"/>`,
  );
}
export function weaponSvg(kind: WeaponId, projectile = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-32 -24 64 48" width="192" height="144"><title>${kind}${projectile ? " projectile" : ""}</title>${weaponMarkup(kind, projectile)}</svg>`;
}
