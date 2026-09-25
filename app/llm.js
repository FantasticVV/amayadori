// 调大模型：任何 OpenAI 兼容的接口都行（DeepSeek、通义千问、Kimi、智谱……）。
// Key 只从服务器的环境变量读，不进代码、不进浏览器。
//   AI_API_KEY   必填
//   AI_BASE_URL  默认 https://api.deepseek.com
//   AI_MODEL     默认 deepseek-flash

const BASE = (process.env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
const KEY = process.env.AI_API_KEY || "";
const MODEL = process.env.AI_MODEL || "deepseek-flash";
// DeepSeek 的新模型默认先「思考」再回答：又慢，又可能把 token 用在思考上、正文为空。
// 这里只要一小段 JSON，不需要思考，关掉。
const IS_DEEPSEEK = /deepseek\.com/i.test(BASE);

const isConfigured = () => Boolean(KEY);

// 非流式对话，返回模型的文字。json=true 时要求模型只输出 JSON 对象；timeoutMs 到了就中断请求
async function chat(messages, { system = null, maxTokens = 1200, json = true, timeoutMs = 20000 } = {}) {
  if (!KEY) throw new Error("AI_API_KEY is not set");
  const body = {
    model: MODEL,
    messages: system ? [{ role: "system", content: system }, ...messages] : messages,
    max_tokens: maxTokens,
    stream: false,
  };
  if (json) body.response_format = { type: "json_object" };
  if (IS_DEEPSEEK) body.thinking = { type: "disabled" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let r, data;
  try {
    r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    data = await r.json().catch(() => ({}));
  } catch (e) {
    throw new Error(ctrl.signal.aborted ? `AI gateway timeout ${timeoutMs}ms` : `AI gateway unreachable: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok || data.error) {
    const e = data.error;
    throw new Error(`AI gateway error: ${(e && (e.message || e)) || `HTTP ${r.status}`}`);
  }
  const choice = data.choices && data.choices[0];
  const text = choice && choice.message && choice.message.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`AI gateway returned no text${choice && choice.finish_reason ? ` (finish=${choice.finish_reason})` : ""}`);
  }
  return text;
}

module.exports = { chat, isConfigured, MODEL };
