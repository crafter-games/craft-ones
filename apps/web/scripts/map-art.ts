import { mkdir } from "node:fs/promises";
import { CELL, makeWorld, WORLD_MAPS } from "../../../packages/shared/src";

const root = new URL("../public/art/maps/", import.meta.url);
await mkdir(root, { recursive: true });
// Original flat-color scenery: cut-paper silhouettes, ink lines and inset color planes.
// No photos, bitmap textures, gradients or generated assets.
for (const id of ["andes", "coast"] as const) {
  const coast = id === "coast";
  const sky = coast ? "#edbd9c" : "#bcdfce",
    far = coast ? "#d39e86" : "#99c6b5",
    mid = coast ? "#be8979" : "#7eae9d",
    near = coast ? "#a97669" : "#679584";
  const clouds = Array.from(
    { length: 7 },
    (_, i) =>
      `<g transform="translate(${i * 310 - 90} ${90 + ((i * 79) % 230)}) scale(${0.75 + (i % 3) * 0.2})"><path d="M0 40Q-30 18 14 10Q8-20 46-18Q66-45 98-15Q141-27 149 3Q198 4 182 34Q214 57 167 60H20Q-8 60 0 40Z" fill="${coast ? "#fff0c7" : "#ecf0cf"}"/><path d="M-2 41Q70 52 163 40Q200 53 168 60H20Q-8 60-2 41Z" fill="${coast ? "#f3dcae" : "#d8e6bf"}"/></g>`,
  ).join("");
  const mountains = coast
    ? `<path d="M-40 850V530L90 525L116 345L230 335L259 507L377 518L405 600L488 598L515 400L666 385L704 600L809 615L837 550L1022 554L1059 384L1204 370L1247 560L1410 570L1446 455L1570 445L1600 600L1832 618V1100H-40Z" fill="${far}"/><path d="M116 345L165 353L154 620L90 660L90 525ZM515 400L568 412L555 681L488 709ZM1059 384L1110 394L1094 650L1022 685ZM1446 455L1492 464L1484 700L1410 726Z" fill="#c38e7a"/><path d="M114 346L230 335M513 400L666 385M1059 384L1204 370M1446 455L1570 445" stroke="#e3b397" stroke-width="14"/>`
    : `<path d="M-100 850L180 330L300 507L545 250L846 642L1110 324L1450 642L1660 364L1910 828V1100H-100Z" fill="${far}"/><path d="M180 330L143 710L-100 850ZM545 250L461 806L300 507ZM1110 324L1030 830L846 642ZM1660 364L1610 818L1450 642Z" fill="#86b7a7"/><path d="M124 433L180 330L255 443L212 425L184 450L160 417ZM461 339L545 250L626 355L578 341L549 365L520 329ZM1045 402L1110 324L1177 407L1130 395L1103 419L1081 391Z" fill="#e0e9c9"/>`;
  const hills = `<path d="M-60 827Q90 577 240 712L345 775Q453 649 586 729L761 851Q899 657 1064 781Q1235 607 1394 745Q1580 673 1850 791V1100H-60Z" fill="${mid}"/><path d="M-60 956Q181 728 359 850Q450 755 658 941Q811 789 986 869Q1231 712 1416 895Q1592 746 1850 929V1120H-60Z" fill="${near}"/>`;
  const plants = Array.from({ length: 12 }, (_, i) => {
    const x = i * 168 + 24,
      y = 874 + ((i * 31) % 97);
    return coast
      ? `<g fill="#956e64" stroke="#956e64" stroke-width="13" stroke-linecap="round"><path d="M${x} ${y}v-64m0 41q-22 2-22-24m22 11q24 0 24-32" fill="none"/></g>`
      : `<g fill="#588b7e"><path d="M${x - 32} ${y}l32-84 32 84Z"/><path d="M${x - 24} ${y - 37}l24-65 24 65Z"/></g>`;
  }).join("");
  const artwork = `<rect x="-3000" y="-3000" width="8000" height="8000" fill="${sky}"/><circle cx="1390" cy="160" r="71" fill="#f9e9ad"/><circle cx="1405" cy="147" r="55" fill="#fff0bd"/>${clouds}${mountains}${hills}${plants}`;
  await Bun.write(
    new URL(`${id}.svg`, root),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1792 1024" width="1792" height="1024"><title>${WORLD_MAPS[id].name} original layered cartoon backdrop</title>${artwork}</svg>`,
  );
  const rows = makeWorld(id);
  let terrain = "";
  let rim = "";
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      if (row[x] === "1" && rows[y - 1]?.[x] !== "1")
        rim += `M${x * CELL} ${y * CELL}h${CELL}v6h-${CELL}Z`;
      if (row[x] === "1" && start < 0) start = x;
      if (row[x] !== "1" && start >= 0) {
        terrain += `M${start * CELL} ${y * CELL}h${(x - start) * CELL}v${CELL}H${start * CELL}Z`;
        start = -1;
      }
    }
  }
  const strata = Array.from(
    { length: 8 },
    (_, i) =>
      `<path d="M0 ${340 + i * 100}Q400 ${260 + i * 100} 896 ${355 + i * 100}T1792 ${320 + i * 100}v28Q1300 ${345 + i * 100} 896 ${386 + i * 100}T0 ${368 + i * 100}Z" fill="${coast ? "#bb805d" : "#8d6650"}"/>`,
  ).join("");
  await Bun.write(
    new URL(`${id}-preview.svg`, root),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1792 1024"><title>${WORLD_MAPS[id].name} playable terrain preview</title><defs><clipPath id="land"><path d="${terrain}"/></clipPath></defs>${artwork}<path d="${terrain}" fill="${coast ? "#9d6250" : "#715044"}"/><g clip-path="url(#land)">${strata}</g><path d="${rim}" fill="${coast ? "#e1b274" : "#9abc68"}"/></svg>`,
  );
}
