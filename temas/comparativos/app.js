/* ============================================================
   Lógica del juego: Comparativos y Superlativos
   ============================================================ */

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const norm = (s) => s.toLowerCase().trim().replace(/\s+/g, " ").replace(/[.!?]$/, "");
const stripThe = (s) => s.replace(/^the\s+/, "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const findWord = (w) => WORDS.find((e) => e.word === w);

// ---------- Progreso (localStorage) ----------
const STORE_KEY = "comparativos-progress-v1";
let progress = loadProgress();
let session = { ok: 0, total: 0 };

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* sin almacenamiento */ }
  return { words: {}, rules: {}, quiz: { ok: 0, bad: 0 }, total: { ok: 0, bad: 0 } };
}
function saveProgress() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* ignorar */ }
}
function record(entry, correct) {
  const w = (progress.words[entry.word] ||= { ok: 0, bad: 0 });
  const r = (progress.rules[entry.rule] ||= { ok: 0, bad: 0 });
  w[correct ? "ok" : "bad"]++;
  r[correct ? "ok" : "bad"]++;
  progress.total[correct ? "ok" : "bad"]++;
  session.total++;
  if (correct) session.ok++;
  saveProgress();
  updateScore();
}
function recordQuiz(correct) {
  progress.quiz[correct ? "ok" : "bad"]++;
  progress.total[correct ? "ok" : "bad"]++;
  session.total++;
  if (correct) session.ok++;
  saveProgress();
  updateScore();
}
function updateScore() {
  $("scoreOk").textContent = session.ok;
  $("scoreTotal").textContent = session.total;
}
function wordStats(word) {
  return progress.words[word] || { ok: 0, bad: 0 };
}
function isMastered(word) {
  const s = wordStats(word);
  return s.ok >= 3 && s.ok > s.bad * 2;
}

// Elige una palabra al azar, dando más peso a las que fallas o no has visto
let lastWord = null;
function pickWord(filterFn = () => true) {
  const pool = WORDS.filter(filterFn).filter((e) => e.word !== lastWord);
  const list = pool.length ? pool : WORDS.filter(filterFn);
  if (!list.length) return null;
  const weights = list.map((e) => {
    const s = wordStats(e.word);
    let w = 1 + s.bad * 2;
    if (s.ok === 0 && s.bad === 0) w += 1.5;       // nunca vista
    if (isMastered(e.word)) w = 0.35;              // dominada: aparece poco
    if (e.freq === 1) w *= 1.3;                    // las más usadas salen un poco más
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) { lastWord = list[i].word; return list[i]; }
  }
  lastWord = list[list.length - 1].word;
  return lastWord && list[list.length - 1];
}

// Comprueba una respuesta. kind = "comp" | "sup"
function checkAnswer(entry, kind, input, requireThe = false) {
  const given = norm(input);
  const accepted = [entry[kind], ...((entry.alt && entry.alt[kind]) || [])].map(norm);
  const givenNoThe = stripThe(given);
  const hasThe = given !== givenNoThe;
  const matches = accepted.includes(givenNoThe);
  if (!matches) return { correct: false };
  if (kind === "sup" && requireThe && !hasThe) return { correct: false, missingThe: true };
  if (kind === "comp" && hasThe) return { correct: false, extraThe: true };
  return { correct: true };
}

function ruleExplanation(entry) {
  const r = RULES[entry.rule];
  let html = `<span class="rule-tag">Regla: ${esc(r.name)}</span><br>${esc(r.desc)}<br>`;
  html += `<span class="ex">${esc(entry.word)} → ${esc(entry.comp)} → the ${esc(entry.sup)}</span>`;
  if (entry.note) html += `<br><span class="ex">Nota: ${esc(entry.note)}</span>`;
  return html;
}

// ---------- Pestañas ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
});
function showTab(name) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + name));
  if (name === "vocab") renderVocab();
  if (name === "form" && !formState.entry) newFormQuestion();
  if (name === "rule" && !ruleState.entry) newRuleQuestion();
  if (name === "sentence") { if (!fillState.entry) newFill(); if (!orderState.sentence) newOrder(); }
  if (name === "quiz" && quizState.index < 0) newQuizRound();
  if (name === "progress") renderProgress();
}

