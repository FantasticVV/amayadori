// 雨宿り AMAYADORI —— 服务端。
//   POST /api/night/scene  一句话 → 今夜（环境参数 + 店里的几句话 + 店员两句话的语音 id）
//   GET  /api/voice/:id    店员那句话的语音（配了 TTS_API_KEY 才有）
//   GET  /health           健康检查
//   其余                    static/ 里构建好的前端
// 模型失败时返回兜底场景（HTTP 200），链路不断；Key 只在服务端。

const path = require("path");
const fs = require("fs");

// 本地运行时可以把 Key 写在工程根目录的 .env 里（线上用平台的环境变量）
try {
  for (const line of fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (_) {
  /* 没有 .env 就用环境变量 */
}

const express = require("express");
const { generateSceneSafe } = require("./nightScene");
const { isConfigured, MODEL } = require("./llm");
const tts = require("./tts");

const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "8kb" }));

const STATIC_DIR = path.resolve(__dirname, "..", "static");

app.get(["/health", "/healthz"], (_req, res) =>
  res.json({ status: "ok", ai: isConfigured() ? MODEL : "not_configured", tts: tts.isConfigured() ? tts.VOICE : "not_configured" }),
);

// 公开的接口背后是按量付费的模型：按来源限流，再加一道全站上限，防止被刷
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 60; // 每个来源 10 分钟最多 60 次（同一个办公室常常共用一个出口 IP）
const PER_HOUR = 600; // 全站每小时最多 600 次
const hits = new Map();
let hourStart = Date.now();
let hourCount = 0;
function allow(ip) {
  const now = Date.now();
  if (now - hourStart > 3600 * 1000) {
    hourStart = now;
    hourCount = 0;
  }
  if (hourCount >= PER_HOUR) return false;
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_IP) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  hourCount++;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return true;
}

app.post("/api/night/scene", async (req, res) => {
  const prompt = String((req.body && req.body.prompt) || "").trim().slice(0, 300);
  if (!prompt) return res.status(400).json({ error: "prompt required" });
  if (!allow(req.ip)) return res.status(429).json({ error: "too many requests" });
  const t0 = Date.now();
  const { scene, fallback, reason } = await generateSceneSafe(prompt);
  // 店员的两句话：配了语音就在后台开始合成，前端推门、结账时按 id 来取
  if (tts.isConfigured()) {
    const g = tts.queue(scene.greet);
    const b = tts.queue(scene.bye);
    scene.voice = { greet: g ? `api/voice/${g}` : "", bye: b ? `api/voice/${b}` : "" };
  }
  // 不记用户的原话：只记长度和结果
  console.log(
    `[night/scene] ${Date.now() - t0}ms fallback=${fallback}${reason ? ` reason=${reason}` : ""} care=${scene.care} len=${prompt.length}`,
  );
  res.json(scene);
});

app.get("/api/voice/:id", async (req, res) => {
  const id = String(req.params.id || "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return res.status(404).end();
  const buf = await tts.take(id);
  if (!buf) return res.status(404).end();
  res.set("Content-Type", "audio/mpeg");
  res.set("Cache-Control", "private, max-age=1800");
  res.end(buf);
});

// 页面（.html）每次都跟服务器确认一下有没有更新，改了代码大家马上看到新版；
// 带指纹的打包文件（assets/）内容变了名字就变，可以放心缓存很久；画、视频、声音缓存 1 小时
app.use(
  express.static(STATIC_DIR, {
    index: "index.html",
    maxAge: "1h",
    setHeaders(res, file) {
      if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
      else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }),
);

const PORT = parseInt(process.env.PORT || process.env.APP_PORT || "3000", 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `listening on :${PORT} · ai=${isConfigured() ? MODEL : "not configured (fallback scenes only)"} · tts=${tts.isConfigured() ? `${tts.MODEL}/${tts.VOICE}` : "off"}`,
  );
});
