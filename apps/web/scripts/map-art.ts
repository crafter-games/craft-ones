import { mkdir } from "node:fs/promises";
import {
  contourPaths,
  makeWorld,
  PLAYABLE_MAP_IDS,
  type PlayableMapId,
  terrainContours,
  WORLD_HEIGHT,
  WORLD_MAPS,
  WORLD_WIDTH,
} from "../../../packages/shared/src";

type Palette = (typeof WORLD_MAPS)[PlayableMapId]["palette"];
const scenery: Record<PlayableMapId, (palette: Palette) => string> = {
  andes: ({ far, mid, near }) => {
    const plants = Array.from({ length: 12 }, (_, i) => {
      const x = i * 168 + 24,
        y = 874 + ((i * 31) % 97);
      return `<g fill="#588b7e"><path d="M${x - 32} ${y}l32-84 32 84Z"/><path d="M${x - 24} ${y - 37}l24-65 24 65Z"/></g>`;
    }).join("");
    return `<path d="M-100 850L180 330L300 507L545 250L846 642L1110 324L1450 642L1660 364L1910 828V1100H-100Z" fill="${far}"/><path d="M180 330L143 710L-100 850ZM545 250L461 806L300 507ZM1110 324L1030 830L846 642ZM1660 364L1610 818L1450 642Z" fill="#86b7a7"/><path d="M124 433L180 330L255 443L212 425L184 450L160 417ZM461 339L545 250L626 355L578 341L549 365L520 329ZM1045 402L1110 324L1177 407L1130 395L1103 419L1081 391Z" fill="#e0e9c9"/>${hills(mid, near)}${plants}`;
  },
  coast: ({ far, mid, near }) => {
    const plants = Array.from({ length: 12 }, (_, i) => {
      const x = i * 168 + 24,
        y = 874 + ((i * 31) % 97);
      return `<g fill="#956e64" stroke="#956e64" stroke-width="13" stroke-linecap="round"><path d="M${x} ${y}v-64m0 41q-22 2-22-24m22 11q24 0 24-32" fill="none"/></g>`;
    }).join("");
    return `<path d="M-40 850V530L90 525L116 345L230 335L259 507L377 518L405 600L488 598L515 400L666 385L704 600L809 615L837 550L1022 554L1059 384L1204 370L1247 560L1410 570L1446 455L1570 445L1600 600L1832 618V1100H-40Z" fill="${far}"/><path d="M116 345L165 353L154 620L90 660L90 525ZM515 400L568 412L555 681L488 709ZM1059 384L1110 394L1094 650L1022 685ZM1446 455L1492 464L1484 700L1410 726Z" fill="#c38e7a"/><path d="M114 346L230 335M513 400L666 385M1059 384L1204 370M1446 455L1570 445" stroke="#e3b397" stroke-width="14"/>${hills(mid, near)}${plants}`;
  },
  canopy: ({ far, mid, near }) => {
    const trees = [80, 386, 1334, 1664]
      .map((x, i) => {
        const y = 328 + ((i * 71) % 128);
        return `<g transform="translate(${x} ${y})" stroke="#789e80" stroke-width="5" stroke-linejoin="round"><path d="M-22 710L-8 60L-102-8L-81-21L18 35L79-34L99-20L36 65L59 710Z" fill="${far}"/><path d="M18 35L36 65L59 710H26L7 68Z" fill="#8eb689" stroke="none"/><path d="M-149 14Q-205-31-146-57Q-130-112-64-86Q-22-134 34-95Q109-124 136-66Q205-49 176-8Q111 43 48 15Q-39 62-149 14Z" fill="${far}"/><path d="M-151 12Q-57 26 4-8Q93 22 175-10Q105 47 48 15Q-39 62-151 12Z" fill="#8eb689" stroke="none"/></g>`;
      })
      .join("");
    const leaves = [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const x = 45 + i * 330;
        const y = 936 + ((i * 19) % 54);
        return `<g transform="translate(${x} ${y})" fill="${near}" stroke="#557b6e" stroke-width="5" stroke-linejoin="round"><path d="M0 122L-10-27Q-68-98-97-74Q-68-10-10 2Q-7-87 40-111Q52-52 3-6Q70-63 100-32Q84 12 9 23L19 122Z"/><path d="M0 4L-69-59M2-6L32-82M8 21L76-22" fill="none" stroke="#81a48b" stroke-width="4"/></g>`;
      })
      .join("");
    return `${trees}<path d="M-60 849Q45 726 160 804Q225 711 355 796Q475 754 574 851Q703 825 811 916Q913 850 1045 884Q1110 762 1259 829Q1361 714 1467 787Q1603 716 1840 806V1120H-60Z" fill="${mid}" stroke="#70977f" stroke-width="5"/><path d="M-30 898Q153 836 279 911L402 1030H-30ZM1822 865Q1624 823 1511 935L1390 1050H1822Z" fill="${near}"/><g fill="none" stroke="#87ad82" stroke-width="7" stroke-linecap="round"><path d="M88 357Q26 505 119 563Q183 605 155 737M393 385Q447 518 369 593M1626 388Q1744 531 1633 652Q1581 724 1664 810"/></g>${leaves}`;
  },
  caldera: ({ far, mid, near }) => {
    const columns = Array.from({ length: 9 }, (_, i) => {
      const x = i * 232 - 52,
        y = 904 + ((i * 43) % 113);
      return `<g stroke="#715d75" stroke-width="5" stroke-linejoin="round"><path d="M${x} 1100V${y}l34-23 44 14 24 44v165Z" fill="${near}"/><path d="M${x + 34} ${y - 23}l9 223h35V${y - 9}Z" fill="#987589" stroke="none"/></g>`;
    }).join("");
    return `<path d="M-80 853L127 696L392 314L495 344L550 330L647 426L824 773L1002 670L1274 276L1370 304L1434 286L1520 391L1872 785V1120H-80Z" fill="${far}" stroke="#a57e97" stroke-width="6" stroke-linejoin="round"/><path d="M392 314L372 597L127 696L432 529L495 344ZM1274 276L1208 571L1002 670L1300 497L1370 304Z" fill="#ad859a"/><path d="M392 314L495 344L550 330L647 426L539 384L487 392L413 358ZM1274 276L1370 304L1434 286L1520 391L1419 344L1363 357L1302 327Z" fill="#d6a7aa"/><g fill="none" stroke="#e4af98" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M512 391L492 453L521 484L491 554M1368 352L1353 415L1380 450L1338 535"/></g><path d="M-60 976L-60 836L137 768L328 821L512 911L710 836L885 951L1097 879L1275 792L1450 836L1621 740L1850 833V1120H-60Z" fill="${mid}" stroke="#92738b" stroke-width="6"/><path d="M-60 981L235 886L463 994L725 943L909 1012L1225 911L1496 965L1850 868V1120H-60Z" fill="${near}"/><path d="M512 1030L698 974L862 997L980 972L1078 1006L1235 981L1451 1043Z" fill="#bd857f"/><path d="M646 1036L772 1008L915 1024L991 1004L1115 1036Z" fill="#e3a288"/>${columns}`;
  },
};