// ============================================================
//  VOCABULARIO
// ============================================================
function fillSelects() {
  const ruleOpts = Object.entries(RULES).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join("");
  $("filterRule").insertAdjacentHTML("beforeend", ruleOpts);
  $("formRule").insertAdjacentHTML("beforeend", ruleOpts);
  const catOpts = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("filterCat").insertAdjacentHTML("beforeend", catOpts);
  $("rulesGrid").innerHTML = Object.values(RULES).map((r) =>
    `<div class="rule-card"><h4>${esc(r.name)}</h4><p>${esc(r.desc)}</p><p class="ex">${esc(r.example)}</p></div>`
  ).join("");
}

function levelHtml(word) {
  const s = wordStats(word);
  const stars = Math.min(3, s.ok);
  let html = `<span class="level">`;
  for (let i = 0; i < 3; i++) html += `<span class="${i < stars ? "on" : "off"}">●</span>`;
  if (s.bad) html += `<span class="bad">✕${s.bad}</span>`;
  html += `</span>`;
  return html;
}

function renderVocab() {
  const q = norm($("search").value);
  const rule = $("filterRule").value;
  const freq = $("filterFreq").value;
  const cat = $("filterCat").value;
  const sort = $("sortBy").value;
  const hide = $("hideForms").checked;

  let list = WORDS.filter((e) =>
    (!q || e.word.includes(q) || e.es.toLowerCase().includes(q) || e.comp.includes(q) || e.sup.includes(q)) &&
    (!rule || e.rule === rule) &&
    (!freq || String(e.freq) === freq) &&
    (!cat || e.cat === cat)
  );
  const ruleOrder = Object.keys(RULES);
  if (sort === "az") list.sort((a, b) => a.word.localeCompare(b.word));
  else if (sort === "rule") list.sort((a, b) => ruleOrder.indexOf(a.rule) - ruleOrder.indexOf(b.rule) || a.word.localeCompare(b.word));
  else if (sort === "errors") list.sort((a, b) => wordStats(b.word).bad - wordStats(a.word).bad || a.word.localeCompare(b.word));
  else list.sort((a, b) => a.freq - b.freq || a.word.localeCompare(b.word));

  $("vocabCount").textContent = `${list.length} de ${WORDS.length} palabras`;
  $("vocabBody").innerHTML = list.map((e) => `
    <tr>
      <td class="w">${esc(e.word)}</td>
      <td>${esc(e.es)}</td>
      <td class="form ${hide ? "blur" : ""}" title="${hide ? "Pasa el ratón para ver" : ""}">${esc(e.comp)}</td>
      <td class="form ${hide ? "blur" : ""}" title="${hide ? "Pasa el ratón para ver" : ""}">the ${esc(e.sup)}</td>
      <td><span class="badge">${esc(RULES[e.rule].short)}</span></td>
      <td><span class="badge f${e.freq}">${esc(FREQ[e.freq])}</span> <span class="badge">${esc(CATEGORIES[e.cat] || e.cat)}</span></td>
      <td>${levelHtml(e.word)}</td>
    </tr>`).join("");
}
["search", "filterRule", "filterFreq", "filterCat", "sortBy", "hideForms"].forEach((id) =>
  $(id).addEventListener("input", renderVocab)
);

// ============================================================
//  MODO FORMAR (-er / -est / more / most)
// ============================================================
const formState = { entry: null, kind: "comp", answered: false };

function formFilter() {
  const rule = $("formRule").value;
  const freq = $("formFreq").value;
  return (e) => (!rule || e.rule === rule) && (!freq || freq.includes(String(e.freq)));
}
function newFormQuestion() {
  const what = $("formWhat").value;
  formState.kind = what === "both" ? rand(["comp", "sup"]) : what;
  formState.entry = pickWord(formFilter());
  formState.answered = false;
  const e = formState.entry;
  if (!e) { $("formWord").textContent = "—"; $("formHint").textContent = "No hay palabras con ese filtro."; return; }
  $("formAsk").textContent = formState.kind === "comp" ? "Escribe el COMPARATIVO de:" : "Escribe el SUPERLATIVO de (con the):";
  $("formWord").textContent = e.word;
  $("formHint").textContent = e.es;
  $("formInput").value = "";
  $("formInput").disabled = false;
  $("formFeedback").className = "feedback";
  $("formFeedback").innerHTML = "";
  $("formNext").classList.add("hidden");
  $("formCheck").classList.remove("hidden");
  $("formInput").focus();
}
$("formForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (formState.answered) { newFormQuestion(); return; }
  const e = formState.entry;
  if (!e) return;
  const input = $("formInput").value;
  if (!norm(input)) return;
  const res = checkAnswer(e, formState.kind, input, true);
  const fb = $("formFeedback");
  const correctForm = formState.kind === "comp" ? e.comp : "the " + e.sup;
  if (res.missingThe) {
    fb.className = "feedback warn";
    fb.innerHTML = `<strong>Casi. Falta el artículo <em>the</em>.</strong>El superlativo siempre lleva <em>the</em>: <em>${esc(correctForm)}</em>. Inténtalo otra vez.`;
    return;
  }
  if (res.extraThe) {
    fb.className = "feedback warn";
    fb.innerHTML = `<strong>Casi. El comparativo no lleva <em>the</em>.</strong>Solo el superlativo lo usa. Inténtalo otra vez.`;
    return;
  }
  formState.answered = true;
  $("formInput").disabled = true;
  record(e, res.correct);
  if (res.correct) {
    fb.className = "feedback ok";
    fb.innerHTML = `<strong>✔ Correcto: ${esc(correctForm)}</strong>${ruleExplanation(e)}`;
  } else {
    fb.className = "feedback bad";
    fb.innerHTML = `<strong>✘ Incorrecto. La respuesta es: ${esc(correctForm)}</strong>${ruleExplanation(e)}`;
  }
  $("formNext").classList.remove("hidden");
  $("formCheck").classList.add("hidden");
  $("formNext").focus();
});
$("formNext").addEventListener("click", newFormQuestion);
$("formSkip").addEventListener("click", newFormQuestion);
["formWhat", "formRule", "formFreq"].forEach((id) => $(id).addEventListener("change", newFormQuestion));

