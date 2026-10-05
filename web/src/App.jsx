// 雨宿り AMAYADORI —— 单页，无路由。
// 流程：开场（街景 iframe + 输入框）→ 一句话生成今夜参数 → postMessage 给街景
//   → 走到店门口、推门、店里挑东西、结账出小票、窗边坐一会儿，全部在 iframe 里完成
//   → 收到 amayadori:door 收起街上的字和输入框；收到 amayadori:street 恢复。
// 开场先停着：等用户点一下「点一下，雨就开始下」，雨声和开场视频一起开始（浏览器规定点过才能出声）。
// 手机竖着拿：先盖一层「把手机横过来」，转过来再点那一下。
// 网慢的时候街景要下一会儿：街景一跑起来就发 amayadori:boot（自己显示下载进度），开张了发 amayadori:ready。
// 这两个消息一到，就把之前可能没收到的（点过一下、今晚的参数、往店里走）补发一遍，街景那边同一份只用一次。

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "./config/brand";
import Subtitle from "./components/Subtitle";
import PromptBar from "./components/PromptBar";
import RotateHint from "./components/RotateHint";
import StartGate from "./components/StartGate";

const PORTRAIT_PHONE = "(orientation: portrait) and (pointer: coarse)";
const isPortraitPhone = () => !!(window.matchMedia && window.matchMedia(PORTRAIT_PHONE).matches);

function usePortraitPhone() {
  const [on, setOn] = useState(isPortraitPhone);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(PORTRAIT_PHONE);
    const f = () => setOn(m.matches);
    if (m.addEventListener) m.addEventListener("change", f);
    else m.addListener(f); // 老的 iOS Safari
    window.addEventListener("resize", f);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", f);
      else m.removeListener(f);
      window.removeEventListener("resize", f);
    };
  }, []);
  return on;
}

export default function App() {
  // view: intro(开场) → street(街上) ⇄ inside(店里)
  const [view, setView] = useState("intro");
  const [nightScene, setNightScene] = useState(null);
  const [line, setLine] = useState("");
  const [visit, setVisit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [promptOpen, setPromptOpen] = useState(true);
  const [walking, setWalking] = useState(false); // 点了「往店里走」，正在走过去

  const iframeRef = useRef(null);
  const pendingSceneRef = useRef(null); // iframe 还没加载完时，load 后补发

  // 竖屏提示：转过来自动消失；点了「就这样竖着看」这次就不再出现
  const portrait = usePortraitPhone();
  const [dismissed, setDismissed] = useState(false);
  const rotateOn = portrait && !dismissed;
  // 街景加载好（ready）之后出「点一下」；点过（started）才出输入框
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const readyRef = useRef(false);
  const startedRef = useRef(false);
  const bootRef = useRef(false); // 街景的脚本已经跑起来了（之后由它自己显示进度）
  const walkRef = useRef(false); // 点了「往店里走」，还没进门

  useEffect(() => {
    document.title = BRAND.displayName;
  }, []);

  const postToStreet = useCallback((msg) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  // 在用户的点击里叫街景「醒一下声音」：iPhone 上声音被挂起、店里的音乐没解锁，都要在点击里才恢复得了
  const unlockAudio = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.AMAYADORI?.unlock?.();
    } catch (e) {
      /* 拿不到就算了 */
    }
  }, []);

  // 点一下：在这次点击里直接叫街景开始（iPhone 要求出声必须发生在点击里），再补一条消息兜底
  const startScene = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);
    try {
      iframeRef.current?.contentWindow?.AMAYADORI?.start();
    } catch (e) {
      /* 拿不到就只靠下面的消息 */
    }
    postToStreet({ type: "amayadori:go" });
  }, [postToStreet]);

  const skipRotate = useCallback(() => {
    setDismissed(true);
    if (readyRef.current) startScene(); // 这一下也算「点一下」
  }, [startScene]);

  // 街景的脚本 15 秒还没跑起来（页面都没下完）：也先让用户点一下、说句话；等它跑起来再把这些补发过去
  useEffect(() => {
    const t = setTimeout(() => {
      if (bootRef.current) return; // 已经在下画了，进度条在走，等它开张
      readyRef.current = true;
      setReady(true);
    }, 15000);
    return () => clearTimeout(t);
  }, []);

  // 补发：点过一下就再叫一次开始；今晚的参数、「往店里走」也再发一遍
  const resync = useCallback(() => {
    if (startedRef.current) {
      try {
        iframeRef.current?.contentWindow?.AMAYADORI?.start();
      } catch (e) {
        /* 拿不到就只靠下面的消息 */
      }
      postToStreet({ type: "amayadori:go" });
    }
    if (pendingSceneRef.current) postToStreet(pendingSceneRef.current);
    if (walkRef.current) postToStreet({ type: "amayadori:openDoor" });
  }, [postToStreet]);

  const onIframeLoad = useCallback(() => {
    if (pendingSceneRef.current) postToStreet(pendingSceneRef.current);
  }, [postToStreet]);

  // 一句话 → /api/night/scene → 今夜参数整份发给街景（货架、店员、字幕也在里面）
  const generate = useCallback(
    async (prompt) => {
      unlockAudio();
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
        setPromptOpen(false);
        setWalking(false);
        walkRef.current = false;
        setView("street");
      } catch (e) {
        setError("今晚的雨没有落下来，再试一次。");
      } finally {
        setLoading(false);
      }
    },
    [postToStreet, unlockAudio],
  );

  // 街景里的进度：推门进店 / 回到街上
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return; // 只信自家 iframe
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "amayadori:boot") {
        bootRef.current = true;
        resync();
      } else if (d.type === "amayadori:ready") {
        bootRef.current = true;
        readyRef.current = true;
        setReady(true);
        resync();
      } else if (d.type === "amayadori:door") {
        walkRef.current = false;
        setView("inside");
        setPromptOpen(false);
      } else if (d.type === "amayadori:street") {
        walkRef.current = false;
        setView((v) => (v === "inside" ? "street" : v));
        setVisit((n) => n + 1);
        setWalking(false);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resync]);

  // 往店里走：街景自己走到门口、推门进去（开场视频还没放完就等它放完）
  const walkIn = useCallback(() => {
    unlockAudio();
    setWalking(true);
    walkRef.current = true;
    postToStreet({ type: "amayadori:openDoor" });
  }, [postToStreet, unlockAudio]);

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
        src="amayadori.html?embed&hold"
        title="雨宿り"
        onLoad={onIframeLoad}
        allow="autoplay"
      />

      <header className="brand-corner">{BRAND.displayName}</header>

      {/* 街上：这句话 + 今夜字幕 + 「往店里走」；左下角可以换个夜晚 */}
      {view === "street" && nightScene && !promptOpen && (
        <>
          <div className="line-quote">{line}</div>
          <Subtitle key={`street-${visit}-${nightScene.sceneTag}`} text={nightScene.sceneTag} />
          {!walking && (
            <button type="button" className="enter-cta" key={`cta-${visit}-${nightScene.sceneTag}`} onClick={walkIn}>
              往店里走 →
            </button>
          )}
        </>
      )}
      {view === "street" && nightScene && (
        <button type="button" className="reopen-btn" onClick={() => setPromptOpen((v) => !v)}>
          {promptOpen ? "收起" : "✎ 换个夜晚"}
        </button>
      )}

      {/* 输入框：点过「点一下」之后才出；开场和街上（可收起）；进店后不显示 */}
      {started && view !== "inside" && (
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

      {ready && !started && !rotateOn && <StartGate onStart={startScene} />}
      {rotateOn && <RotateHint onDismiss={skipRotate} />}
    </div>
  );
}
