const DOT_HW = "ﾋﾞ";
const DASH_HW = "ﾋﾞｰ";

const $ = (id) => document.getElementById(id);

const input = $("input");
const output = $("output");
const errors = $("errors");
const btnEncode = $("btnEncode");
const btnDecode = $("btnDecode");
const inputLabel = $("inputLabel");

let mode = "decode"; // 最初はdecode

const kanaToMorse = {
  "あ":"--.--","い":".-","う":"..-","え":"-.---","お":".-...",
  "か":".-..","き":"-.-..","く":"...-","け":"-.--","こ":"----",
  "さ":"-.-.-","し":"--.-.","す":"---.-","せ":".---.","そ":"---.",
  "た":"-.","ち":"..-.","つ":".--.","て":".-.--","と":"..-..",
  "な":".-.","に":"-.-.","ぬ":"....","ね":"--.-","の":"..--",
  "は":"-...","ひ":"--..-","ふ":"--..","へ":".","ほ":"-..",
  "ま":"-..-","み":"..-.-","む":"-","め":"-...-","も":"-..-.",
  "や":".--","ゆ":"-..--","よ":"--",
  "ら":"...","り":"--.","る":"-.--.","れ":"---","ろ":".-.-",
  "わ":"-.-","を":".---","ん":".-.-.","ゐ":".-..-","ゑ":".--..",
  "ー":".--.-","、":".-.-.-","。":".-.-..",
  "゛":"..","゜":"..--."
};

const morseToKana = Object.fromEntries(
  Object.entries(kanaToMorse)
    .filter(([k]) => k !== "゛" && k !== "゜")
    .map(([k,v]) => [v,k])
);

const dakutenMap = {
  "か":"が","き":"ぎ","く":"ぐ","け":"げ","こ":"ご",
  "さ":"ざ","し":"じ","す":"ず","せ":"ぜ","そ":"ぞ",
  "た":"だ","ち":"ぢ","つ":"づ","て":"で","と":"ど",
  "は":"ば","ひ":"び","ふ":"ぶ","へ":"べ","ほ":"ぼ",
  "う":"ゔ"
};

const handakutenMap = {
  "は":"ぱ","ひ":"ぴ","ふ":"ぷ","へ":"ぺ","ほ":"ぽ"
};

const smallMap = {
  "ぁ":"あ","ぃ":"い","ぅ":"う","ぇ":"え","ぉ":"お",
  "ゃ":"や","ゅ":"ゆ","ょ":"よ","っ":"つ","ゎ":"わ"
};

function setMode(next){
  mode = next;
  btnEncode.classList.toggle("active", mode === "encode");
  btnDecode.classList.toggle("active", mode === "decode");

  if (mode === "encode") {
    inputLabel.textContent = "ひらがなを入力";
    input.placeholder = "例：やさしいろなるど";
  } else {
    inputLabel.textContent = "信号を入力";
    input.placeholder = `例：${DOT_HW}${DASH_HW}${DOT_HW}${DASH_HW} ${DASH_HW}${DOT_HW}${DOT_HW}${DASH_HW}${DOT_HW}${DASH_HW} ...`;
  }
  render();
}

function kanaNormalize(s){
  let t = (s ?? "").normalize("NFKC");

  t = t.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );

  t = t.replace(/[ぁぃぅぇぉゃゅょっゎ]/g, ch => smallMap[ch] ?? ch);

  return t;
}

function toBeep(morse){

  return morse.replace(/\./g, DOT_HW).replace(/-/g, DASH_HW);
}

function normalizeSpaces(s){

  return (s ?? "").replace(/\u3000/g, " ");
}

function fromBeepToken(token){

  const t = (token ?? "").normalize("NFKC");

  return t.replace(/ビー/g, "-").replace(/ビ/g, ".");
}


function guessModeFromText(text){
  const t = normalizeSpaces(text).normalize("NFKC").trim();
  if (!t) return null;

 
  const signalLike = /^[ビーペ゛゜\/／\s]+$/.test(t);
  if (signalLike) return "decode";

  return "encode";
}

