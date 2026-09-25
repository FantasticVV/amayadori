// 店员开口说话：把 AI 写好的两句台词（推门一句、结账一句）合成语音。
// 用阿里云百炼的 CosyVoice（HTTP 接口）。没有配 TTS_API_KEY 就整个跳过，店员照常只显示文字。
// 只合成服务端自己生成的台词，按随机 id 取；不开放「任意文字转语音」，免得被当成免费配音接口。

const crypto = require("crypto");

const KEY = (process.env.TTS_API_KEY || "").trim();
const MODEL = process.env.TTS_MODEL || "cosyvoice-v3-flash";
const VOICE = process.env.TTS_VOICE || "longyuan_v3"; // 龙媛：温暖治愈女
const WORKSPACE = (process.env.TTS_WORKSPACE_ID || "").trim();
const ENDPOINT =
  process.env.TTS_URL ||
  (WORKSPACE
    ? `https://${WORKSPACE}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`
    : "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer");

const isConfigured = () => Boolean(KEY);

async function synthesize(text, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input: { text, voice: VOICE, format: "mp3", sample_rate: 24000 } }),
      signal: ctrl.signal,
    });
    const body = await r.text();
    if (!r.ok) throw new Error(`http ${r.status} ${body.slice(0, 200)}`);
    let j;
    try {
      j = JSON.parse(body);
    } catch (_) {
      throw new Error("reply is not json");
    }
    const audio = j && j.output && j.output.audio;
    if (audio && typeof audio.data === "string" && audio.data) return Buffer.from(audio.data, "base64");
    if (!audio || !audio.url) throw new Error(`no audio (${(j && (j.code || j.message)) || "unknown"})`);
    const a = await fetch(audio.url, { signal: ctrl.signal });
    if (!a.ok) throw new Error(`audio http ${a.status}`);
    return Buffer.from(await a.arrayBuffer());
  } catch (e) {
    throw new Error(ctrl.signal.aborted ? `timeout ${timeoutMs}ms` : e.message);
  } finally {
    clearTimeout(timer);
  }
}

// 合成任务：生成今夜时就开始，前端走到门口、推门时再来取，通常早就合成好了
const jobs = new Map(); // id → { p: Promise<Buffer|null>, t }
const TTL_MS = 30 * 60 * 1000;
const MAX_JOBS = 300;
function sweep() {
  const now = Date.now();
  for (const [k, v] of jobs) if (now - v.t > TTL_MS) jobs.delete(k);
  while (jobs.size > MAX_JOBS) jobs.delete(jobs.keys().next().value);
}

// 返回取语音用的 id；没配 Key 或者没有这句话，返回空串
function queue(text) {
  if (!isConfigured() || !text) return "";
  sweep();
  const id = crypto.randomBytes(12).toString("base64url");
  const t0 = Date.now();
  const chars = Array.from(text).length;
  const p = synthesize(text).then(
    (buf) => {
      console.log(`[tts] ok ${Date.now() - t0}ms chars=${chars} bytes=${buf.length}`);
      return buf;
    },
    (e) => {
      console.log(`[tts] fail ${Date.now() - t0}ms ${e.message}`);
      return null;
    },
  );
  jobs.set(id, { p, t: Date.now() });
  return id;
}

async function take(id) {
  const j = jobs.get(id);
  return j ? j.p : null;
}

module.exports = { isConfigured, queue, take, MODEL, VOICE };
