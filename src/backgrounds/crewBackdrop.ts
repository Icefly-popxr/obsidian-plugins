/**
 * crewBackdrop — 海贼王全员背景图（内联 SVG data URI，无外部资源）
 * 深蓝黄昏海天 + 桑尼号 + 草帽团全员剪影 + 海贼旗
 * 作为工作台背景层，叠加 MoltenBackground 熔岩动态效果。
 */

function esc(svg: string): string {
  // data URI 编码：# → %23，其余保留（属性用单引号）
  return svg.replace(/#/g, "%23");
}

export function crewBackdropDataUri(): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 560' preserveAspectRatio='xMidYMid slice'>
<defs>
  <linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0' stop-color='#12263c'/>
    <stop offset='.5' stop-color='#1d3a55'/>
    <stop offset='.8' stop-color='#2b5573'/>
    <stop offset='1' stop-color='#3e6d8c'/>
  </linearGradient>
  <linearGradient id='sea' x1='0' y1='0' x2='0' y2='1'>
    <stop offset='0' stop-color='#16324a'/>
    <stop offset='1' stop-color='#0a1420'/>
  </linearGradient>
  <radialGradient id='sun' cx='.5' cy='.5' r='.5'>
    <stop offset='0' stop-color='#fde68a' stop-opacity='.9'/>
    <stop offset='.5' stop-color='#fde68a' stop-opacity='.3'/>
    <stop offset='1' stop-color='#fde68a' stop-opacity='0'/>
  </radialGradient>
</defs>

<rect width='1600' height='560' fill='url(#sky)'/>
<circle cx='1180' cy='180' r='150' fill='url(#sun)'/>
<circle cx='1180' cy='180' r='46' fill='#fde68a' opacity='.85'/>

<!-- 云 -->
<g fill='#ffffff' opacity='.14'>
  <ellipse cx='300' cy='130' rx='200' ry='36'/>
  <ellipse cx='760' cy='96' rx='240' ry='40'/>
  <ellipse cx='1360' cy='150' rx='180' ry='32'/>
  <ellipse cx='520' cy='240' rx='160' ry='26'/>
</g>

<!-- 海贼旗（右上） -->
<g transform='translate(1380,60)'>
  <rect x='-6' y='0' width='8' height='150' rx='3' fill='#3a2c08'/>
  <circle cx='-2' cy='0' r='9' fill='#fbbf24'/>
  <path d='M4,10 C34,2 60,6 84,10 L84,96 C60,100 34,96 4,92 Z' fill='#0d1b2e' stroke='#1e2632' stroke-width='1.5'/>
  <g transform='translate(44,52)' fill='#e8e0c8'>
    <ellipse cx='0' cy='-6' rx='13' ry='15'/>
    <ellipse cx='-5' cy='-9' rx='4' ry='5' fill='#0d1b2e'/>
    <ellipse cx='5' cy='-9' rx='4' ry='5' fill='#0d1b2e'/>
    <path d='M-1.5,0 L0,5 L1.5,0 Z' fill='#0d1b2e'/>
    <rect x='-7' y='6' width='3.2' height='5' rx='1' fill='#0d1b2e'/>
    <rect x='-2.4' y='6' width='3.2' height='7' rx='1' fill='#0d1b2e'/>
    <rect x='2.4' y='6' width='3.2' height='7' rx='1' fill='#0d1b2e'/>
    <rect x='6.8' y='6' width='3.2' height='5' rx='1' fill='#0d1b2e'/>
  </g>
  <g transform='translate(44,96)' fill='#e8e0c8' opacity='.9'>
    <rect x='-20' y='-4' width='40' height='8' rx='4' transform='rotate(-18)'/>
    <rect x='-20' y='-4' width='40' height='8' rx='4' transform='rotate(18)'/>
    <circle cx='-14' cy='-13' r='4.6'/><circle cx='14' cy='13' r='4.6'/>
    <circle cx='14' cy='-13' r='4.6'/><circle cx='-14' cy='13' r='4.6'/>
  </g>
</g>

<!-- 海 -->
<rect y='380' width='1600' height='180' fill='url(#sea)'/>
<path d='M0,400 Q200,368 400,400 T800,400 T1200,400 T1600,400 L1600,560 L0,560 Z' fill='#0d1b2e' opacity='.55'/>
<path d='M0,430 Q240,398 480,430 T960,430 T1440,430 T1600,430' stroke='#2b5573' stroke-width='2' fill='none' opacity='.5'/>
<path d='M0,462 Q260,432 520,462 T1040,462 T1600,462' stroke='#2b5573' stroke-width='2' fill='none' opacity='.35'/>

<!-- 桑尼号 -->
<g>
  <!-- 船体 -->
  <path d='M420,420 Q800,352 1180,420 L1150,470 Q800,410 450,470 Z' fill='#0d1b2e'/>
  <path d='M1150,420 L1200,430 L1210,470 L1150,470 Z' fill='#0d1b2e'/>
  <!-- 羊头船首 -->
  <g transform='translate(1210,392)'>
    <ellipse cx='0' cy='0' rx='34' ry='29' fill='#fdf1e1'/>
    <ellipse cx='-13' cy='-9' rx='8' ry='11' fill='#0d1b2e'/>
    <ellipse cx='13' cy='-9' rx='8' ry='11' fill='#0d1b2e'/>
    <path d='M-10,8 Q0,15 10,8 L5,22 L-5,22 Z' fill='#0d1b2e'/>
    <path d='M0,-34 Q-12,-56 -34,-66' stroke='#fdf1e1' stroke-width='7' fill='none' stroke-linecap='round'/>
    <path d='M0,-34 Q12,-56 34,-66' stroke='#fdf1e1' stroke-width='7' fill='none' stroke-linecap='round'/>
  </g>
  <!-- 桅杆 + 帆 -->
  <rect x='812' y='120' width='8' height='310' fill='#0d1b2e'/>
  <path d='M816,130 Q940,220 816,330 Z' fill='#fdf1e1' opacity='.85'/>
  <path d='M816,140 Q700,230 816,320 Z' fill='#fdf1e1' opacity='.6'/>
  <rect x='980' y='180' width='7' height='250' fill='#0d1b2e'/>
  <path d='M984,190 Q1080,260 984,360 Z' fill='#fdf1e1' opacity='.75'/>
  <!-- 旗 -->
  <g transform='translate(816,120)'>
    <path d='M0,0 Q20,-4 42,0 L42,26 Q20,30 0,26 Z' fill='#e11d2e'/>
    <circle cx='24' cy='8' r='6' fill='#fdf1e1'/>
    <circle cx='22' cy='7' r='2' fill='#e11d2e'/><circle cx='26' cy='7' r='2' fill='#e11d2e'/>
    <path d='M20,14 L24,17 L28,14 Z' fill='#e11d2e'/>
  </g>
</g>

<!-- 草帽团全员剪影（桑尼号甲板上） -->
<g fill='#060d16'>
  <!-- 1 路飞（草帽） -->
  <g transform='translate(500,318)'>
    <ellipse cx='0' cy='-86' rx='30' ry='34'/>
    <ellipse cx='0' cy='-116' rx='46' ry='10'/>
    <path d='M-30,-116 Q0,-148 30,-116 Z'/>
    <path d='M-20,-58 Q0,-30 20,-58 L26,-18 Q0,8 -26,-18 Z'/>
    <path d='M-8,6 Q-20,26 -30,30 L-26,-14 Z'/><path d='M8,6 Q20,26 30,30 L26,-14 Z'/>
    <rect x='-7' y='6' width='14' height='26' rx='6'/>
  </g>
  <!-- 2 索隆（三刀流） -->
  <g transform='translate(585,320)'>
    <rect x='-4' y='-132' width='8' height='18' fill='#0d1b2e'/>
    <rect x='-24' y='-132' width='8' height='14' fill='#0d1b2e' transform='rotate(-24)'/>
    <rect x='20' y='-132' width='8' height='14' fill='#0d1b2e' transform='rotate(24)'/>
    <ellipse cx='0' cy='-104' rx='26' ry='30'/>
    <rect x='-28' y='-112' width='56' height='12' rx='4'/>
    <path d='M-20,-74 Q0,-46 20,-74 L26,-40 Q0,-16 -26,-40 Z'/>
    <path d='M-12,20 Q-18,40 -26,44 L-24,-16 Z'/><path d='M12,20 Q18,40 26,44 L24,-16 Z'/>
    <rect x='-7' y='20' width='14' height='24' rx='6'/>
  </g>
  <!-- 3 山治（西装） -->
  <g transform='translate(665,322)'>
    <ellipse cx='0' cy='-104' rx='24' ry='28'/>
    <path d='M-8,-86 Q0,-102 8,-86 L6,-60 L-6,-60 Z' fill='#0d1b2e'/>
    <path d='M-18,-58 L18,-58 L22,-30 L-22,-30 Z'/>
    <path d='M-2,-30 L0,-14 L2,-30 Z' fill='#fdf1e1'/>
    <path d='M-10,12 Q-16,30 -22,34 L-20,-18 Z'/><path d='M10,12 Q16,30 22,34 L20,-18 Z'/>
    <rect x='-6' y='12' width='12' height='22' rx='5'/>
  </g>
  <!-- 4 娜美（长发） -->
  <g transform='translate(738,322)'>
    <ellipse cx='0' cy='-102' rx='23' ry='27'/>
    <path d='M-22,-96 Q-34,-40 -26,20 L-12,-8 Z'/>
    <path d='M22,-96 Q34,-40 26,20 L12,-8 Z'/>
    <path d='M-16,-76 Q0,-50 16,-76 L20,-38 Q0,-16 -20,-38 Z'/>
    <path d='M-8,12 Q-14,28 -20,32 L-18,-16 Z'/><path d='M8,12 Q14,28 20,32 L18,-16 Z'/>
    <rect x='-6' y='12' width='12' height='20' rx='5'/>
  </g>
  <!-- 5 乌索普（长帽） -->
  <g transform='translate(808,324)'>
    <ellipse cx='0' cy='-98' rx='22' ry='26'/>
    <path d='M0,-128 L18,-108 Q20,-104 0,-98 Q-20,-104 -18,-108 Z'/>
    <rect x='-14' y='-120' width='28' height='8' rx='3'/>
    <path d='M-14,-72 Q0,-48 14,-72 L18,-40 Q0,-18 -18,-40 Z'/>
    <path d='M-8,12 Q-13,28 -19,32 L-17,-14 Z'/><path d='M8,12 Q13,28 19,32 L17,-14 Z'/>
    <rect x='-6' y='12' width='12' height='20' rx='5'/>
  </g>
  <!-- 6 乔巴（小个） -->
  <g transform='translate(872,370)'>
    <ellipse cx='0' cy='-58' rx='19' ry='22'/>
    <ellipse cx='0' cy='-74' rx='24' ry='12'/>
    <path d='M-24,-74 Q-18,-92 -8,-92 L8,-92 Q18,-92 24,-74 Z'/>
    <path d='M-13,-40 Q0,-22 13,-40 L16,-18 Q0,-2 -16,-18 Z'/>
    <rect x='-5' y='-16' width='10' height='18' rx='5'/>
    <rect x='-8' y='2' width='16' height='12' rx='4'/>
  </g>
  <!-- 7 罗宾（宽檐帽长发） -->
  <g transform='translate(935,322)'>
    <ellipse cx='0' cy='-104' rx='24' ry='28'/>
    <ellipse cx='0' cy='-122' rx='36' ry='12'/>
    <path d='M-22,-104 Q-36,-48 -28,16 L-14,-6 Z'/>
    <path d='M22,-104 Q36,-48 28,16 L14,-6 Z'/>
    <path d='M-16,-78 Q0,-52 16,-78 L20,-40 Q0,-18 -20,-40 Z'/>
    <path d='M-9,12 Q-15,28 -21,32 L-19,-16 Z'/><path d='M9,12 Q15,28 21,32 L19,-16 Z'/>
    <rect x='-6' y='12' width='12' height='20' rx='5'/>
  </g>
  <!-- 8 弗兰奇（高大飞机头） -->
  <g transform='translate(1005,308)'>
    <ellipse cx='0' cy='-112' rx='26' ry='30'/>
    <path d='M0,-150 Q6,-138 4,-122 L-4,-122 Q-6,-138 0,-150 Z'/>
    <path d='M-22,-96 Q0,-66 22,-96 L28,-56 Q0,-26 -28,-56 Z'/>
    <rect x='-26' y='-56' width='52' height='18' rx='6'/>
    <path d='M-14,8 Q-22,28 -30,32 L-26,-20 Z'/><path d='M14,8 Q22,28 30,32 L26,-20 Z'/>
    <rect x='-8' y='8' width='16' height='28' rx='7'/>
  </g>
  <!-- 9 布鲁克（高瘦礼帽） -->
  <g transform='translate(1080,316)'>
    <ellipse cx='0' cy='-108' rx='20' ry='26'/>
    <rect x='-12' y='-136' width='24' height='16' rx='4'/>
    <rect x='-10' y='-146' width='20' height='12' rx='3'/>
    <path d='M-13,-82 Q0,-58 13,-82 L16,-44 Q0,-24 -16,-44 Z'/>
    <path d='M-8,8 Q-12,24 -18,28 L-16,-16 Z'/><path d='M8,8 Q12,24 18,28 L16,-16 Z'/>
    <rect x='-5' y='8' width='10' height='22' rx='5'/>
    <line x1='14' y1='-8' x2='34' y2='16' stroke='#0d1b2e' stroke-width='4' stroke-linecap='round'/>
  </g>
  <!-- 10 甚平（大块头） -->
  <g transform='translate(1148,312)'>
    <ellipse cx='0' cy='-106' rx='28' ry='32'/>
    <path d='M-24,-90 Q-2,-62 24,-90 L30,-48 Q0,-22 -30,-48 Z'/>
    <path d='M-16,10 Q-24,30 -32,34 L-28,-20 Z'/><path d='M16,10 Q24,30 32,34 L28,-20 Z'/>
    <rect x='-8' y='10' width='16' height='26' rx='7'/>
  </g>
</g>

<!-- 船缘压暗 -->
<path d='M400,470 Q800,410 1180,470 L1210,470 L1200,430 L1150,420 Q800,352 420,420 Z' fill='#0a1420' opacity='.0'/>
</svg>`;
  return "data:image/svg+xml;utf8," + esc(svg);
}
