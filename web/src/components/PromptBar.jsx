import React, { useEffect, useState } from "react";

// 一句话输入框：开场在下方居中，回到街上想换个夜晚时缩小沉底。
// 等 AI 的那几秒：输入框留在原地，下面一条细细的进度光 + 一句一句换的提示，让人知道「在准备，不是没反应」。
// 手机上不自动聚焦：一打开就弹键盘会把街景挡住
const TOUCH = typeof window !== "undefined" && !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
const WAIT = ["收到了，正在为这句话落一场雨", "正在调今晚的雨和灯", "店员在写手写价签", "就快好了"];

export default function PromptBar({ placeholder, loading, error, onSubmit, compact }) {
  const [value, setValue] = useState("");
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    if (!loading) return undefined;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, WAIT.length - 1)), 2600);
    return () => clearInterval(t);
  }, [loading]);

  function submit(e) {
    e.preventDefault();
    const p = value.trim();
    if (p && !loading) onSubmit(p);
  }

  return (
    <form className={`prompt${compact ? " prompt--compact" : ""}${loading ? " prompt--loading" : ""}`} onSubmit={submit}>
      {!compact && <div className="prompt-kicker">雨夜便利店 · 场景生成</div>}
      <div className="prompt-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          maxLength={200}
          autoFocus={!TOUCH}
          aria-label="描述今晚"
        />
        <button type="submit" disabled={loading || !value.trim()} aria-label="生成场景">
          {loading ? <span className="dots">···</span> : "→"}
        </button>
      </div>
      {loading && (
        <div className="prompt-progress" aria-hidden="true">
          <span />
        </div>
      )}
      <div className={`prompt-hint${error ? " prompt-hint--error" : ""}${loading ? " prompt-hint--wait" : ""}`} aria-live="polite">
        {loading ? WAIT[step] : error || (compact ? "" : "一句话，生成今晚的街角")}
      </div>
    </form>
  );
}
