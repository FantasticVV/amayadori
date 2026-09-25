import React, { useEffect, useState } from "react";

// sceneTag 开场字幕：淡入 → 停留 → 淡出。每次生成新场景重新播一遍。
export default function Subtitle({ text }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const t1 = setTimeout(() => setShown(true), 200);
    const t2 = setTimeout(() => setShown(false), 5600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [text]);

  return (
    <div className={`subtitle${shown ? " subtitle--on" : ""}`} aria-live="polite">
      {text}
    </div>
  );
}
