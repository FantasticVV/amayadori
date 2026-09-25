// 雨宿り AMAYADORI —— 单页，无路由。
// 流程：开场（街景 iframe + 输入框）→ 一句话生成今夜参数 → postMessage 给街景
//   → 走到店门口、推门、店里挑东西、结账出小票、窗边坐一会儿，全部在 iframe 里完成
//   → 收到 amayadori:door 收起街上的字和输入框；收到 amayadori:street 恢复。

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "./config/brand";
import Subtitle from "./components/Subtitle";
import PromptBar from "./components/PromptBar";

export default function App() {
  // view: intro(开场) → street(街上) ⇄ inside(店里)
  const [view, setView] = useState("intro");
  const [nightScene, setNightScene] = useState(null);
  const [line, setLine] = useState("");
  const [visit, setVisit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promptOpen, setPromptOpen] = useState(true);

  const iframeRef = useRef(null);
  const pendingSceneRef = useRef(null); // iframe 还没加载完时，load 后补发

  useEffect(() => {
    document.title = BRAND.displayName;
  }, []);

  const postToStreet = useCallback((msg) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  const onIframeLoad = useCallback(() => {
    if (pendingSceneRef.current) postToStreet(pendingSceneRef.current);
  }, [postToStreet]);

  // 一句话 → /api/night/scene → 今夜参数整份发给街景（货架、店员、字幕也在里面）
  const generate = useCallback(
    async (prompt) => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch("api/night/scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setNightScene(data);
        setLine(prompt);
        const msg = { type: "amayadori:setScene", scene: { ...data, line: prompt } };
        pendingSceneRef.current = msg;
        postToStreet(msg);
        setPromptOpen(true);
        setView("street");
      } catch (e) {
        setError("今晚的雨没有落下来，再试一次。");
      } finally {
        setLoading(false);
      }
    },
    [postToStreet],
  );

  // 街景里的进度：推门进店 / 回到街上
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return; // 只信自家 iframe
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "amayadori:door") {
        setView("inside");
        setPromptOpen(false);
      } else if (d.type === "amayadori:street") {
        setView((v) => (v === "inside" ? "street" : v));
        setVisit((n) => n + 1);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // 街上：生成后 4.5 秒收起输入框
  useEffect(() => {
    if (view === "street" && promptOpen) {
      const t = setTimeout(() => setPromptOpen(false), 4500);
      return () => clearTimeout(t);
    }
  }, [view, promptOpen]);

  // Esc 唤回输入框（只在街上）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && view === "street") setPromptOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  return (
    <div className={`app view-${view}`}>
      {/* 街景 + 店里：整段体验都在这个 iframe 里 */}
      <iframe
        ref={iframeRef}
        className="street-iframe"
        src="amayadori.html?embed"
        title="雨宿り"
        onLoad={onIframeLoad}
        allow="autoplay"
      />

      <header className="brand-corner">{BRAND.displayName}</header>

      {/* 街上：输入框收起后，留这句话 + 今夜字幕 + 换个夜晚 */}
      {view === "street" && nightScene && !promptOpen && (
        <>
          <div className="line-quote">{line}</div>
          <Subtitle key={`street-${visit}-${nightScene.sceneTag}`} text={nightScene.sceneTag} />
          <button type="button" className="reopen-btn" onClick={() => setPromptOpen(true)}>
            {loading ? "正在落雨 …" : "✎ 换个夜晚"}
          </button>
        </>
      )}

      {/* 输入框：开场和街上（可收起）；进店后不显示 */}
      {view !== "inside" && (
        <main className={`stage${view === "intro" ? " stage--center" : " stage--bottom"}`}>
          <div className={`prompt-wrap${view !== "intro" && !promptOpen ? " prompt-wrap--hidden" : ""}`}>
            <PromptBar
              placeholder={BRAND.placeholder}
              loading={loading}
              error={error}
              onSubmit={generate}
              compact={view !== "intro"}
            />
          </div>
        </main>
      )}
    </div>
  );
}
