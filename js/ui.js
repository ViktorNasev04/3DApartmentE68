/* ---------- page-only logic (runs even if 3D fails) ---------- */
(function(){
  const state = window.__room = window.__room || { layout:'corner', mode:'evening', view:'tv', listeners:[] };

  /* depth list */
  function renderDepth(){
    const corner = state.layout === 'corner';
    const rows = corner ? [
      ['38', 'ТВ секция', 'висящ шкаф и колони'],
      ['107', 'Проход до дивана', 'удобно се минава, без масичка отпред'],
      ['100', 'Диван', 'с лице на север'],
      ['205', 'Свободно зад дивана', 'широк проход към кухнята и масата'],
      ['Ø120', 'Маса KLIPLEV в ъгъла', 'на 20 см от източната и южната стена, три стола откъм стаята']
    ] : [
      ['38', 'ТВ секция', 'висящ шкаф и колони'],
      ['107', 'Проход до дивана', 'удобно се минава, без масичка отпред'],
      ['100', 'Диван', 'с лице на север'],
      ['15', 'Зад дивана до масата', 'масата опира почти в облегалката', true],
      ['Ø120', 'Маса KLIPLEV', 'три стола: изток, запад и юг'],
      ['70', 'До южната стена', 'столът на юг влиза на ръба', true]
    ];
    document.getElementById('depth').innerHTML = rows.map(r =>
      `<li class="${r[3] ? 'tight' : ''}"><span class="v">${r[0]}</span><span class="t">${r[1]}<small>${r[2]}</small></span></li>`
    ).join('');
    document.getElementById('plan-intro').textContent = corner
      ? 'Масата е в югоизточния ъгъл, вдясно зад дивана. Така зад дивана остават 2 м свободно място, пред кухнята се работи спокойно и масата е близо до прозореца.'
      : 'Ако масата е точно зад дивана, секцията, диванът и масата се нареждат на една ос. От север на юг стаята има само 4.50 м, затова сантиметрите стигат на ръба.';
  }

  /* plan */
  function renderPlan(){
    const corner = state.layout === 'corner';
    const R = 60, cx = corner ? 440 : 270, cz = corner ? 370 : 320, chairD = 77.5;
    const angles = corner ? [-75, -135, 165] : [180, 0, 90];
    const chairs = angles.map(a => {
      const rad = a*Math.PI/180, x = cx + Math.cos(rad)*chairD, z = cz + Math.sin(rad)*chairD;
      return `<g transform="translate(${x.toFixed(1)} ${z.toFixed(1)}) rotate(${a - 90})"><rect x="-23" y="-23" width="46" height="46" rx="9" fill="var(--paper)" stroke="var(--muted)" stroke-width="1.6"/><path d="M-21 18 Q0 30 21 18" fill="none" stroke="var(--oak)" stroke-width="3"/></g>`;
    }).join('');

    /* tiles 60x120, 1/3 offset */
    let tiles = '';
    for (let r = 0; r <= 7; r++) tiles += `<line x1="0" y1="${r*60}" x2="520" y2="${r*60}"/>`;
    for (let r = 0; r < 8; r++){
      const off = -((r%3)*40);
      for (let x = off; x < 520; x += 120) if (x > 0) tiles += `<line x1="${x}" y1="${r*60}" x2="${x}" y2="${Math.min(450,(r+1)*60)}"/>`;
    }

    const ticks = corner ? [0,38,145,245,450] : [0,38,145,245,260,380,450];
    const labels = corner ? ['38','107','100','205'] : ['38','107','100','15','120','70'];
    const tight = corner ? [false,false,false,false] : [false,false,false,true,false,true];
    let chain = `<line x1="560" y1="0" x2="560" y2="450" stroke="var(--muted)" stroke-width="1.2"/>`;
    ticks.forEach(t => chain += `<line x1="552" y1="${t}" x2="568" y2="${t}" stroke="var(--muted)" stroke-width="1.2"/>`);
    labels.forEach((l,i) => {
      const y = (ticks[i]+ticks[i+1])/2 + 6;
      const yy = (!corner && i === 3) ? y + 4 : y;
      chain += `<text class="d" x="${i===3?574:574}" y="${yy}" font-size="22" fill="${tight[i]?'var(--warn)':'var(--ink)'}">${l}</text>`;
    });

    const svg = `
<svg viewBox="-70 -78 690 590" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="План на дневната в мащаб">
  <rect x="0" y="0" width="520" height="450" fill="var(--paper)"/>
  <g stroke="var(--line)" stroke-width="1">${tiles}</g>

  <!-- kitchen -->
  <rect x="0" y="175" width="62" height="275" fill="var(--line)"/>
  <rect x="62" y="388" width="60" height="62" fill="var(--line)"/>
  <line x1="0" y1="240" x2="62" y2="240" stroke="var(--muted)" stroke-width="1"/>
  <text x="31" y="330" font-size="19" fill="var(--muted)" text-anchor="middle" transform="rotate(-90 31 330)" letter-spacing="2">КУХНЯ</text>

  <!-- rug -->
  <rect x="150" y="60" width="240" height="160" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="6 6"/>

  <!-- tv wall -->
  <rect x="130" y="0" width="280" height="38" fill="var(--oak)"/>
  <rect x="175" y="0" width="190" height="6" fill="var(--paper)"/>
  <rect x="197.5" y="6" width="145" height="4" fill="var(--ink)"/>
  <text x="270" y="25" font-size="16" fill="#fff" text-anchor="middle" letter-spacing="1.5">ТВ СЕКЦИЯ 280</text>

  <!-- sofa -->
  <rect x="140" y="145" width="260" height="100" rx="34" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.8"/>
  <rect x="170" y="215" width="200" height="22" rx="11" fill="none" stroke="var(--muted)" stroke-width="1"/>
  <text x="270" y="191" font-size="22" fill="var(--ink)" text-anchor="middle">диван 260</text>
  <path d="M270 151 l-7 10 h14 z" fill="var(--ink)"/>

  <!-- side table, plant -->
  <circle cx="425" cy="175" r="20" fill="none" stroke="var(--muted)" stroke-width="1.4"/>
  <circle cx="82" cy="45" r="24" fill="var(--olive)" fill-opacity=".28" stroke="var(--olive)" stroke-width="1.2"/>

  <!-- dining -->
  ${chairs}
  <circle cx="${cx}" cy="${cz}" r="${R}" fill="var(--oak)" fill-opacity=".22" stroke="var(--oak)" stroke-width="2"/>
  <circle cx="${cx}" cy="${cz}" r="${R*0.3}" fill="none" stroke="var(--oak)" stroke-width="1" stroke-dasharray="3 4"/>
  <text x="${cx}" y="${cz+6}" font-size="22" fill="var(--ink)" text-anchor="middle" class="d">Ø120</text>

  <!-- walls -->
  <g fill="var(--ink)">
    <rect x="-14" y="-14" width="426" height="14"/>
    <rect x="512" y="-14" width="22" height="14"/>
    <rect x="-14" y="-14" width="14" height="29"/>
    <rect x="-14" y="165" width="14" height="285"/>
    <rect x="520" y="-14" width="14" height="59"/>
    <rect x="520" y="205" width="14" height="245"/>
    <rect x="-14" y="450" width="548" height="20"/>
  </g>
  <!-- window east -->
  <g stroke="var(--ink)" stroke-width="1.4"><line x1="522" y1="45" x2="522" y2="205"/><line x1="532" y1="45" x2="532" y2="205"/><line x1="527" y1="45" x2="527" y2="205"/></g>
  <path d="M514 40 q-5 10 0 20 q5 10 0 20 q-5 10 0 20 q5 10 0 20 q-5 10 0 20 q5 10 0 20 q-5 10 0 20 q5 10 0 20 q-5 10 0 20" fill="none" stroke="var(--muted)" stroke-width="1"/>
  <!-- loggia door -->
  <line x1="412" y1="-7" x2="512" y2="-7" stroke="var(--ink)" stroke-width="1.4"/>
  <path d="M412 0 A100 100 0 0 0 512 100" fill="none" stroke="var(--muted)" stroke-width="1" stroke-dasharray="5 5"/>
  <line x1="512" y1="0" x2="512" y2="100" stroke="var(--muted)" stroke-width="1.4"/>
  <text x="462" y="-26" font-size="19" fill="var(--muted)" text-anchor="middle">лоджия</text>
  <text x="-22" y="96" font-size="19" fill="var(--muted)" text-anchor="end" transform="rotate(-90 -22 96)">антре</text>
  <text x="498" y="128" font-size="19" fill="var(--muted)" text-anchor="end" transform="rotate(-90 498 128)">прозорец</text>

  <!-- dims -->
  ${chain}
  <g stroke="var(--muted)" stroke-width="1.2">
    <line x1="0" y1="-48" x2="520" y2="-48"/><line x1="0" y1="-56" x2="0" y2="-40"/><line x1="520" y1="-56" x2="520" y2="-40"/>
    <line x1="62" y1="200" x2="140" y2="200"/><line x1="62" y1="193" x2="62" y2="207"/><line x1="140" y1="193" x2="140" y2="207"/>
    <line x1="400" y1="232" x2="520" y2="232"/><line x1="400" y1="225" x2="400" y2="239"/><line x1="520" y1="225" x2="520" y2="239"/>
  </g>
  <text class="d" x="260" y="-56" font-size="22" fill="var(--ink)" text-anchor="middle">520</text>
  <text class="d" x="101" y="194" font-size="22" fill="var(--ink)" text-anchor="middle">78</text>
  <text class="d" x="460" y="226" font-size="22" fill="var(--ink)" text-anchor="middle">120</text>

  <!-- north -->
  <g transform="translate(-42 -54)">
    <path d="M0 -14 L7 8 L0 4 L-7 8 Z" fill="var(--ink)"/>
    <text x="0" y="26" font-size="19" font-weight="700" text-anchor="middle" fill="var(--ink)">С</text>
  </g>
</svg>`;
    document.getElementById('plan').innerHTML = svg;
  }

  function syncButtons(){
    document.getElementById('l-corner').setAttribute('aria-pressed', state.layout === 'corner');
    document.getElementById('l-center').setAttribute('aria-pressed', state.layout === 'center');
    document.getElementById('m-eve').setAttribute('aria-pressed', state.mode === 'evening');
    document.getElementById('m-day').setAttribute('aria-pressed', state.mode === 'day');
    document.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === state.view));
  }
  state.emit = function(){ syncButtons(); renderDepth(); renderPlan(); state.listeners.forEach(f => { try{ f(state); }catch(e){} }); };

  document.getElementById('l-corner').addEventListener('click', () => { state.layout = 'corner'; state.layoutChanged = true; state.emit(); });
  document.getElementById('l-center').addEventListener('click', () => { state.layout = 'center'; state.layoutChanged = true; state.emit(); });
  document.getElementById('m-eve').addEventListener('click', () => { state.mode = 'evening'; state.emit(); });
  document.getElementById('m-day').addEventListener('click', () => { state.mode = 'day'; state.emit(); });
  document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; state.viewChanged = true; state.emit(); }));

  const copyBtn = document.getElementById('copy');
  copyBtn.addEventListener('click', () => {
    const txt = document.getElementById('prompt-text').textContent;
    const done = () => { copyBtn.textContent = 'Копирано'; setTimeout(() => copyBtn.textContent = 'Копирай текста', 1800); };
    const fallback = () => {
      const r = document.createRange(); r.selectNodeContents(document.getElementById('prompt-text'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      copyBtn.textContent = 'Маркирано — копирай';
      setTimeout(() => copyBtn.textContent = 'Копирай текста', 2400);
    };
    try { navigator.clipboard.writeText(txt).then(done, fallback); } catch(e){ fallback(); }
  });

  syncButtons(); renderDepth(); renderPlan();
  setTimeout(() => {
    if (window.__ready) return;
    const v = document.getElementById('veil');
    v.classList.remove('off');
    v.innerHTML = '3D изгледът не се зареди<small>Планът отдолу е в мащаб</small>';
  }, 25000);
})();
