import React, { useEffect, useState } from "react";

// sceneTag 今夜字幕：淡入后一直留在街上（和「往店里走」一起，是对这个人说的那句话）。
// 每次生成新场景、回到街上都重新淡入一遍。
export default function Subtitle({ text }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    setShown(false);
    const t = setTimeout(() => setShown(true), 200);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <div className={`subtitle${shown ? " subtitle--on" : ""}`} aria-live="polite">
      {text}
    </div>
  );
}
