(function(){
  // Prevent double-tap/gesture zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e){
    const now = Date.now();
    if (now - lastTouchEnd <= 350) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
})();

// ===== helpers =====
const $ = (sel) => document.querySelector(sel);
const logBox = $("#log");

function log(text, css = "") {
  const line = document.createElement("div");
  line.className = "line " + css;
  line.textContent = text;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

function showToast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 1200);
}

function floatText(targetEl, text, cssClass = "dmg") {
  const layer = $("#effectLayer");
  if (!layer || !targetEl) return;
  const tip = document.createElement("div");
  tip.className = "floating " + cssClass;
  tip.textContent = text;
  const base = layer.getBoundingClientRect();
  const box = targetEl.getBoundingClientRect();
  tip.style.left = (box.left + box.width / 2 - base.left) + "px";
  tip.style.top  = (box.top - base.top - 20) + "px";
  layer.appendChild(tip);
  setTimeout(() => tip.remove(), 950);
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ===== data =====

// プレイヤーの使えるスキル一覧
const PLAYER_SKILLS = [
  { key: "moonSlash",  name: "ムーンスラッシュ", mp: 10, desc: "鋭い一閃で大ダメージを与える（30）", effect: { dmg: 30 }, log: "月光の一閃！" },
  { key: "sleepSong",  name: "スリープソング", mp: 15, desc: "小ダメージ（14）＋35%で敵をうとうと（次ターン行動不可）", effect: { dmg: 14, sleep: 0.35 }, log: "♪ スリープソング！" },
  { key: "healLight",  name: "ヒールライト",   mp: 12, desc: "HPを40回復する", effect: { heal: 40 }, log: "やさしい光が包んだ。" },
  { key: "manaCharge", name: "マナチャージ",   mp: 0,  desc: "MPを25回復する（攻撃はしない）", effect: { mpGain: 25 }, log: "精神統一！ MPが満ちていく…" }
];

const DIFFS = {
  EASY:{label:"やさしい",pHP:120,pMP:70,items:5,eHpMul:0.85,eDmgMul:0.80,delay:900},
  NORMAL:{label:"ふつう",pHP:100,pMP:50,items:3,eHpMul:1.00,eDmgMul:1.00,delay:800},
  HARD:{label:"むずかしい",pHP:90,pMP:45,items:3,eHpMul:1.15,eDmgMul:1.15,delay:700},
  NIGHTMARE:{label:"ナイトメア",pHP:80,pMP:40,items:3,eHpMul:1.35,eDmgMul:1.30,delay:600}
};

const ENEMY_MASTERS = [
  {name:"ブルーライトの獣",baseHp:60,spriteClass:"enemy-blue",skills:[
    {name:"眠気はぎ取り",type:"nuke",power:20,chance:0.35,log:"鋭い光がまぶしい！"},
    {name:"チラつき",type:"crit",power:12,chance:0.20,critMul:1.8,log:"画面がチラついた！"},
    {name:"通常攻撃",type:"basic",power:15,chance:1.00,log:"睡眠妨害攻撃！"}
  ]},
  {name:"深夜の通知おばけ",baseHp:70,spriteClass:"enemy-ghost",skills:[
    {name:"ピコンピコン",type:"nuke",power:18,chance:0.30,log:"通知音が鳴り響く！"},
    {name:"未読の山",type:"debuff",chance:0.25,effect:"mpDrain",value:10,log:"未読の山で集中がそがれた…"},
    {name:"通常攻撃",type:"basic",power:14,chance:1.00,log:"睡眠妨害攻撃！"}
  ]},
  {name:"カフェインまじん",baseHp:80,spriteClass:"enemy-caffeine",skills:[
    {name:"濃ゆいエスプレッソ",type:"nuke",power:16,chance:0.30,log:"苦味が染みわたる…！"},
    {name:"覚醒テンション",type:"buff",chance:0.25,effect:"doubleNext",log:"次のターン2回攻撃！"},
    {name:"通常攻撃",type:"basic",power:15,chance:1.00,log:"睡眠妨害攻撃！"}
  ]},
  // 追加分
  {name:"寝返りドラゴン",baseHp:200,spriteClass:"enemy-negaeri",skills:[
    {name:"布団めくり",type:"crit",power:13,chance:0.25,critMul:1.7,log:"布団がはがれた！"},
    {name:"通常攻撃",type:"basic",power:15,chance:1.00,log:"睡眠妨害攻撃！"}
  ]},
  {name:"夜食の誘惑",baseHp:75,spriteClass:"enemy-poteto",skills:[
    {name:"ポテチのささやき",type:"debuff",chance:0.30,effect:"mpDrain",value:12,log:"つい手が伸びてしまう…"},
    {name:"通常攻撃",type:"basic",power:16,chance:1.00,log:"睡眠妨害攻撃！"}
  ]},
  {name:"締切の影",baseHp:90,spriteClass:"enemy-shimekiri",skills:[
    {name:"不安の波",type:"nuke",power:19,chance:0.30,log:"胸がざわつく…！"},
    {name:"焦りの増幅",type:"buff",chance:0.25,effect:"doubleNext",log:"次のターン2回攻撃！"},
    {name:"通常攻撃",type:"basic",power:16,chance:1.00,log:"睡眠妨害攻撃！"}
  ]}
];

function sampleWithoutReplacement(arr, n){
  const pool = arr.slice();
  const out = [];
  while (out.length < Math.min(n, pool.length)) {
    out.push(pool.splice(Math.floor(Math.random()*pool.length), 1)[0]);
  }
  return out;
}

function buildEnemySequence(diffKey){
  if (diffKey === "EASY" || diffKey === "NORMAL") {
    return ENEMY_MASTERS.slice(0, 3);   // 既定の3体
  }
  const count = (diffKey === "HARD") ? 4 : 5; // NIGHTMAREは5体
  return sampleWithoutReplacement(ENEMY_MASTERS, count);
}

// ===== state =====
let state = {
  diffKey: "NORMAL",
  player: { name:"勇者ねむねむ", maxHp:100, hp:100, maxMp:50, mp:50, items:3, skills: [] },
  enemyIndex: 0,
  enemies: [],
  enemy: null,
  enemyDoubleNext: false,
  busy: false,
  gameEnded: false,
  turnCount: 0
};

// ===== UI helpers =====
function openSkillOverlay(){
  const ov = $("#skillOverlay");
  const list = $("#skillList");
  if (!ov || !list) return;

  list.innerHTML = "";
  state.player.skills.forEach(sk => {
    const li = document.createElement("li");
    li.className = "skill-item";
    li.innerHTML = `
      <div style="flex:1">
        <div class="skill-row">
          <div class="skill-name">${sk.name}</div>
          <div class="skill-cost">MP ${sk.mp}</div>
        </div>
        <div class="skill-desc">${sk.desc}</div>
      </div>
    `;
    li.addEventListener("click", () => {
      closeSkillOverlay();
      playerUseSkill(sk);
    });
    list.appendChild(li);
  });

  ov.classList.remove("hidden");
  setCommandsEnabled(false);
}
function closeSkillOverlay(){
  const ov = $("#skillOverlay");
  if (ov) ov.classList.add("hidden");
  if (!state.busy && !state.gameEnded) setCommandsEnabled(true);
}

function setBars(){
  const { player, enemy } = state;
  const hpFill = $("#playerHpBar");
  const mpFill = $("#playerMpBar");
  const ehpFill = $("#enemyHpBar");

  hpFill.style.width = (player.hp/player.maxHp*100) + "%";
  mpFill.style.width = (player.mp/player.maxMp*100) + "%";
  ehpFill.style.width = enemy ? (enemy.hp/enemy.maxHp*100) + "%" : "0%";

  $("#playerHpWrap").setAttribute("data-value", `${player.hp}/${player.maxHp}`);
  $("#playerMpWrap").setAttribute("data-value", `${player.mp}/${player.maxMp}`);
  $("#enemyHpWrap").setAttribute("data-value", enemy ? `${enemy.hp}/${enemy.maxHp}` : `--/--`);
  hpFill.setAttribute("data-value", `${player.hp}/${player.maxHp}`);
  mpFill.setAttribute("data-value", `${player.mp}/${player.maxMp}`);
  ehpFill.setAttribute("data-value", enemy ? `${enemy.hp}/${enemy.maxHp}` : `--/--`);

  $("#itemPill").textContent = `回復アイテムx${player.items}`;
}

function setCommandsEnabled(v){
  $("#btnAttack").disabled = !v;
  $("#btnSkill").disabled  = !v;
  $("#btnItem").disabled   = !v;
  $("#btnRest").disabled   = !v;
}

function setDifficultyPill(){
  const k = state.diffKey;
  const total = state.enemies?.length || 0;
  const current = (total && state.enemyIndex < total) ? (state.enemyIndex + 1) : 0;
  const text = total ? `${k} ・ ${DIFFS[k].label} ・ ${current}/${total}` : `${k} ・ ${DIFFS[k].label}`;
  $("#difficultyPill").textContent = text;
}

function populateDiffButtons(){
  const row = $("#difficultyRow");
  row.innerHTML = "";
  ["EASY","NORMAL","HARD","NIGHTMARE"].forEach(k=>{
    const d = document.createElement("div");
    d.className = "diff" + (k==="NORMAL" ? " active" : "");
    d.textContent = k;
    d.dataset.key = k;
    d.addEventListener("click", ()=>{
      document.querySelectorAll(".diff").forEach(x=>x.classList.remove("active"));
      d.classList.add("active");
      state.diffKey = k;
    });
    row.appendChild(d);
  });
}

// ===== flow =====
function finishGame(){
  state.gameEnded = true;
  setCommandsEnabled(false);
  log("すべての魔物を倒した！快眠が訪れる……zzz");
  if (typeof window.showVictoryModal === "function") {
    window.showVictoryModal(state.turnCount || 0);
  } else {
    showToast("クリア！おめでとう ✨");
  }
}

function startGame(){
  const name = $("#playerName").value.trim() || "勇者ねむねむ";
  state.player.name = name;

  const diff = DIFFS[state.diffKey];
  state.player.maxHp = diff.pHP;
  state.player.hp    = diff.pHP;
  state.player.maxMp = diff.pMP;
  state.player.mp    = diff.pMP;
  state.player.items = diff.items;

  // スキルロード
  state.player.skills = PLAYER_SKILLS.map(s => ({ ...s }));

  // 敵リスト生成（数と順序は難易度で決定）
  const selected = buildEnemySequence(state.diffKey);
  state.enemies = selected.map(m=>{
    const hp = Math.round(m.baseHp * diff.eHpMul);
    return { name:m.name, spriteClass:m.spriteClass, baseHp:m.baseHp, maxHp:hp, hp:hp, skills:m.skills.map(s=>({...s})) };
  });

  state.enemyIndex = 0;
  state.enemy = null;
  state.enemyDoubleNext = false;
  state.busy = false;
  state.gameEnded = false;
  state.turnCount = 0;

  $("#start-screen").classList.add("hidden");
  $("#game-screen").classList.remove("hidden");
  setDifficultyPill();

  $("#playerNameLabel").textContent = state.player.name;

  const psp = document.querySelector(".player-sprite");
  if (psp) psp.classList.add("player-img");

  nextEnemy();
}

function nextEnemy(){
  if (state.enemyIndex >= state.enemies.length){
    finishGame();
    return;
  }
  state.enemy = { ...state.enemies[state.enemyIndex] };

  const enemySprite = $("#enemySprite");
  enemySprite.className = "sprite enemy-sprite " + (state.enemy.spriteClass || "");
  enemySprite.classList.remove("shake");
  enemySprite.style.display = "block";

  setDifficultyPill();

  $("#enemyNameLabel").textContent = state.enemy.name;

  setBars();
  log(`魔物が現れた！: ${state.enemy.name}`);
  setCommandsEnabled(true);
  state.busy = false;
}

function playerTurn(action){
  if (state.busy || state.gameEnded || !state.enemy) return;

  const enemyBox  = $("#enemySprite");
  const playerBox = document.querySelector(".player-sprite");

  state.busy = true;
  setCommandsEnabled(false);

  const e = state.enemy;
  const p = state.player;
  state.turnCount++;

  if (action === "attack"){
    const dmg = 20;
    e.hp = clamp(e.hp - dmg, 0, e.maxHp);
    enemyBox.classList.add("shake");
    setTimeout(()=>enemyBox.classList.remove("shake"), 250);
    floatText(enemyBox, `-${dmg}`, "dmg");
    log(`${p.name}の攻撃！ ${e.name}に ${dmg} ダメージ！`, "dmg");

  } else if (action === "skill"){
    // 旧ワンボタンスキルはオーバーレイに置き換え
    openSkillOverlay();
    state.busy = false; // 入力待ちに戻す
    return;

  } else if (action === "item") {
    if (p.items <= 0){
      log("回復アイテムを持っていない！");
      showToast("アイテムがありません！");
      state.busy = false;
      setCommandsEnabled(true);
      return;
    }
    const heal = 50;
    const mpRecover = 20;
    p.items--;
    p.hp = clamp(p.hp + heal, 0, p.maxHp);
    p.mp = clamp(p.mp + mpRecover, 0, p.maxMp);
    floatText(playerBox, `+${heal}`, "heal");
    floatText(playerBox, `+${mpRecover}MP`, "heal");
    log("回復アイテムを使用した！", "heal");

    const spark = document.createElement("div");
    spark.style.width = "90px";
    spark.style.height = "90px";
    spark.style.borderRadius = "50%";
    spark.style.boxShadow = "0 0 18px 6px rgba(110,255,180,.65) inset, 0 0 24px rgba(110,255,180,.85)";
    spark.style.position = "absolute";
    const pb  = document.querySelector(".player").getBoundingClientRect();
    const app = document.querySelector(".arena").getBoundingClientRect();
    spark.style.left = (pb.left + pb.width/2 - app.left - 45) + "px";
    spark.style.top  = (pb.top  + pb.height/2 - app.top  - 45) + "px";
    $("#effectLayer").appendChild(spark);
    setTimeout(()=>spark.remove(), 450);

  } else if (action === "rest") {
    const mpCost = 20;
    if (p.mp < mpCost) {
      log("MPが足りない…");
      showToast("MPが足りない…");
      state.busy = false;
      setCommandsEnabled(true);
      return;
    }
    const heal = 40;
    p.hp = clamp(p.hp + heal, 0, p.maxHp);
    p.mp = clamp(p.mp - mpCost, 0, p.maxMp);
    floatText(playerBox, `+${heal}`, "heal");
    floatText(playerBox, `-${mpCost}MP`, "dmg");
    log("ひと休みして体勢を立て直した。", "heal");
  }

  setBars();

  // 撃破判定
  if (e.hp <= 0) {
    log(`${e.name}を倒した！`);
    state.enemyIndex++;

    const banner = $("#nextEnemyBanner");
    const enemySprite = $("#enemySprite");

    enemySprite.classList.add("fadeout");
    setTimeout(() => {
      enemySprite.classList.remove("fadeout");
      enemySprite.style.display = "none";
      banner.style.display = "block";
    }, 800);

    setTimeout(() => {
      banner.style.display = "none";
      nextEnemy();
      state.busy = false;
    }, 2000);

    return;
  }

  // 睡眠でスキップ（プレイヤー側はここでは発生しない）

  // 敵ターンへ
  setTimeout(()=>{
    if (!state.gameEnded) enemyTurn();
  }, DIFFS[state.diffKey].delay);
}

function playerUseSkill(sk){
  if (state.busy || state.gameEnded || !state.enemy) return;

  const p = state.player;
  const e = state.enemy;
  const enemyBox  = $("#enemySprite");
  const playerBox = document.querySelector(".player-sprite");

  if (p.mp < sk.mp){
    log("MPが足りない…");
    showToast("MPが足りない…");
    return;
  }

  state.busy = true;
  setCommandsEnabled(false);
  state.turnCount++;

  // コスト消費
  p.mp = clamp(p.mp - sk.mp, 0, p.maxMp);

  // 効果適用
  let didAttack = false;
  if (sk.effect.dmg){
    const dmg = sk.effect.dmg;
    e.hp = clamp(e.hp - dmg, 0, e.maxHp);
    didAttack = true;
    enemyBox.classList.add("shake");
    setTimeout(()=>enemyBox.classList.remove("shake"), 250);
    floatText(enemyBox, `-${dmg}`, "dmg");
  }
  if (sk.effect.sleep){
    const slept = Math.random() < sk.effect.sleep;
    if (slept) e._skipTurn = true;
  }
  if (sk.effect.heal){
    const heal = sk.effect.heal;
    p.hp = clamp(p.hp + heal, 0, p.maxHp);
    floatText(playerBox, `+${heal}`, "heal");
  }
  if (sk.effect.mpGain){
    const g = sk.effect.mpGain;
    p.mp = clamp(p.mp + g, 0, p.maxMp);
    floatText(playerBox, `+${g}MP`, "heal");
  }

  log(sk.log || `${p.name}はスキルを使った！`, didAttack ? "dmg" : "heal");
  setBars();

  // 撃破判定
  if (e.hp <= 0) {
    log(`${e.name}を倒した！`);
    state.enemyIndex++;

    const banner = $("#nextEnemyBanner");
    const enemySprite = $("#enemySprite");

    enemySprite.classList.add("fadeout");
    setTimeout(() => {
      enemySprite.classList.remove("fadeout");
      enemySprite.style.display = "none";
      banner.style.display = "block";
    }, 800);

    setTimeout(() => {
      banner.style.display = "none";
      nextEnemy();
      state.busy = false;
    }, 2000);

    return;
  }

  // 敵が眠っていればスキップ
  if (e._skipTurn){
    delete e._skipTurn;
    log(`${e.name}は眠っていて動けない！`);
    state.busy = false;
    if (!state.gameEnded) setCommandsEnabled(true);
    return;
  }

  // 敵ターンへ
  setTimeout(()=>{
    if (!state.gameEnded) enemyTurn();
  }, DIFFS[state.diffKey].delay);
}

function enemyTurn(){
  if (state.gameEnded || !state.enemy) return;

  const e = state.enemy;
  const p = state.player;
  const enemyBox  = $("#enemySprite");
  const playerBox = document.querySelector(".player-sprite");

  // スキル抽選
  let chosen = e.skills.find(s => s.name.includes("通常攻撃"));
  for (let i=0;i<e.skills.length;i++){
    const s = e.skills[i];
    if (Math.random() < (s.chance || 0)){ chosen = s; break; }
  }

  const diff  = DIFFS[state.diffKey];
  const dmgMul = diff.eDmgMul;
  let logs = [];

  const performBasic = (power)=>{
    const dmg = Math.round((power||14) * dmgMul);
    p.hp = clamp(p.hp - dmg, 0, p.maxHp);
    playerBox.classList.add("shake");
    setTimeout(()=>playerBox.classList.remove("shake"), 250);
    floatText(playerBox, `-${dmg}`, "dmg");
    logs.push(`${e.name}の ${chosen.log || chosen.name} ${p.name}は ${dmg} ダメージ！`);
  };

  if (chosen.type === "basic"){
    performBasic(chosen.power ?? 14);
  } else if (chosen.type === "nuke"){
    performBasic(chosen.power ?? 16);
  } else if (chosen.type === "crit"){
    const base = chosen.power ?? 12;
    const critMul = chosen.critMul ?? 1.5;
    const isCrit = Math.random() < 0.35;
    const dmg = Math.round(base * (isCrit ? critMul : 1) * dmgMul);
    p.hp = clamp(p.hp - dmg, 0, p.maxHp);
    playerBox.classList.add("shake");
    setTimeout(()=>playerBox.classList.remove("shake"), 250);
    floatText(playerBox, `-${dmg}${isCrit?"!!":""}`, isCrit ? "crit" : "dmg");
    logs.push(`${e.name}の ${chosen.name}！ ${isCrit?"痛恨の一撃！！ ":""}`);
    logs.push(`${p.name}は ${dmg} のダメージ！`);
  } else if (chosen.type === "debuff"){
    if (chosen.effect === "mpDrain"){
      const loss = chosen.value ?? 10;
      p.mp = clamp(p.mp - loss, 0, p.maxMp);
      floatText(playerBox, `-${loss}MP`, "dmg");
      logs.push(`${e.name}の ${chosen.name}！ ${chosen.log}`);
    } else {
      performBasic(12);
    }
  } else if (chosen.type === "buff"){
    if (chosen.effect === "doubleNext"){
      state.enemyDoubleNext = true;
      logs.push(`${e.name}の ${chosen.name}！ ${chosen.log}`);
    } else {
      logs.push(`${e.name}は様子を見ている…`);
    }
  }

  logs.forEach(t=>log(t));
  setBars();

  if (state.enemyDoubleNext && chosen.type !== "buff"){
    state.enemyDoubleNext = false;
    setTimeout(()=>{
      if (state.gameEnded) return;
      const base = 12;
      const dmg = Math.round(base * DIFFS[state.diffKey].eDmgMul);
      p.hp = clamp(p.hp - dmg, 0, p.maxHp);
      playerBox.classList.add("shake");
      setTimeout(()=>playerBox.classList.remove("shake"), 250);
      floatText(playerBox, `-${dmg}`, "dmg");
      log(`${e.name}の 追撃！ ${p.name}は ${dmg} ダメージ！`, "dmg");
      setBars();
      finishEnemyTurn();
    }, 350);
  } else {
    finishEnemyTurn();
  }
}

function finishEnemyTurn() {
  if (state.player.hp <= 0) {
    log("あなたは眠りを妨げられてしまった…… GAME OVER");
    showToast("ゲームオーバー");
    setCommandsEnabled(false);
    const gameScreen = $("#game-screen");
    const gameoverModal = $("#gameoverModal");
    if (gameScreen && gameoverModal) {
      gameScreen.classList.add("hidden");
      gameoverModal.style.display = "block";
    }
    state.busy = true;
    return;
  }
  state.busy = false;
  setCommandsEnabled(true);
}

// ===== boot =====
window.addEventListener("DOMContentLoaded", ()=>{
  populateDiffButtons();
  $("#startBtn").addEventListener("click", startGame);
  $("#btnAttack").addEventListener("click", ()=>playerTurn("attack"));
  $("#btnSkill").addEventListener("click",  ()=>playerTurn("skill"));
  $("#btnItem").addEventListener("click",   ()=>playerTurn("item"));
  $("#btnRest").addEventListener("click",   ()=>playerTurn("rest"));
  $("#btnRetry").addEventListener("click",  ()=>location.reload());

  // オーバーレイの閉じる
  const close = $("#skillClose");
  if (close) close.addEventListener("click", closeSkillOverlay);
  // 背景タップで閉じる（シート内は閉じない）
  const ov = $("#skillOverlay");
  if (ov) ov.addEventListener("click", (e)=>{
    if (e.target.id === "skillOverlay") closeSkillOverlay();
  });
});

function showVictoryModal(turns){
  const modal = document.getElementById("victoryModal");
  const span = document.getElementById("turnCountDisplay");
  span.textContent = turns;
  modal.style.display = "block";
}
