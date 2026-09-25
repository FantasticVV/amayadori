import React, { useState } from "react";

// 一句话输入框：idle 时居中，进入场景后缩小沉底；输入值跨阶段保留，
// 方便“同一句话跑两次”这类对照测试（直接再按一次回车）。
// 手机上不自动聚焦：一打开就弹键盘会把街景挡住
const TOUCH = typeof window !== "undefined" && !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);

export default function PromptBar({ placeholder, loading, error, onSubmit, compact }) {
  const [value, setValue] = useState("");

  function submit(e) {
    e.preventDefault();
    const p = value.trim();
    if (p && !loading) onSubmit(p);
  }

  return (
    <form className={`prompt${compact ? " prompt--compact" : ""}`} onSubmit={submit}>
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
      <div className={`prompt-hint${error ? " prompt-hint--error" : ""}`}>
        {loading ? "正在落雨 …" : error || (compact ? "" : "一句话，生成今晚的街角")}
      </div>
    </form>
  );
}