// ============================================================
//  MODO REGLAS (elige la regla correcta)
// ============================================================
const ruleState = { entry: null };

function newRuleQuestion() {
  ruleState.entry = pickWord();
  const e = ruleState.entry;
  $("ruleWord").textContent = e.word;
  $("ruleHint").textContent = e.es;
  $("ruleFeedback").className = "feedback";
  $("ruleFeedback").innerHTML = "";
  $("ruleNext").classList.add("hidden");
  $("ruleChoices").innerHTML = Object.entries(RULES).map(([k, r]) =>
    `<button class="choice" data-rule="${k}">${esc(r.name)}<small>${esc(r.example)}</small></button>`
  ).join("");
  $("ruleChoices").querySelectorAll(".choice").forEach((btn) => btn.addEventListener("click", () => answerRule(btn)));
}
function answerRule(btn) {
  const e = ruleState.entry;
  const chosen = btn.dataset.rule;
  const correct = chosen === e.rule;
  $("ruleChoices").querySelectorAll(".choice").forEach((b) => {
    b.disabled = true;
    if (b.dataset.rule === e.rule) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });
  record(e, correct);
  const fb = $("ruleFeedback");
  fb.className = "feedback " + (correct ? "ok" : "bad");
  fb.innerHTML = `<strong>${correct ? "✔ Correcto" : "✘ Incorrecto"}</strong>${ruleExplanation(e)}`;
  $("ruleNext").classList.remove("hidden");
  $("ruleNext").focus();
}
$("ruleNext").addEventListener("click", newRuleQuestion);

// ============================================================
//  MODO FRASES: Completa
// ============================================================
const fillState = { entry: null, template: null, answered: false };

document.querySelectorAll(".subtab").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".subtab").forEach((x) => x.classList.toggle("active", x === b));
  $("fillCard").classList.toggle("hidden", b.dataset.sub !== "fill");
  $("orderCard").classList.toggle("hidden", b.dataset.sub !== "order");
}));

