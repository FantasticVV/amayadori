// 店名唯一真源。
// 任何地方需要店名（页面标题、角落标识、3D 灯箱贴图……）一律 import 本文件，
// 禁止在其他文件里复制「雨宿り / AMAYADORI」字面量。
export const BRAND = {
  /** 日文名 */
  nameJa: "雨宿り",
  /** 罗马音 */
  nameRomaji: "AMAYADORI",
  /** 展示用全名 */
  displayName: "雨宿り AMAYADORI",
  /** 输入框占位语 */
  placeholder: "今晚怎么样？",
} as const;
