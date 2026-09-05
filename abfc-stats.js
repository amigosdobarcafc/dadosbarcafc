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
      const r = await fetch(path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now());
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
    const years = manifest.years && manifest.years.length ? manifest.years : [new Date().getFullYear()];
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

  return {MONTHS, SEASONS, CATEGORIAS_ARQUIVO, MARCOS, fetchJSON, loadAllData, calcular, topN, mergeCounters, totals, curiosidadesDaRodada};
})();