function newFill() {
  const t = rand(SENTENCE_TEMPLATES);
  const candidates = t.words.map(findWord).filter(Boolean);
  const e = rand(candidates);
  fillState.template = t;
  fillState.entry = e;
  fillState.answered = false;
  const gap = `<span class="gap">______</span>`;
  $("fillSentence").innerHTML = esc(t.text).replace("{X}", gap);
  $("fillLabel").textContent = t.type === "comp" ? "Completa con el COMPARATIVO:" : "Completa con el SUPERLATIVO (con the):";
  $("fillHint").textContent = `(${e.word}) — ${e.es}`;
  $("fillInput").value = "";
  $("fillInput").disabled = false;
  $("fillFeedback").className = "feedback";
  $("fillFeedback").innerHTML = "";
  $("fillNext").classList.add("hidden");
  $("fillInput").focus();
}
$("fillForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (fillState.answered) { newFill(); return; }
  const e = fillState.entry, t = fillState.template;
  const input = $("fillInput").value;
  if (!norm(input)) return;
  const res = checkAnswer(e, t.type, input, true);
  const fb = $("fillFeedback");
  const correctForm = t.type === "comp" ? e.comp : "the " + e.sup;
  if (res.missingThe) {
    fb.className = "feedback warn";
    fb.innerHTML = `<strong>Casi. Falta <em>the</em>.</strong>El superlativo siempre lleva <em>the</em>. Inténtalo otra vez.`;
    return;
  }
  if (res.extraThe) {
    fb.className = "feedback warn";
    fb.innerHTML = `<strong>Casi. El comparativo no lleva <em>the</em>.</strong>Inténtalo otra vez.`;
    return;
  }
  fillState.answered = true;
  $("fillInput").disabled = true;
  record(e, res.correct);
  const full = t.text.replace("{X}", correctForm);
  $("fillSentence").innerHTML = esc(t.text).replace("{X}", `<span class="gap">${esc(correctForm)}</span>`);
  fb.className = "feedback " + (res.correct ? "ok" : "bad");
  fb.innerHTML = `<strong>${res.correct ? "✔ Correcto" : "✘ Incorrecto"}: ${esc(full)}</strong>${ruleExplanation(e)}`;
  $("fillNext").classList.remove("hidden");
  $("fillNext").focus();
});
$("fillNext").addEventListener("click", newFill);
$("fillSkip").addEventListener("click", newFill);

// ============================================================
//  MODO FRASES: Ordena
// ============================================================
const orderState = { sentence: null, words: [], pool: [], answer: [] };

function newOrder() {
  const s = rand(ORDER_SENTENCES.filter((x) => x !== orderState.sentence));
  orderState.sentence = s;
  orderState.words = s.text.replace(/[.!?]$/, "").split(" ");
  orderState.pool = shuffle(orderState.words.map((w, i) => ({ w, i })));
  orderState.answer = [];
  $("orderHint").textContent = s.es;
  $("orderFeedback").className = "feedback";
  $("orderFeedback").innerHTML = "";
  $("orderNext").classList.add("hidden");
  $("orderCheck").disabled = false;
  renderOrder();
}
function renderOrder() {
  $("orderAnswer").innerHTML = orderState.answer.map((c, idx) =>
    `<button class="chip" data-idx="${idx}">${esc(c.w)}</button>`).join("");
  $("orderChips").innerHTML = orderState.pool.map((c, idx) =>
    `<button class="chip" data-idx="${idx}">${esc(c.w)}</button>`).join("");
  $("orderAnswer").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    if ($("orderCheck").disabled) return;
    const [c] = orderState.answer.splice(+b.dataset.idx, 1);
    orderState.pool.push(c);
    renderOrder();
  }));
  $("orderChips").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    if ($("orderCheck").disabled) return;
    const [c] = orderState.pool.splice(+b.dataset.idx, 1);
    orderState.answer.push(c);
    renderOrder();
  }));
}
$("orderCheck").addEventListener("click", () => {
  const given = orderState.answer.map((c) => c.w).join(" ");
  const expected = orderState.words.join(" ");
  const correct = given === expected;
  const fb = $("orderFeedback");
  fb.className = "feedback " + (correct ? "ok" : "bad");
  fb.innerHTML = `<strong>${correct ? "✔ Correcto" : "✘ Incorrecto"}</strong>${esc(orderState.sentence.text)}<br><span class="ex">${esc(orderState.sentence.es)}</span>`;
  recordQuiz(correct);
  $("orderCheck").disabled = true;
  $("orderNext").classList.remove("hidden");
  $("orderNext").focus();
});
$("orderReset").addEventListener("click", () => {
  if ($("orderCheck").disabled) return;
  orderState.pool = shuffle(orderState.pool.concat(orderState.answer));
  orderState.answer = [];
  renderOrder();
});
$("orderSkip").addEventListener("click", newOrder);
$("orderNext").addEventListener("click", newOrder);

// ============================================================
//  MODO PREGUNTAS
// ============================================================
const quizState = { order: [], index: -1, ok: 0 };

