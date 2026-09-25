import React from "react";

// 开场前的一下：浏览器规定用户点过之后网页才能出声。点下去，雨声和开场视频一起开始。
export default function StartGate({ onStart }) {
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onStart();
    }
  };
  return (
    <div className="gate" role="button" tabIndex={0} aria-label="点一下，开始" onClick={onStart} onKeyDown={onKey} autoFocus>
      <div className="gate-inner">
        <p className="gate-line">点一下，雨就开始下</p>
        <p className="gate-sub">戴上耳机听，会更好</p>
      </div>
      <p className="gate-credit">日语语音 VOICEVOX:春日部つむぎ</p>
    </div>
  );
}
