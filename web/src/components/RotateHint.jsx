import React from "react";

// 手机竖着拿的时候盖在最上面，请用户横过来。转过来就自动消失；也可以点按钮就这样竖着看。
const IN_APP = typeof navigator !== "undefined" && /MicroMessenger|xhsdiscover|XiaoHongShu/i.test(navigator.userAgent);

export default function RotateHint({ onDismiss }) {
  return (
    <div className="rotate" role="dialog" aria-modal="true" aria-labelledby="rotate-title">
      <div className="rotate-inner">
        <div className="rotate-phone" aria-hidden="true">
          <span />
        </div>
        <h2 id="rotate-title" className="rotate-title">
          把手机横过来
        </h2>
        <p className="rotate-text">
          这条街是横着画的，
          <br />
          横过来，才看得见整场雨。
        </p>
        <p className="rotate-note">
          转了没反应？先关掉手机的方向锁定。
          {IN_APP && (
            <>
              <br />
              在 App 里转不过来，可以点右上角 ··· 用浏览器打开。
            </>
          )}
        </p>
        <button type="button" className="rotate-skip" onClick={onDismiss}>
          就这样竖着看
        </button>
      </div>
    </div>
  );
}