function newQuizRound() {
  quizState.order = shuffle(QUESTIONS);
  quizState.index = 0;
  quizState.ok = 0;
  showQuiz();
}
function showQuiz() {
  const q = quizState.order[quizState.index];
  $("quizCounter").textContent = `Pregunta ${quizState.index + 1} de ${quizState.order.length} · aciertos: ${quizState.ok}`;
  $("quizQ").textContent = q.q;
  $("quizFeedback").className = "feedback";
  $("quizFeedback").innerHTML = "";
  $("quizNext").classList.add("hidden");
  const opts = shuffle(q.options.map((o, i) => ({ o, i })));
  $("quizChoices").innerHTML = opts.map((x) => `<button class="choice" data-i="${x.i}">${esc(x.o)}</button>`).join("");
  $("quizChoices").querySelectorAll(".choice").forEach((btn) => btn.addEventListener("click", () => {
    const correct = +btn.dataset.i === q.a;
    $("quizChoices").querySelectorAll(".choice").forEach((b) => {
      b.disabled = true;
      if (+b.dataset.i === q.a) b.classList.add("correct");
      else if (b === btn) b.classList.add("wrong");
    });
    if (correct) quizState.ok++;
    recordQuiz(correct);
    const fb = $("quizFeedback");
    fb.className = "feedback " + (correct ? "ok" : "bad");
    fb.innerHTML = `<strong>${correct ? "✔ Correcto" : "✘ Incorrecto"}: ${esc(q.q.replace("___", q.options[q.a]))}</strong>${esc(q.why)}`;
    $("quizNext").textContent = quizState.index + 1 < quizState.order.length ? "Siguiente →" : "Ver resultado";
    $("quizNext").classList.remove("hidden");
    $("quizNext").focus();
  }));
}
$("quizNext").addEventListener("click", () => {
  quizState.index++;
  if (quizState.index < quizState.order.length) { showQuiz(); return; }
  const n = quizState.order.length;
  const pct = Math.round((quizState.ok / n) * 100);
  $("quizCounter").textContent = "Ronda terminada";
  $("quizQ").textContent = `Resultado: ${quizState.ok} de ${n} (${pct}%)`;
  $("quizChoices").innerHTML = "";
  $("quizFeedback").className = "feedback " + (pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad");
  $("quizFeedback").innerHTML = pct >= 80 ? "<strong>Excelente.</strong> Dominas el tema." : pct >= 50 ? "<strong>Bien.</strong> Repasa las reglas que fallaste en la guía rápida." : "<strong>Sigue practicando.</strong> Revisa la guía rápida y vuelve a intentarlo.";
  $("quizNext").textContent = "Otra ronda";
  $("quizNext").classList.remove("hidden");
  quizState.index = -1;
});

// ============================================================
//  PROGRESO
// ============================================================
function renderProgress() {
  const t = progress.total;
  const answered = t.ok + t.bad;
  const acc = answered ? Math.round((t.ok / answered) * 100) : 0;
  const practiced = Object.keys(progress.words).length;
  const mastered = WORDS.filter((e) => isMastered(e.word)).length;
  $("stats").innerHTML = `
    <div class="stat"><div class="n">${answered}</div><div class="l">respuestas en total</div></div>
    <div class="stat"><div class="n">${acc}%</div><div class="l">precisión</div></div>
    <div class="stat"><div class="n">${practiced} / ${WORDS.length}</div><div class="l">palabras practicadas</div></div>
    <div class="stat"><div class="n">${mastered}</div><div class="l">palabras dominadas (3 aciertos)</div></div>`;

  $("ruleStats").innerHTML = Object.entries(RULES).map(([k, r]) => {
    const s = progress.rules[k] || { ok: 0, bad: 0 };
    const n = s.ok + s.bad;
    const p = n ? Math.round((s.ok / n) * 100) : 0;
    return `<div class="rule-stat"><span>${esc(r.name)}</span><div class="bar"><div style="width:${p}%"></div></div><span>${n ? p + "%" : "—"}</span></div>`;
  }).join("");

  const worst = Object.entries(progress.words)
    .filter(([, s]) => s.bad > 0)
    .sort((a, b) => b[1].bad - a[1].bad || a[1].ok - b[1].ok)
    .slice(0, 10);
  $("worstList").innerHTML = worst.length
    ? worst.map(([w, s]) => {
        const e = findWord(w);
        return `<li><span><span class="w">${esc(w)}</span> → ${esc(e ? e.comp : "")} → the ${esc(e ? e.sup : "")}</span><span><span class="e">✕ ${s.bad}</span> · ✔ ${s.ok}</span></li>`;
      }).join("")
    : "<li>Todavía no has fallado ninguna palabra.</li>";
}
$("resetProgress").addEventListener("click", () => {
  if (!confirm("¿Borrar todo tu progreso guardado?")) return;
  progress = { words: {}, rules: {}, quiz: { ok: 0, bad: 0 }, total: { ok: 0, bad: 0 } };
  session = { ok: 0, total: 0 };
  saveProgress();
  updateScore();
  renderProgress();
});

// ---------- Inicio ----------
fillSelects();
renderVocab();
updateScore();