function encode(text){
  const norm = kanaNormalize(text).normalize("NFD");
  const tokens = [];
  let hasError = false;

  for (const ch of norm){
    if (ch === "/"){
      tokens.push("/");
      continue;
    }
    if (/\s/.test(ch)){
      tokens.push("/");
      continue;
    }
    if (ch === "\u3099"){ // ゙
      tokens.push(toBeep(kanaToMorse["゛"]));
      continue;
    }
    if (ch === "\u309A"){ // ゚
      tokens.push(toBeep(kanaToMorse["゜"]));
      continue;
    }

    const morse = kanaToMorse[ch];
    if (!morse){
      hasError = true;
      continue;
    }
    tokens.push(toBeep(morse));
  }


  const compact = [];
  for (const t of tokens){
    if (t === "/" && compact[compact.length - 1] === "/") continue;
    compact.push(t);
  }
  while (compact[0] === "/") compact.shift();
  while (compact[compact.length - 1] === "/") compact.pop();

  return { out: compact.join(" "), hasError };
}

function applyMark(outArr, kind){
  if (outArr.length === 0) return false;
  const last = outArr[outArr.length - 1];
  const map = (kind === "dakuten") ? dakutenMap : handakutenMap;
  const changed = map[last];
  if (!changed) return false;
  outArr[outArr.length - 1] = changed;
  return true;
}

function decode(code){
  const outArr = [];
  let hasError = false;

  const raw = normalizeSpaces(code).trim();
  if (!raw) return { out: "", hasError: false };

  const parts = raw.split(/\s+/).filter(Boolean);

  for (const p of parts){
    if (p === "/" || p === "／"){
      outArr.push(" ");
      continue;
    }

    const morse = fromBeepToken(p);

    if (!/^[.-]+$/.test(morse)){
      hasError = true;
      continue;
    }

    if (morse === kanaToMorse["゛"]){
      if (!applyMark(outArr, "dakuten")) hasError = true;
      continue;
    }
    if (morse === kanaToMorse["゜"]){
      if (!applyMark(outArr, "handakuten")) hasError = true;
      continue;
    }

    const kana = morseToKana[morse];
    if (!kana){
      hasError = true;
      continue;
    }
    outArr.push(kana);
  }

  const out = outArr.join("").replace(/ {2,}/g, " ").trim();
  return { out, hasError };
}

function render(){
  const val = input.value ?? "";
  const result = (mode === "encode") ? encode(val) : decode(val);

  output.value = result.out;
  errors.textContent = result.hasError ? "⚠️ 変換できない文字が含まれています" : "";
}

btnEncode.addEventListener("click", () => setMode("encode"));
btnDecode.addEventListener("click", () => setMode("decode"));

$("clear").addEventListener("click", () => {
  input.value = "";
  output.value = "";
  errors.textContent = "";
});

$("copy").addEventListener("click", async () => {
  try{
    await navigator.clipboard.writeText(output.value ?? "");
    $("copy").textContent = "コピー完了";
    setTimeout(() => ($("copy").textContent = "出力をコピー"), 900);
  }catch{
    errors.textContent = "⚠️ 変換できない文字が含まれています";
  }
});

$("swap").addEventListener("click", () => {
  const a = input.value;
  input.value = output.value;
  output.value = a;
  setMode(mode === "encode" ? "decode" : "encode");
});

input.addEventListener("input", render);


input.addEventListener("paste", () => {
  setTimeout(() => {
    const guess = guessModeFromText(input.value);
    if (guess && guess !== mode) setMode(guess);
    else render();
  }, 0);
});


input.addEventListener("drop", () => {
  setTimeout(() => {
    const guess = guessModeFromText(input.value);
    if (guess && guess !== mode) setMode(guess);
    else render();
  }, 0);
});


setMode("decode");