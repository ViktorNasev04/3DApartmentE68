/* Ready-made arrangements. Positions are metres in plan coordinates (x east, z south), rot in degrees (0 = front faces south). */

const FLOORS = { living: 'tile', antre: 'tile', corridor: 'tile', bath: 'beige', bed: 'tile', loggia: 'outdoor' };

function common(){
  return [
    // kitchen: fridge column, run along the niche, short return with the hob
    { id: 'k-tall', type: 'kitchenTall', x: -0.24, z: 5.45, rot: 90, p: { W: 0.7, H: 2.2, color: 'greige' } },
    { id: 'k-run', type: 'kitchen', x: -0.24, z: 6.825, rot: 90, p: { L: 2.05, color: 'greige', sink: true, sinkAt: 1.13, hob: false, hobAt: 0.45, uppers: true } },
    { id: 'k-ret', type: 'kitchen', x: 0.51, z: 7.55, rot: 180, p: { L: 0.9, color: 'greige', sink: false, sinkAt: 0.45, hob: true, hobAt: 0.45, uppers: false } },
    // bedroom, after the collage: stacked stone with LED, puffy bed, smoked-glass wardrobe, sideboard with shoe shelves
    { id: 'b-ward', type: 'wardrobe', x: 0.30, z: 0.85, rot: 90, p: { W: 1.7, D: 0.6, H: 2.6, finish: 'walnut', doors: 'glass' } },
    { id: 'b-stone', type: 'stonewall', x: 2.29, z: 0.025, rot: 0, p: { kind: 'ledge', W: 3.3, H: 2.65, led: true } },
    { id: 'b-bed', type: 'bed', x: 2.29, z: 1.28, rot: 0, p: { W: 1.6, head: 'puffy', linen: 'white' } },
    { id: 'b-shoe', type: 'shoeboard', x: 2.35, z: 3.08, rot: 180, p: { W: 2.0, D: 0.30, finish: 'greige', open: 'left', art: true } },
    // bathroom, after the collage: walk-in shower with a black-framed side panel, stone slab with LED, stacked stone wall
    { id: 'w-shower', type: 'shower', x: -1.57, z: 0.50, rot: 0, p: { glass: 'side', W: 0.9, D: 1.0, side: 'right' } },
    { id: 'w-vanity', type: 'vanity', x: -0.60, z: 0.235, rot: 0, p: { style: 'slab', W: 0.75, finish: 'oak', mirror: true } },
    { id: 'w-stone', type: 'stonewall', x: -0.15, z: 0.95, rot: 270, p: { kind: 'ledge', W: 1.9, H: 2.65, led: true } },
    { id: 'w-towel', type: 'towel', x: -0.20, z: 0.62, rot: 270, p: {} },
    { id: 'w-mat', type: 'rug', x: -0.72, z: 1.18, rot: 0, p: { W: 0.8, D: 0.5, round: false, color: 'olive' } },
    { id: 'w-wc', type: 'toilet', x: -1.69, z: 1.45, rot: 90, p: { kind: 'floor' } },
    { id: 'w-washer', type: 'washer', x: -1.72, z: 2.32, rot: 90, p: {} },
    { id: 'w-boiler', type: 'boiler', x: -1.79, z: 3.05, rot: 90, p: {} },
    { id: 'w-shelf', type: 'shelf', x: -1.57, z: 3.475, rot: 180, p: { W: 0.85, H: 1.8, finish: 'white' } },
    // entrance hall
    { id: 'a-ward', type: 'wardrobe', x: -1.405, z: 5.40, rot: 180, p: { W: 1.23, D: 0.6, H: 2.4, finish: 'greige', doors: 'sliding' } },
    { id: 'a-mirror', type: 'mirror', x: -1.50, z: 3.91, rot: 0, p: {} },
    // loggia
    { id: 'l-ac', type: 'ac', x: 5.05, z: 0.18, rot: 0, p: {} },
    { id: 'l-set', type: 'bistro', x: 5.05, z: 1.60, rot: 90, p: {} },
    { id: 'l-plant', type: 'plant', x: 5.40, z: 3.00, rot: 0, p: { S: 0.8 } },
  ];
}

const tvWall = () => ({ id: 'd-tv', type: 'tvunit', x: 2.88, z: 3.54, rot: 0, p: { style: 'stone', W: 2.8, tv: '65', decor: true } });
const olive = () => ({ id: 'd-plant', type: 'plant', x: 1.00, z: 3.80, rot: 0, p: { S: 1.0 } });
const cornerTable = () => [
  { id: 'd-table', type: 'tableRound', x: 3.76, z: 7.05, rot: 0, p: { D: 1.2, lamp: true } },
  { id: 'd-ch1', type: 'chair', x: 3.961, z: 6.301, rot: -15, p: {} },
  { id: 'd-ch2', type: 'chair', x: 3.212, z: 6.502, rot: 45, p: {} },
  { id: 'd-ch3', type: 'chair', x: 3.011, z: 7.251, rot: 105, p: {} },
];