function hills(mid: string, near: string) {
  return `<path d="M-60 827Q90 577 240 712L345 775Q453 649 586 729L761 851Q899 657 1064 781Q1235 607 1394 745Q1580 673 1850 791V1100H-60Z" fill="${mid}"/><path d="M-60 956Q181 728 359 850Q450 755 658 941Q811 789 986 869Q1231 712 1416 895Q1592 746 1850 929V1120H-60Z" fill="${near}"/>`;
}

const root = new URL("../public/art/maps/", import.meta.url);
await mkdir(root, { recursive: true });
// Original flat-color scenery: cut-paper silhouettes, ink lines and inset color planes.
// No photos, bitmap textures, gradients or generated assets.
for (const id of PLAYABLE_MAP_IDS) {
  const map = WORLD_MAPS[id];
  const palette = map.palette;
  const clouds = Array.from(
    { length: 7 },
    (_, i) =>
      `<g transform="translate(${i * 310 - 90} ${90 + ((i * 79) % 230)}) scale(${0.75 + (i % 3) * 0.2})"><path d="M0 40Q-30 18 14 10Q8-20 46-18Q66-45 98-15Q141-27 149 3Q198 4 182 34Q214 57 167 60H20Q-8 60 0 40Z" fill="${palette.cloud}"/><path d="M-2 41Q70 52 163 40Q200 53 168 60H20Q-8 60-2 41Z" fill="${palette.cloudShade}"/></g>`,
  ).join("");
  const artwork = `<g transform="scale(${WORLD_WIDTH / 1792} ${WORLD_HEIGHT / 1024})"><rect x="-3000" y="-3000" width="8000" height="8000" fill="${palette.sky}"/><circle cx="1390" cy="160" r="71" fill="#f9e9ad"/><circle cx="1405" cy="147" r="55" fill="#fff0bd"/>${clouds}${scenery[id](palette)}</g>`;
  await Bun.write(
    new URL(`${id}.svg`, root),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" width="${WORLD_WIDTH}" height="${WORLD_HEIGHT}"><title>${map.name} original layered cartoon backdrop</title>${artwork}</svg>`,
  );
  const rows = makeWorld(id);
  const { land: terrain, rim } = contourPaths(terrainContours(rows));
  const strata = Array.from(
    { length: 14 },
    (_, i) =>
      `<path d="M0 ${340 + i * 100}Q400 ${260 + i * 100} 896 ${355 + i * 100}T2688 ${320 + i * 100}v28Q1300 ${345 + i * 100} 896 ${386 + i * 100}T0 ${368 + i * 100}Z" fill="${palette.previewStrata}"/>`,
  ).join("");
  await Bun.write(
    new URL(`${id}-preview.svg`, root),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}"><title>${map.name} playable terrain preview</title><defs><clipPath id="land"><path d="${terrain}" clip-rule="evenodd"/></clipPath></defs>${artwork}<path d="${terrain}" fill="${palette.previewEarth}" fill-rule="evenodd"/><g clip-path="url(#land)">${strata}<path d="${terrain}" fill="none" stroke="${palette.outline}" stroke-width="8" stroke-linejoin="round"/><path d="${rim}" fill="none" stroke="${palette.previewRim}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`,
  );
}
