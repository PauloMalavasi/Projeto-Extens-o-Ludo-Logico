const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

const setupPanel = $('#setupPanel');
const gamePanel = $('#gamePanel');
const sessionPanel = $('#sessionPanel');
const codeBox = $('#codeBox');
const phaseContent = $('#phaseContent');
const nextBtn = $('#nextBtn');
const backBtn = $('#backBtn');
const timerEl = $('#timer');

let deck = [];
let current = null;
let phase = 'reveal';
let prediction = '';
let confidence = 1;
let revised = false;
let revisionPenaltyApplied = false;
let execIndex = 0;
let timerId = null;
let timerRemaining = 60;
let score = 0;
let history = [];
let player = 'Jogador 1';

const ROUND_LIMIT = 10;

function normalizeAnswer(v){
  return String(v).trim().toLowerCase().replace(/\s+/g,' ');
}
function shuffle(arr){
  return arr.map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(x=>x.v);
}
function selectedCards(){
  const cat = $('#categorySelect').value;
  const dif = $('#difficultySelect').value;
  const custom = JSON.parse(localStorage.getItem('rastreio-custom-cards') || '[]');

  return [...window.RASTREIO_CARDS, ...custom].filter(c =>
    (cat === 'all' || c.category === cat) &&
    (dif === 'all' || String(c.difficulty) === dif)
  );
}
function startGame(){
  const available = selectedCards();

  if (!available.length){
    alert('Nenhuma carta foi encontrada para os filtros escolhidos.');
    return;
  }

  player = $('#playerName').value.trim() || 'Jogador 1';
  deck = shuffle(available).slice(0, ROUND_LIMIT);
  score = 0;
  history = [];

  $('#playerLabel').textContent = player;
  setupPanel.hidden = true;
  sessionPanel.hidden = true;
  gamePanel.hidden = false;

  nextCard();
  updateSidebar();
}
function nextCard(){
  if(history.length >= ROUND_LIMIT || !deck.length){
    endSession();
    return;
  }

  current = deck.shift();
  prediction = '';
  confidence = 1;
  revised = false;
  revisionPenaltyApplied = false;
  execIndex = 0;

  $('#categoryBadge').textContent = current.category;
  $('#difficultyBadge').textContent = `Nível ${current.difficulty}`;
  codeBox.textContent = current.code;
  setPhase('reveal');
}
function setPhase(p){
  clearInterval(timerId);
  timerId = null;
  phase = p;

  $$('.phase-track span').forEach(el =>
    el.classList.toggle('active', el.dataset.phase === p)
  );

  backBtn.hidden = !['predict','review'].includes(p);

  if(p === 'reveal') renderReveal();
  if(p === 'predict') renderPredict();
  if(p === 'debate') renderDebate();
  if(p === 'review') renderReview();
  if(p === 'execute') renderExecute();
  if(p === 'score') renderScore();
}
function startTimer(seconds){
  timerRemaining = seconds;
  renderTimer();

  timerId = setInterval(()=>{
    timerRemaining--;
    renderTimer();

    if(timerRemaining <= 0){
      clearInterval(timerId);
      timerId = null;
    }
  },1000);
}
function renderTimer(){
  const m = String(Math.floor(timerRemaining / 60)).padStart(2,'0');
  const s = String(timerRemaining % 60).padStart(2,'0');
  timerEl.textContent = `${m}:${s}`;
}
function renderReveal(){
  startTimer(60);

  phaseContent.innerHTML = `<h2>Revelação</h2><p>Leia o trecho em silêncio. Tente rastrear mentalmente o valor das variáveis e a saída.</p><div class="notice">A proposta do jogo é prever antes de executar — não vale testar o trecho em outro lugar. <strong>Atenção:</strong> algumas cartas têm pequenas pegadinhas ou erros.</div>`;
  nextBtn.textContent = 'Ir para previsão';
  nextBtn.onclick = () => setPhase('predict');
}
function confidenceHtml(){
  return `<div class="confidence">${[1,2,3].map(n=>`<button type="button" class="conf-btn ${confidence===n?'selected':''}" data-conf="${n}">${'●'.repeat(n)} ${n} ficha${n>1?'s':''}</button>`).join('')}</div>`;
}
function bindConfidence(){
  $$('.conf-btn').forEach(btn => {
    btn.onclick = () => {
      confidence = Number(btn.dataset.conf);
      $$('.conf-btn').forEach(b =>
        b.classList.toggle('selected', Number(b.dataset.conf) === confidence)
      );
    };
  });
}
function renderPredict(){
  timerEl.textContent = '—';
  phaseContent.innerHTML = `<h2>Previsão</h2><p>Escreva exatamente a saída que você espera e aposte de 1 a 3 fichas de confiança.</p><div class="notice"><strong>Regra de erro:</strong> se houver um erro que impeça a compilação/execução, digite exatamente <code>error</code>. Se for apenas um erro de lógica, responda a saída que o código realmente produz.</div><label style="margin-top:14px">Sua previsão<input id="predictionInput" autocomplete="off" placeholder="Ex.: 6, A B C ou error" value="${escapeHtml(prediction)}"></label><label style="margin-top:14px">Confiança${confidenceHtml()}</label>`;
  bindConfidence();

  nextBtn.textContent = 'Confirmar previsão';
  nextBtn.onclick = () => {
    const val = $('#predictionInput').value.trim();
    if(!val){
      $('#predictionInput').focus();
      return;
    }
    prediction = val;
    setPhase('debate');
  };
  backBtn.onclick = () => setPhase('reveal');
}
function renderDebate(){
  startTimer(120);
  phaseContent.innerHTML = `<h2>Debate</h2><p>Discuta o raciocínio por até dois minutos. Um colega pode apresentar um contra-argumento; depois disso, você terá a chance de revisar.</p><div class="notice"><strong>Sua resposta:</strong> ${escapeHtml(prediction)} &nbsp;•&nbsp; <strong>Confiança:</strong> ${confidence}/3</div>`;
  nextBtn.textContent = 'Ir para revisão';
  nextBtn.onclick = () => setPhase('review');
}
function renderReview(){
  timerEl.textContent = '—';
  phaseContent.innerHTML = `<h2>Revisão</h2><p>Você pode manter sua previsão ou mudá-la. Se mudar, perde 1 ficha; se a revisão estiver correta, ganha bônus de revisão bem fundamentada.</p><div class="notice">Se o trecho tiver erro que impeça a execução, use <code>error</code>. Pegadinha lógica não é <code>error</code>: nesse caso, informe a saída real.</div><label>Resposta revisada<input id="reviewInput" value="${escapeHtml(prediction)}"></label><label style="margin-top:14px">Confiança atual${confidenceHtml()}</label>`;
  bindConfidence();

  nextBtn.textContent = 'Executar passo a passo';
  nextBtn.onclick = () => {
    const newVal = $('#reviewInput').value.trim();
    if(!newVal){
      $('#reviewInput').focus();
      return;
    }

    revised = normalizeAnswer(newVal) !== normalizeAnswer(prediction);
    prediction = newVal;

    if(revised && !revisionPenaltyApplied){
      score -= 1;
      revisionPenaltyApplied = true;
    }

    updateSidebar();
    setPhase('execute');
  };

  backBtn.onclick = () => setPhase('predict');
}
function renderExecute(){
  timerEl.textContent = '—';
  backBtn.hidden = true;

  const lines = current.code.split('\n');
  const step = current.steps[Math.min(execIndex,current.steps.length-1)] || {line:1,vars:{},output:''};

  const lineHtml = lines.map((l,i)=>`<div class="exec-line ${i+1===step.line?'current':''}">${String(i+1).padStart(2,'0')} &nbsp;${escapeHtml(l)}</div>`).join('');

  phaseContent.innerHTML = `<h2>Execução visual</h2><p>Avance linha a linha e observe o estado das variáveis e a saída acumulada.</p><div class="executor"><div class="exec-lines">${lineHtml}</div><div class="state-card"><h4>Estado das variáveis</h4><pre>${escapeHtml(JSON.stringify(step.vars,null,2))}</pre><h4>Saída acumulada</h4><pre>${escapeHtml(step.output || '—')}</pre></div></div>`;

  if(execIndex < current.steps.length-1){
    nextBtn.textContent = 'Próximo passo';
    nextBtn.onclick = () => {
      execIndex++;
      renderExecute();
    };
  } else {
    nextBtn.textContent = 'Ver resultado';
    nextBtn.onclick = () => setPhase('score');
  }
}
function renderScore(){
  timerEl.textContent = '—';
  backBtn.hidden = true;

  const correct = normalizeAnswer(prediction) === normalizeAnswer(current.expected);
  const delta = correct ? confidence + (revised ? 1 : 0) : -1;
  score += delta;

  const item = {
    category:current.category,
    difficulty:current.difficulty,
    prediction,
    expected:current.expected,
    confidence,
    correct,
    revised,
    delta
  };

  history.push(item);
  updateSidebar();

  phaseContent.innerHTML = `<h2>Pontuação</h2><div class="result ${correct?'ok':'bad'}">${correct?'✓ Acertou':'✕ Errou'} — ${delta>=0?'+':''}${delta} ponto${Math.abs(delta)===1?'':'s'}${revised&&correct?' (inclui bônus de revisão)':''}</div><p><strong>Saída correta:</strong> ${escapeHtml(current.expected)}</p><p>${escapeHtml(current.explanation)}</p><h3>Verso / pseudocódigo</h3><div class="pseudo">${escapeHtml(current.pseudo)}</div>`;

  nextBtn.textContent = (history.length >= ROUND_LIMIT || !deck.length) ? 'Encerrar rodada' : 'Próxima carta';
  nextBtn.onclick = () => nextCard();
}
function updateSidebar(){
  $('#scoreLabel').textContent = score;
  $('#roundLabel').textContent = `${history.length}/${ROUND_LIMIT}`;

  const hits = history.filter(h=>h.correct).length;
  $('#accuracyLabel').textContent = history.length ? `${Math.round(hits/history.length*100)}%` : '0%';

  const cal = [1,2,3].map(c=>{
    const hs = history.filter(h=>h.confidence===c);
    const ok = hs.filter(h=>h.correct).length;
    return {c,n:hs.length,p:hs.length?Math.round(ok/hs.length*100):0};
  });

  $('#calibration').innerHTML = cal.map(x=>`<div class="cal-row"><span>${x.c}/3</span><div class="bar"><i style="width:${x.p}%"></i></div><strong>${x.n?x.p+'%':'—'}</strong></div>`).join('');
}
function endSession(){
  clearInterval(timerId);
  timerId = null;

  gamePanel.hidden = true;
  sessionPanel.hidden = false;

  const rows = history.map((h,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(h.category)}</td><td>N${h.difficulty}</td><td>${escapeHtml(h.prediction)}</td><td>${escapeHtml(h.expected)}</td><td>${h.confidence}/3</td><td>${h.revised?'Sim':'Não'}</td><td>${h.correct?'✓':'✕'}</td><td>${h.delta>=0?'+':''}${h.delta}</td></tr>`).join('');

  $('#historyTableWrap').innerHTML = `<p><strong>Pontuação final: ${score}</strong> • ${history.filter(h=>h.correct).length}/${history.length} acertos • rodada encerrada com ${history.length} carta${history.length===1?'':'s'}</p><div style="overflow:auto"><table><thead><tr><th>#</th><th>Categoria</th><th>Nível</th><th>Previsão</th><th>Correta</th><th>Conf.</th><th>Revisou</th><th>Resultado</th><th>Pontos</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// Reinício completo da sessão.
function resetAll(){
  clearInterval(timerId);
  timerId = null;

  deck = [];
  current = null;
  phase = 'reveal';
  prediction = '';
  confidence = 1;
  revised = false;
  revisionPenaltyApplied = false;
  execIndex = 0;
  timerRemaining = 60;
  score = 0;
  history = [];
  player = 'Jogador 1';

  codeBox.textContent = '';
  phaseContent.innerHTML = '';
  $('#historyTableWrap').innerHTML = '';

  $('#playerLabel').textContent = '—';
  $('#scoreLabel').textContent = '0';
  $('#roundLabel').textContent = `0/${ROUND_LIMIT}`;
  $('#accuracyLabel').textContent = '0%';
  $('#categoryBadge').textContent = 'Categoria';
  $('#difficultyBadge').textContent = 'Nível';

  $('#playerName').value = 'Jogador 1';
  $('#categorySelect').value = 'all';
  $('#difficultySelect').value = 'all';

  timerEl.textContent = '01:00';
  backBtn.hidden = true;
  nextBtn.textContent = 'Ir para previsão';
  nextBtn.onclick = null;
  backBtn.onclick = null;

  $$('.phase-track span').forEach(el =>
    el.classList.toggle('active', el.dataset.phase === 'reveal')
  );

  const dialog = $('#editorDialog');
  if (dialog.open){
    dialog.close();
  }

  $('#editorForm').reset();

  gamePanel.hidden = true;
  sessionPanel.hidden = true;
  setupPanel.hidden = false;

  updateSidebar();
  window.scrollTo({top:0, behavior:'smooth'});
  $('#playerName').focus();
}
function escapeHtml(s){
  return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

$('#startBtn').onclick = startGame;
$('#resetBtn').onclick = resetAll;
$('#playAgainBtn').onclick = resetAll;

// Editor local
const dialog = $('#editorDialog');
$('#editorOpenBtn').onclick = () => dialog.showModal();

$('#saveCardBtn').onclick = e => {
  e.preventDefault();

  const code = $('#editorCode').value.trim();
  const expected = $('#editorOutput').value.trim();
  const pseudo = $('#editorPseudo').value.trim();
  const explanation = $('#editorExplanation').value.trim();

  if(!code || !expected || !pseudo || !explanation) return;

  const custom = JSON.parse(localStorage.getItem('rastreio-custom-cards') || '[]');

  custom.push({
    id:'custom-'+Date.now(),
    category:$('#editorCategory').value,
    difficulty:Number($('#editorDifficulty').value),
    code,
    pseudo,
    expected,
    explanation,
    steps:[
      {line:1,vars:{observacao:'Carta criada pelo professor'},output:''},
      {line:code.split('\n').length,vars:{},output:expected}
    ]
  });

  localStorage.setItem('rastreio-custom-cards', JSON.stringify(custom));
  $('#editorForm').reset();
  dialog.close();
};

// Continua funcionando offline, mas sem manifest e sem fluxo de instalação.
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

updateSidebar();