export const PRESETS = [
  { id: 'straight', name: 'Прав диван, маса в ъгъла', note: 'Секцията и диванът на една ос, кръглата маса в югоизточния ъгъл.',
    layout: () => ({ floors: { ...FLOORS }, bond: 'third', dir: 0, items: [
      ...common(), tvWall(), olive(),
      { id: 'd-sofa', type: 'sofa', x: 2.88, z: 5.30, rot: 180, p: { kind: 'straight', L: 2.6, C: 1.65, D: 1.0, color: 'cream', pillows: true } },
      { id: 'd-rug', type: 'rug', x: 2.88, z: 4.75, rot: 0, p: { W: 2.4, D: 1.6, round: false, color: 'cream' } },
      { id: 'd-side', type: 'side', x: 4.43, z: 5.10, rot: 0, p: {} },
      ...cornerTable(),
    ] }) },
  { id: 'corner', name: 'Ъглов диван', note: 'Шезлонгът е откъм прозореца, масата остава в ъгъла.',
    layout: () => ({ floors: { ...FLOORS }, bond: 'third', dir: 0, items: [
      ...common(), tvWall(), olive(),
      { id: 'd-sofa', type: 'sofa', x: 2.88, z: 5.025, rot: 180, p: { kind: 'corner-l', L: 2.8, C: 1.55, D: 1.0, color: 'cream', pillows: true } },
      { id: 'd-rug', type: 'rug', x: 2.70, z: 4.60, rot: 0, p: { W: 2.2, D: 1.4, round: false, color: 'cream' } },
      { id: 'd-side', type: 'side', x: 1.25, z: 5.45, rot: 0, p: {} },
      ...cornerTable(),
    ] }) },
  { id: 'behind', name: 'Маса зад дивана', note: 'Секция, диван и маса на една ос. Зад дивана остават около 15 см.',
    layout: () => ({ floors: { ...FLOORS }, bond: 'third', dir: 0, items: [
      ...common(), tvWall(), olive(),
      { id: 'd-sofa', type: 'sofa', x: 2.88, z: 5.30, rot: 180, p: { kind: 'straight', L: 2.6, C: 1.65, D: 1.0, color: 'cream', pillows: true } },
      { id: 'd-rug', type: 'rug', x: 2.88, z: 4.75, rot: 0, p: { W: 2.4, D: 1.6, round: false, color: 'cream' } },
      { id: 'd-side', type: 'side', x: 4.43, z: 5.10, rot: 0, p: {} },
      { id: 'd-table', type: 'tableRound', x: 2.88, z: 6.55, rot: 0, p: { D: 1.2, lamp: true } },
      { id: 'd-ch1', type: 'chair', x: 3.655, z: 6.55, rot: -90, p: {} },
      { id: 'd-ch2', type: 'chair', x: 2.105, z: 6.55, rot: 90, p: {} },
      { id: 'd-ch3', type: 'chair', x: 2.88, z: 7.325, rot: 180, p: {} },
    ] }) },
  { id: 'cinema', name: 'Кино 5.1.2 с дивана в средата', sound: true, note: 'Dolby Atmos около правия диван: лява, централна и дясна в секцията, задните на 115°, две тонколони в тавана, субуферът до дивана.',
    layout: () => PRESETS.find(p => p.id === 'straight').layout() },
  { id: 'architect', name: 'Както е на плана', note: 'Подредбата от архитекта: ъглов диван до стената на спалнята, телевизор на южната стена, маса за четирима и бар плот до кухнята.',
    layout: () => ({ floors: { ...FLOORS }, bond: 'third', dir: 0, items: [
      ...common(),
      { id: 'd-sofa', type: 'sofa', x: 2.95, z: 4.275, rot: 0, p: { kind: 'corner-l', L: 2.7, C: 1.85, D: 0.95, color: 'sand', pillows: true } },
      { id: 'd-tv', type: 'tvunit', x: 2.71, z: 7.65, rot: 180, p: { style: 'lowboard', W: 1.8, tv: '65', decor: false } },
      { id: 'd-rug', type: 'rug', x: 2.30, z: 5.60, rot: 0, p: { W: 1.6, D: 1.2, round: false, color: 'sand' } },
      { id: 'd-table', type: 'tableRect', x: 3.56, z: 6.44, rot: 0, p: { L: 1.2, W: 0.8, legs: 'oak', lamp: true } },
      { id: 'd-ch1', type: 'chair', x: 3.26, z: 5.74, rot: 0, p: {} },
      { id: 'd-ch2', type: 'chair', x: 3.86, z: 5.74, rot: 0, p: {} },
      { id: 'd-ch3', type: 'chair', x: 3.26, z: 7.14, rot: 180, p: {} },
      { id: 'd-ch4', type: 'chair', x: 3.86, z: 7.14, rot: 180, p: {} },
      { id: 'd-bar', type: 'bar', x: 1.20, z: 6.95, rot: 90, p: { L: 1.8, D: 0.45, H: 0.9, top: 'stone', color: 'greige' } },
      olive(),
    ] }) },
];

export const DEFAULT_PRESET = 'straight';
export const presetLayout = id => ({ ...(PRESETS.find(p => p.id === id) || PRESETS[0]).layout(), rev: LAYOUT_REV });

/* rev 2: bedroom and bathroom follow the collages. A layout saved before that keeps everything else,
   but its bedroom and bathroom pieces are replaced by the new ones and the bathroom floor turns beige. */
export const LAYOUT_REV = 2;
const REDONE = /^(b-|w-(shower|vanity|stone|towel|mat|wc)$)/;
export function migrate(layout){
  if (!layout || (layout.rev || 1) >= LAYOUT_REV) return { layout, changed: false };
  const items = (layout.items || []).filter(i => !REDONE.test(i.id)).concat(common().filter(i => REDONE.test(i.id)));
  const floors = { ...(layout.floors || {}) };
  if (!floors.bath || floors.bath === 'tile') floors.bath = 'beige';
  return { layout: { ...layout, items, floors, rev: LAYOUT_REV }, changed: true };
}
