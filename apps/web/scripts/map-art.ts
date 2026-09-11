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
  totora: ({ far, mid, near }) => {
    const reeds = Array.from({ length: 16 }, (_, i) => {
      const x = i * 122 - 30;
      const y = 870 + (i % 3) * 18;
      return `<path d="M${x} ${y}q-8-54 5-108m-2 58l-22-31m25 5l20-35" fill="none" stroke="#728a55" stroke-width="9" stroke-linecap="round"/>`;
    }).join("");
    return `<path d="M-40 740Q260 650 540 735T1110 720T1840 750V1120H-40Z" fill="${far}"/><path d="M-40 842Q280 785 570 850T1160 832T1840 860V1120H-40Z" fill="${mid}"/><g fill="none" stroke="#b7d7ca" stroke-width="7" opacity=".65"><path d="M-20 804Q330 760 680 814T1410 801T1840 818"/><path d="M-20 914Q300 870 620 923T1320 904T1840 930"/></g><g stroke="#6e593b" stroke-width="6" stroke-linejoin="round"><path d="M95 774Q242 710 420 772L389 868H117Z" fill="#c99b56"/><path d="M1372 766Q1518 702 1693 770L1664 864H1394Z" fill="#c99b56"/><path d="M213 750v-118h112v118M207 634l62-70 63 70Z" fill="#d6ae63"/><path d="M1466 744v-112h112v112M1460 634l62-70 63 70Z" fill="#d6ae63"/><path d="M730 820Q896 736 1062 820L1015 908H777Z" fill="#d5ad55"/></g><path d="M750 818q146-170 292 0q-146 70-292 0Z" fill="#b77e4b" stroke="#6e593b" stroke-width="7"/>${reeds}<path d="M-40 995Q410 917 800 1002T1840 984V1120H-40Z" fill="${near}" opacity=".55"/>`;
  },
  saltglass: ({ far, mid, near }) => {
    const crystals = [
      [180, 650, 90],
      [430, 720, 64],
      [760, 565, 130],
      [1100, 680, 82],
      [1460, 590, 118],
      [1690, 715, 62],
    ]
      .map(
        ([x, y, h], i) =>
          `<g stroke="#6d648d" stroke-width="5" stroke-linejoin="round"><path d="M${x} ${y}l${h * 0.34}-${h} ${h * 0.4} ${h}Z" fill="${i % 2 ? "#efb8cf" : "#b8a9df"}"/><path d="M${x + h * 0.34} ${y - h}l${h * 0.4} ${h}-${h * 0.2}-${h * 0.12}Z" fill="#f7d9dd"/></g>`,
      )
      .join("");
    return `<path d="M-50 705Q330 610 620 700T1190 680T1840 710V1120H-50Z" fill="${far}"/><path d="M-50 815Q330 735 660 814T1320 790T1840 830V1120H-50Z" fill="${mid}"/><path d="M-50 900Q390 840 740 910T1450 875T1840 925V1120H-50Z" fill="#eee5dc"/><g fill="none" stroke="#fff8eb" stroke-width="12" opacity=".8"><path d="M-20 852Q450 785 920 852T1840 840"/><path d="M60 956Q520 900 980 960T1760 948"/></g>${crystals}<path d="M-30 1010Q420 930 850 1015T1840 1000V1120H-30Z" fill="${near}" opacity=".32"/>`;
  },
  huaca: ({ far, mid, near }) =>
    `<path d="M-50 760L210 610L420 655L625 520L890 635L1145 490L1430 620L1635 540L1850 690V1120H-50Z" fill="${far}"/><path d="M-30 845L190 774L430 824L650 720L910 830L1180 704L1440 814L1690 740L1850 790V1120H-30Z" fill="${mid}"/><g fill="#b77a53" stroke="#4b3942" stroke-width="7" stroke-linejoin="round"><path d="M74 854V618H450V854Z"/><path d="M1342 854V618H1718V854Z"/><path d="M570 862V720H1222V862ZM638 720V620H1154V720ZM728 620V520H1064V620ZM810 520V420H982V520Z"/></g><g fill="#392f45"><path d="M174 854V704h114v150ZM1504 854V704h114v150ZM828 862V718h136v144Z"/></g><g fill="#e6af68"><path d="M104 655h316v18H104ZM1372 655h316v18h-316ZM600 755h592v18H600ZM668 655h456v18H668ZM758 555h276v18H758Z"/></g><path d="M-30 946Q420 865 820 950T1500 920T1840 958V1120H-30Z" fill="${near}" opacity=".72"/>`,
  frost: ({ far, mid, near }) =>
    `<path d="M-80 770L155 400L310 610L520 270L742 650L970 320L1185 620L1435 238L1710 615L1870 720V1120H-80Z" fill="${far}"/><path d="M155 400l155 210-88-76-66 28-62-48ZM520 270l222 380-131-145-88 43-91-76ZM970 320l215 300-124-112-92 38-72-64ZM1435 238l275 377-152-132-118 51-92-83Z" fill="#edf5ec"/><path d="M-50 820Q250 700 520 802T1050 790T1500 760T1850 825V1120H-50Z" fill="${mid}"/><path d="M-50 930Q270 820 600 926T1230 900T1850 940V1120H-50Z" fill="${near}"/><g fill="#d7ece8" stroke="#55758f" stroke-width="6"><path d="M120 780l120-180 120 180ZM690 800l190-290 190 290ZM1360 780l135-220 145 220Z"/></g>`,
  loom: ({ far, mid, near }) =>
    `<path d="M-50 800Q260 610 520 760T1030 720T1470 630T1850 790V1120H-50Z" fill="${far}"/><path d="M-40 905Q260 760 540 890T1120 840T1510 760T1850 900V1120H-40Z" fill="${mid}"/><g fill="none" stroke-linecap="round"><path d="M40 760Q390 520 735 720T1400 660T1770 770" stroke="#d89b62" stroke-width="56"/><path d="M30 840Q400 650 760 830T1440 750T1780 850" stroke="#8f6680" stroke-width="52"/><path d="M130 700l70 40m160-110l76 42m205 12l80 45m210 32l80 34m230-91l82 36m190-12l75 42" stroke="#f2c46f" stroke-width="12"/></g><g fill="#f3d37a"><path d="M440 245l-82 176h84l-56 151 180-226h-94l74-101Z"/><path d="M1328 214l-70 154h70l-46 132 154-200h-80l64-86Z"/></g><path d="M-20 990Q350 875 720 985T1430 940T1840 995V1120H-20Z" fill="${near}"/>`,
  harbor: ({ far, mid, near }) =>
    `<path d="M-50 770Q270 640 550 760T1120 730T1510 650T1850 780V1120H-50Z" fill="${far}"/><path d="M-50 875Q320 790 650 870T1310 850T1850 890V1120H-50Z" fill="${mid}"/><g fill="#8b6045" stroke="#313a36" stroke-width="7" stroke-linejoin="round"><path d="M80 720h500v116H80ZM1212 720h500v116h-500Z"/><path d="M500 690h792l-96 250H608Z"/><path d="M690 690V390h42v300M1018 690V340h42v350M610 470h300v38H610M900 420h290v38H900"/></g><g fill="none" stroke="#d0a763" stroke-width="12"><path d="M112 750h436M1244 750h436M640 730h512"/></g><g fill="#f5d27b" stroke="#313a36" stroke-width="6"><path d="M230 720V440h64v280ZM1498 720V440h64v280Z"/><path d="M210 440h104l-24-70h-56Z"/><path d="M1478 440h104l-24-70h-56Z"/></g><path d="M-30 960Q350 880 740 968T1450 935T1840 975V1120H-30Z" fill="${near}"/><g fill="none" stroke="#9ec7c0" stroke-width="8" opacity=".65"><path d="M-20 905Q390 850 780 915T1550 900T1840 920"/><path d="M20 1010Q420 950 820 1018T1580 998"/></g>`,
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
