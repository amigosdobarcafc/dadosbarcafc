/* ABFC - biblioteca compartilhada de dados e estatísticas
   Usada pelo index.html (site público) e pelo admin.html (gerador de imagens) */

const ABFC = (function(){

  const MONTHS = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
  const SEASONS = [
    {months:[1,2,3], label:"1ª Temporada", sub:"Jan · Fev · Mar"},
    {months:[4,5,6], label:"2ª Temporada", sub:"Abr · Mai · Jun"},
    {months:[7,8,9,10,11,12], label:"3ª Temporada", sub:"Jul · Ago · Set · Out · Nov · Dez"},
  ];
  const CATEGORIAS_ARQUIVO = {
    craque:"⭐ Craque", defensor:"🛡️ Defensor", goleiro:"🧤 Goleiro",
    capitao:"🎗️ Capitão", coringa:"🃏 Coringa", bola_murcha:"💩 Bola Murcha"
  };
  const MARCOS = [10,25,50,75,100,150,200,250,300,400,500];

  async function fetchJSON(path, fallback){
    try{
      const r = await fetch(path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now(), {cache:'no-store'});
      if (!r.ok) return fallback;
      return await r.json();
    }catch(e){ return fallback; }
  }

  // Carrega manifest + legado + rodadas de todos os anos conhecidos.
  // basePath: prefixo pra chegar na pasta data/ (ex: '' ou '../')
  async function loadAllData(basePath){
    basePath = basePath || '';
    const manifest = await fetchJSON(basePath + 'data/manifest.json', {years:[]});
    const legacy = await fetchJSON(basePath + 'data/legacy_totals.json', {});
    const players = await fetchJSON(basePath + 'data/players.json', []);
    const rawYears = manifest.years && manifest.years.length ? manifest.years : [new Date().getFullYear()];
    const years = Array.from(new Set(rawYears.map(y => parseInt(y, 10)))); // normaliza e remove duplicatas
    const perYear = await Promise.all(years.map(y => fetchJSON(basePath + 'data/rounds_' + y + '.json', [])));
    let allRounds = [];
    years.forEach((y, i)=>{
      (perYear[i] || []).forEach(r=>{
        const [yy, mm] = r.data.split('-').map(Number);
        allRounds.push({...r, year:yy, month:mm});
      });
    });
    allRounds.sort((a,b)=> a.data.localeCompare(b.data));
    const currentYear = Math.max(...years);
    return {manifest, legacy, players, allRounds, years, currentYear};
  }

  function calcular(rounds){
    const g = {}, a = {}, ga = {}, j = {}, cat = {};
    Object.keys(CATEGORIAS_ARQUIVO).forEach(k => cat[k] = {});
    rounds.forEach(r=>{
      (r.presentes || []).forEach(p => j[p] = (j[p]||0) + 1);
      Object.entries(r.estatisticas || {}).forEach(([n, st])=>{
        g[n] = (g[n]||0) + (st.gols||0);
        a[n] = (a[n]||0) + (st.assists||0);
        ga[n] = (ga[n]||0) + (st.gols||0) + (st.assists||0);
      });
      Object.entries(r.destaques || {}).forEach(([k, arr])=>{
        if (!cat[k]) return;
        (arr||[]).forEach(n => { if (n) cat[k][n] = (cat[k][n]||0) + 1; });
      });
    });
    return {g, a, ga, j, cat};
  }

  function topN(counter, n){
    return Object.entries(counter).sort((x,y)=> y[1]-x[1]).slice(0, n);
  }

  function mergeCounters(...counters){
    const out = {};
    counters.forEach(c => Object.entries(c||{}).forEach(([n,v])=> out[n] = (out[n]||0) + v));
    return out;
  }

  function totals(rounds){
    const g={}, a={}, j={};
    rounds.forEach(r=>{
      (r.presentes||[]).forEach(p=> j[p]=(j[p]||0)+1);
      Object.entries(r.estatisticas||{}).forEach(([n,st])=>{
        g[n]=(g[n]||0)+(st.gols||0); a[n]=(a[n]||0)+(st.assists||0);
      });
    });
    return {g,a,j};
  }

  // Gera curiosidades cruzando estatísticas em torno de uma rodada específica.
  // allRoundsSorted precisa estar em ordem crescente de data (todas as temporadas/anos).
  function curiosidadesDaRodada(allRoundsSorted, legacy, targetRound){
    const idx = allRoundsSorted.findIndex(r => r.data === targetRound.data);
    if (idx < 0) return [];
    const before = allRoundsSorted.slice(0, idx);
    const upTo = allRoundsSorted.slice(0, idx+1);
    const seasonBefore = before.filter(r=>r.year===targetRound.year);
    const seasonUpTo = upTo.filter(r=>r.year===targetRound.year);

    const sB = totals(seasonBefore), sU = totals(seasonUpTo);
    const cB = totals(before), cU = totals(upTo);
    Object.values(legacy||{}).forEach(yd=>{
      Object.entries(yd.gols||{}).forEach(([n,v])=>{ cB.g[n]=(cB.g[n]||0)+v; cU.g[n]=(cU.g[n]||0)+v; });
      Object.entries(yd.assists||{}).forEach(([n,v])=>{ cB.a[n]=(cB.a[n]||0)+v; cU.a[n]=(cU.a[n]||0)+v; });
    });

    const out = [];
    function checkMarcos(b, u, name, label, escopo, icon){
      MARCOS.forEach(m=>{
        if (b < m && u >= m) out.push({icon, text: `${name} chegou aos ${m} ${label} ${escopo}!`, cat:'marco'});
      });
    }

    Object.keys(targetRound.estatisticas||{}).forEach(name=>{
      checkMarcos(sB.g[name]||0, sU.g[name]||0, name, 'gols', 'na temporada', '🎯');
      checkMarcos(sB.a[name]||0, sU.a[name]||0, name, 'assistências', 'na temporada', '🎯');
      checkMarcos(cB.g[name]||0, cU.g[name]||0, name, 'gols', 'na carreira', '🏅');
      checkMarcos(cB.a[name]||0, cU.a[name]||0, name, 'assistências', 'na carreira', '🏅');
    });

    (targetRound.presentes||[]).forEach(name=>{
      [10,25,50,75,100,150,200].forEach(m=>{
        if ((sB.j[name]||0) < m && (sU.j[name]||0) >= m) out.push({icon:'📅', text:`${name} completou ${m} presenças na temporada!`, cat:'presenca'});
      });
    });

    let best = null;
    Object.entries(targetRound.estatisticas||{}).forEach(([n,st])=>{
      const t = (st.gols||0)+(st.assists||0);
      if (t>0 && (!best || t>best.total)) best = {n, total:t, g:st.gols||0, a:st.assists||0};
    });
    if (best && best.total>=4) out.push({icon:'🔥', text:`${best.n} foi o destaque da rodada: ${best.g} gols e ${best.a} assistências.`, cat:'destaque'});

    Object.entries(targetRound.estatisticas||{}).forEach(([n,st])=>{
      if ((st.gols||0)>0 && (sB.g[n]||0)===0) out.push({icon:'✨', text:`Primeiro gol de ${n} na temporada!`, cat:'primeiro'});
    });

    Object.keys(targetRound.estatisticas||{}).forEach(name=>{
      if ((targetRound.estatisticas[name].gols||0) <= 0) return;
      let streak = 1;
      for (let i=seasonUpTo.length-2; i>=0; i--){
        const st = (seasonUpTo[i].estatisticas||{})[name];
        if (st && (st.gols||0)>0) streak++; else break;
      }
      if (streak>=3) out.push({icon:'📈', text:`${name} balançou as redes em ${streak} rodadas seguidas!`, cat:'sequencia'});
    });

    // estreante: primeira vez que esse nome aparece em qualquer rodada da história
    (targetRound.presentes||[]).forEach(name=>{
      const jaJogou = before.some(r => (r.presentes||[]).includes(name));
      if (!jaJogou) out.push({icon:'🆕', text:`Bem-vindo(a), ${name}! Estreia com a camisa do ABFC.`, cat:'estreante'});
    });

    // presença fiel sem gol na temporada (destaque pra quem não é artilheiro)
    (targetRound.presentes||[]).forEach(name=>{
      const totalGA = (sU.g[name]||0) + (sU.a[name]||0);
      const presencas = sU.j[name] || 0;
      if (totalGA === 0 && presencas >= 5){
        out.push({icon:'🛡️', text:`${name} já soma ${presencas} presenças na temporada sem balançar as redes, mas segue sendo presença certa em campo.`, cat:'fiel'});
      }
    });

    // voltou a participar de gol depois de um jejum
    Object.entries(targetRound.estatisticas||{}).forEach(([name,st])=>{
      if ((st.gols||0)===0 && (st.assists||0)===0) return;
      let jejum = 0;
      for (let i=seasonBefore.length-1; i>=0; i--){
        const r = seasonBefore[i];
        if (!(r.presentes||[]).includes(name)) continue;
        const stAnterior = (r.estatisticas||{})[name];
        if (stAnterior && ((stAnterior.gols||0)>0 || (stAnterior.assists||0)>0)) break;
        jejum++;
      }
      if (jejum >= 3) out.push({icon:'⏳', text:`${name} voltou a participar de gol depois de ${jejum} rodadas em jejum.`, cat:'jejum'});
    });

    const seen = new Set();
    const unicos = out.filter(c=>{ if (seen.has(c.text)) return false; seen.add(c.text); return true; });

    // diversifica: no máximo 2 por categoria, alternando entre categorias diferentes
    const porCategoria = {};
    unicos.forEach(c => { (porCategoria[c.cat] = porCategoria[c.cat] || []).push(c); });
    const categorias = Object.keys(porCategoria);
    const final = [];
    let i = 0;
    while (final.length < 8 && categorias.some(cat => porCategoria[cat].length > 0)){
      const cat = categorias[i % categorias.length];
      if (porCategoria[cat].length > 0) final.push(porCategoria[cat].shift());
      i++;
    }
    return final;
  }

  async function loadPlayersAndRatings(basePath){
    basePath = basePath || '';
    const players = await fetchJSON(basePath + 'data/players.json', []);
    const ratings = await fetchJSON(basePath + 'data/ratings.json', {});
    return players.map(p => ({
      nome: p.nome,
      posicao: (ratings[p.nome] && ratings[p.nome].posicao) || p.posicao,
      overall: ratings[p.nome] ? ratings[p.nome].overall : null,
      skills: ratings[p.nome] ? ratings[p.nome].skills : null,
    }));
  }

  const CATEGORIAS_RADAR = {
    FOR: ["Força do chute", "Força física"],
    VEL: ["Velocidade (aceleração)", "Velocidade (ritmo)"],
    PAS: ["Passe pelo alto", "Passe rasteiro"],
    FIN: ["Finalização", "Talento Ofensivo"],
    DEF: ["Desarme", "Disputa de bola", "Talento Defensivo"],
    TEC: ["Controle de Bola", "Técnica"],
  };

  function mediaCategoria(skills, campos){
    if (!skills) return 0;
    const vals = campos.map(c => skills[c]).filter(v => typeof v === 'number');
    if (!vals.length) return 0;
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  }

  function radarSVG(skills, opts){
    opts = opts || {};
    const size = opts.size || 140, cx = size/2, cy = size/2, R = (opts.size||140) * 0.38;
    const color = opts.color || '#FF6A00';
    const eixos = Object.keys(CATEGORIAS_RADAR);
    const valores = eixos.map(eixo => mediaCategoria(skills, CATEGORIAS_RADAR[eixo]));
    const n = eixos.length;
    function pt(i, val){
      const ang = -Math.PI/2 + i * (2*Math.PI/n);
      const r = (val/10) * R;
      return [cx + r*Math.cos(ang), cy + r*Math.sin(ang)];
    }
    const poly = valores.map((v,i)=> pt(i,v).join(',')).join(' ');
    const grid = [0.25,0.5,0.75,1].map(f=>{
      const p = eixos.map((_,i)=> pt(i, f*10).join(',')).join(' ');
      return `<polygon points="${p}" fill="none" stroke="#2A2A2E" stroke-width="1"/>`;
    }).join('');
    const labels = eixos.map((eixo,i)=>{
      const [x,y] = pt(i, 12.5);
      return `<text x="${x}" y="${y}" fill="#8C8C92" font-size="${size*0.064}" font-family="Oswald" text-anchor="middle" dominant-baseline="middle">${eixo}</text>`;
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${grid}${labels}
      <polygon points="${poly}" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="2"/>
    </svg>`;
  }

  return {MONTHS, SEASONS, CATEGORIAS_ARQUIVO, MARCOS, CATEGORIAS_RADAR, fetchJSON, loadAllData, loadPlayersAndRatings, calcular, topN, mergeCounters, totals, curiosidadesDaRodada, mediaCategoria, radarSVG};
})();
