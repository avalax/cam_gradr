// A drawn room with a person at a desk: the subject of the picture in the README. The colors are
// what the corrected camera should show (sRGB); the shapes are made up.
export const ROOM_COLORS = {
  wall: '#cbbba3',
  wallShade: '#b3a38b',
  frame: '#eeeae2',
  sky: '#9fc3e4',
  skyLight: '#d6e6f3',
  hillsFar: '#93b183',
  hills: '#6f9a55',
  wood: '#8a6243',
  desk: '#6e4b32',
  book1: '#8c2f39',
  book2: '#2f5d7c',
  book3: '#d9a441',
  book4: '#3f6b45',
  vase: '#e9e4da',
  pot: '#b5643a',
  leaf: '#4d7f45',
  leafLight: '#6ea35d',
  cord: '#3a3a3a',
  lampShade: '#2f2f2f',
  bulb: '#fff3d6',
  glow: '#e2d3b3',
  sweater: '#2e4a68',
  sweaterShade: '#233a52',
  shirt: '#e8e4dc',
  skin: '#e2ab8a',
  skinShade: '#c98d6c',
  hair: '#3a281d',
  lips: '#b56a5c',
  mug: '#ecebe6',
  mugStripe: '#c0392b',
  card: '#1f1f1f',
  g1: '#f2f2f2',
  g2: '#c8c8c8',
  g3: '#9b9b9b',
  g4: '#6e6e6e',
  g5: '#474747',
  g6: '#252525',
  red: '#c0392b',
  yellow: '#e3b93a',
  green: '#3e8e41',
  cyan: '#2a9cb0',
  blue: '#2f5fa8',
  magenta: '#a8467e',
} as const;

export type RoomColors = Record<keyof typeof ROOM_COLORS, string>;

const PATCH_ROWS = [
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'],
  ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'],
] as const;

// Six square patches in a row on the small card on the desk.
function patchRow(c: RoomColors, row: 0 | 1): string {
  return PATCH_ROWS[row]
    .map(
      (key, index) =>
        `<rect x="${String(206 + index * 52)}" y="${String(584 + row * 54)}" width="44" height="44" fill="${c[key]}"/>`,
    )
    .join('');
}

// The room as SVG markup (1600 × 900, drawn at the size of the camera image). Framed like a talking
// head video by the rule of thirds: the eyes on the upper third line (y 300), the face on the right
// third line (x 1067).
export function roomSvg(c: RoomColors): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
<rect width="1600" height="900" fill="${c.wall}"/>
<rect x="1240" width="360" height="900" fill="${c.wallShade}"/>
<ellipse cx="660" cy="250" rx="230" ry="180" fill="${c.glow}"/>
<rect x="110" y="96" width="440" height="500" fill="${c.frame}"/>
<rect x="134" y="120" width="392" height="452" fill="${c.sky}"/>
<ellipse cx="330" cy="400" rx="180" ry="100" fill="${c.skyLight}"/>
<path d="M134 470 Q230 410 330 450 T526 430 V572 H134 Z" fill="${c.hillsFar}"/>
<path d="M134 520 Q260 470 380 510 T526 500 V572 H134 Z" fill="${c.hills}"/>
<rect x="322" y="120" width="16" height="452" fill="${c.frame}"/>
<rect x="134" y="338" width="392" height="16" fill="${c.frame}"/>
<rect x="92" y="590" width="476" height="24" fill="${c.frame}"/>
<rect x="1270" y="186" width="34" height="114" fill="${c.book1}"/>
<rect x="1308" y="204" width="30" height="96" fill="${c.book2}"/>
<rect x="1342" y="176" width="40" height="124" fill="${c.book3}"/>
<rect x="1386" y="214" width="28" height="86" fill="${c.book4}"/>
<path d="M1450 300 C1438 260 1446 236 1462 226 L1462 206 L1486 206 L1486 226 C1502 236 1510 260 1498 300 Z" fill="${c.vase}"/>
<rect x="1250" y="300" width="300" height="16" fill="${c.wood}"/>
<rect x="658" y="0" width="4" height="124" fill="${c.cord}"/>
<path d="M600 198 L628 120 H692 L720 198 Z" fill="${c.lampShade}"/>
<ellipse cx="660" cy="199" rx="44" ry="10" fill="${c.bulb}"/>
<ellipse cx="1440" cy="520" rx="70" ry="120" fill="${c.leaf}" transform="rotate(-20 1440 520)"/>
<ellipse cx="1520" cy="510" rx="60" ry="130" fill="${c.leafLight}" transform="rotate(22 1520 510)"/>
<ellipse cx="1480" cy="470" rx="50" ry="140" fill="${c.leaf}"/>
<path d="M1021 380 L1017 490 L1117 490 L1113 380 Z" fill="${c.skinShade}"/>
<path d="M842 900 L839 615 C839 548 861 516 899 506 L1005 470 L1067 548 L1129 470 L1235 506 C1273 516 1295 548 1295 615 L1292 900 Z" fill="${c.sweater}"/>
<path d="M1005 470 L1067 548 L1129 470 Z" fill="${c.shirt}"/>
<path d="M1041 470 L1067 502 L1093 470 Z" fill="${c.skinShade}"/>
<path d="M1295 900 L1295 650 C1280 710 1262 790 1258 900 Z" fill="${c.sweaterShade}"/>
<path d="M893 900 C893 800 897 730 906 690 M1241 900 C1241 800 1237 730 1228 690" stroke="${c.sweaterShade}" stroke-width="6" fill="none" stroke-linecap="round"/>
<g transform="translate(267 -84)">
<ellipse cx="714" cy="392" rx="16" ry="30" fill="${c.skinShade}"/>
<ellipse cx="886" cy="392" rx="16" ry="30" fill="${c.skinShade}"/>
<ellipse cx="800" cy="380" rx="88" ry="110" fill="${c.skin}"/>
<path d="M712 372 C700 280 760 248 806 250 C860 252 904 290 888 372 C872 330 830 310 790 314 C752 318 724 336 712 372 Z" fill="${c.hair}"/>
<ellipse cx="770" cy="384" rx="7" ry="9" fill="${c.hair}"/>
<ellipse cx="830" cy="384" rx="7" ry="9" fill="${c.hair}"/>
<path d="M772 440 Q800 454 828 440" stroke="${c.lips}" stroke-width="7" fill="none" stroke-linecap="round"/>
</g>
<rect x="0" y="700" width="1600" height="200" fill="${c.desk}"/>
<rect x="0" y="690" width="1600" height="22" fill="${c.wood}"/>
<path d="M1410 600 H1550 L1534 700 H1426 Z" fill="${c.pot}"/>
<path d="M726 624 h20 a22 22 0 0 1 0 44 h-20" stroke="${c.mug}" stroke-width="10" fill="none"/>
<rect x="640" y="604" width="90" height="96" rx="10" fill="${c.mug}"/>
<rect x="640" y="636" width="90" height="16" fill="${c.mugStripe}"/>
<rect x="190" y="572" width="330" height="124" rx="6" fill="${c.card}"/>
${patchRow(c, 0)}
${patchRow(c, 1)}
</svg>`;
}
