<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/preview-dark.png">
  <img src=".github/assets/preview.png" alt="open-design-frame — 用元件寫設計稿。" width="100%">
</picture>

# open-design-frame

[![CI](https://github.com/simonliu-ai-product/open-design-frame/actions/workflows/ci.yml/badge.svg)](https://github.com/simonliu-ai-product/open-design-frame/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@open-design-frame/core?style=flat)](https://www.npmjs.com/package/@open-design-frame/core)
[![GitHub stars](https://img.shields.io/github/stars/simonliu-ai-product/open-design-frame?style=flat)](https://github.com/simonliu-ai-product/open-design-frame/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)](https://opensource.org/licenses/MIT)

[English](README.md) · **繁體中文**

**用元件寫設計稿。** 一張 frame 就是一塊固定尺寸的畫板——桌機畫面、手機畫面、一張海報。你的 agent 用 TSX 寫它，畫布以實際尺寸畫出來，而檢視器直接改寫你寫的那個檔案。

這是同一個家族的第三個：[open-doc](https://github.com/simonliu-ai-product/open-doc) 做文件、[open-slide](https://github.com/1weiho/open-slide) 做簡報。文件是一疊 A4、簡報是 16:9 畫布——設計沒有固定媒材，所以**尺寸跟著 frame 走**。

```bash
pnpm add -D @open-design-frame/core
```

<video src="https://github.com/simonliu-ai-product/open-design-frame/raw/main/media/intro.mp4" controls muted playsinline width="100%"></video>

<sub>三十秒，沒有一格是演的：agent 經 MCP 建立一張 frame、畫布改寫自己的原始碼、播放器依 frame 自己宣告的連結走。播不出來的話可以<a href="media/intro.mp4">直接下載</a>。</sub>

## 為什麼

設計工具把設計和程式碼放在兩個地方，然後兩邊就開始走鐘。把 Figma 檔丟給 agent 也沒用——它打不開。open-design-frame 讓設計本身就是一個 React 元件：agent 寫得出來、git 看得懂差異、畫布上看到的就是會出貨的東西，因為那**就是**會出貨的東西。

## 特色

### 🖼️ 一張 frame 就是一個元件，以實際尺寸呈現

`frames/<id>/index.tsx` 預設匯出一個 frame 陣列，每一張自己帶尺寸——`SIZES.DESKTOP`（1440 × 1024）、`LAPTOP`、`TABLET`、`PHONE`、`SQUARE`，或任何 `{ width, height }`。畫布縮放的是容器、不是內容，所以 16px 的字在任何縮放比例下都還是 16px。首頁封面、側邊縮圖與畫布是同一個 renderer 的三種比例——「縮圖跟打開後長得不一樣」這種狀態不存在。

### 🖱️ 點畫布，原始碼就跟著改

<img src=".github/assets/canvas.png" alt="點畫布上的元素，檢視器填入瀏覽器實際解析出的值，按 Save 寫回 TSX。" width="100%">

<sub>點畫布上的元素，檢視器填入瀏覽器實際解析出的值；按 Save 寫回 TSX。</sub>

任何東西都能點——不限於你包了 `<Layer>` 的部分。改動會**立刻**套用到畫布上並進入暫存，按 Save 才寫回 frame 自己的原始碼。用共用常數當樣式的元素會被明確拒絕並說明原因——改那個常數會把其他用到它的地方一起改掉。

### ▶️ 像網站一樣播放

<img src=".github/assets/play.png" alt="播放模式：frame 放在模擬瀏覽器裡，依 frame 自己宣告的連結走。" width="100%">

<sub>播放模式：frame 放在模擬瀏覽器裡，依 frame 自己宣告的連結走。</sub>

`<Layer to="Transactions · Desktop">` 宣告按下去會到哪裡。播放模式把 frame 放進模擬的瀏覽器——或依 frame 寬度改成手機——只跟隨這些連結。按到沒有連結的地方會把所有熱點閃一下，而不是把那一下吞掉。

### 🎨 主題帶著一份 DESIGN.md

<img src=".github/assets/theme.png" alt="主題規格表：色階、字體樣張與元件，每一筆都由該主題自己的 token 生成。" width="100%">

<sub>主題規格表——色階、字體樣張與元件，每一筆都由該主題自己的 token 生成。</sub>

<img src=".github/assets/design-md.png" alt="主題的 DESIGN.md 與 token 並排呈現，附一顆複製 markdown 的按鈕。" width="100%">

<sub>主題的 DESIGN.md 與 token 並排呈現，附一顆把 markdown 複製給 agent 的按鈕。</sub>

一個主題是 `themes/<id>` 裡的 `DesignSystem`，它的 token 會變成 `--odf-*` 變數。旁邊放一份 [`DESIGN.md`](https://www.thisweb.dev/articles/design-md)：氛圍、間距、元件規則、該做與不該做，以及可以直接交給 agent 的提示語——那是 token 裝不下的另一半。它是**打包進 build** 的，不是跟伺服器要的：一份出貨後沒人讀得到的設計系統不算設計系統。

### 💬 註解寫在原始碼裡

在選取的元素上留一則註記，它會以 JSX 註解的形式寫進 frame 自己的檔案，就在它所講的那段標記旁邊。重新整理還在、跟著 commit 走、元素被刪掉時一起消失——而不是留下一行指著早就變成別的東西的位置。

### 📦 一個 zip，每種格式一個資料夾

匯出產生單一 zip，每種格式各自一個資料夾：可以獨立打開的 HTML（標記加 token，不必附 CSS）、1×/2×/3× 的 PNG、SVG。每一張 frame 都在離屏舞台上以自己的尺寸重畫，所以你當下的縮放比例永遠不會跑進檔案裡。

### 🔌 MCP server，任何 agent 框架都能驅動

`open-design-frame dev --mcp` 會在畫布旁掛上 MCP 端點——25 個工具，涵蓋 frame、單一元素、註解、資料夾、主題、設計文件與素材。它是無狀態的 Streamable HTTP，客戶端直接指向 `http://localhost:5274/mcp` 即可，不需要握手。

這些工具和瀏覽器共用同一份實作，所以 `write_frame` 會帶著你上次讀到的 revision，遇到過期的寫入回 `409`，而不是把別人的修改蓋掉。詳見 [packages/mcp](packages/mcp)。

### 🗂️ 一個工作區，不是一份檔案清單

<img src=".github/assets/workspace.png" alt="每個 frame 檔案是一張卡片，旁邊是資料夾、搜尋，以及主題與素材。" width="100%">

<sub>每個 frame 檔案是一張卡片，旁邊是資料夾、搜尋，以及主題與素材。</sub>

資料夾是標籤、不是目錄——換資料夾不搬任何檔案，因為目錄名就是 id，而 id 在網址裡。素材有兩個範圍（`frames/<id>/assets/` 與專案自己的），清單會標出哪些 frame 有提到這個檔案，所以沒人用的一眼就看得出來。

### 🚀 好部署

`open-design-frame build` 產出純靜態網站——Vercel、Cloudflare Pages、Netlify 或任何靜態主機都可以。

## 開始

```bash
pnpm add -D @open-design-frame/core
open-design-frame dev
```

打開 http://localhost:5274。之後可以交給你的 agent 驅動，或直接編輯 `frames/<id>/index.tsx`。

| 指令 | 做什麼 |
| --- | --- |
| `open-design-frame dev` | 帶熱重載的畫布（`--mcp` 掛上 MCP 端點、`--port`、`--host`） |
| `open-design-frame build` | 靜態網站輸出到 `dist/`（`--out-dir` 可改） |

## 檔案契約

```tsx
// frames/welcome/index.tsx
import { type Frame, type FrameMeta, Layer, SIZES } from '@open-design-frame/core';
import aurora from '../../themes/aurora';

export const meta: FrameMeta = { title: 'Welcome' };
export const design = aurora;

const Welcome: Frame = () => (
  <Layer name="Hero" style={{ padding: 72 }}>
    <Layer name="Headline" kind="text" as="span" style={{ fontSize: 'var(--odf-size-hero)' }}>
      Start where the warmth is.
    </Layer>
  </Layer>
);

Welcome.frameName = 'Welcome · Desktop';
Welcome.size = SIZES.DESKTOP;

export default [Welcome];
```

`size` 跟著 frame 走，`design` 提供 token。`<Layer name="…">` 決定哪些部分會出現在檢視器的圖層樹裡——沒包起來的標記照樣會畫出來，只是不能被選取。

## 專案結構

pnpm + Turbo monorepo。

| 路徑 | 說明 |
| --- | --- |
| [packages/core](packages/core) | `@open-design-frame/core` — runtime（畫布、縮圖列、檢視器、播放器、匯出、主題、素材）、Vite plugins，以及 `open-design-frame` dev/build CLI。 |
| [packages/mcp](packages/mcp) | `@open-design-frame/mcp` — Streamable HTTP 的 MCP server。選用；`open-design-frame dev --mcp` 會掛在 `/mcp`。 |
| [apps/demo](apps/demo) | 以 `workspace:*` 使用 `@open-design-frame/core` 的示範工作區，自用驗證對象。 |
| [media](media) | 那支 intro 影片，以及對著執行中的 dev server 錄製它的腳本。 |

## 開發

```bash
pnpm install
pnpm dev        # 用本地的 @open-design-frame/core 跑 demo
pnpm build      # 建置所有套件
pnpm typecheck  # 跨整個相依圖跑 tsc
pnpm check      # biome（格式 + lint + 整理 import）
pnpm test       # vitest
```

CI 除了跑上面這些，還會**從打包後的 tarball 建一張 frame**——viewer 是以原始碼出貨的，重要的是發佈出去的套件能不能用，而不是這個 monorepo 能不能用。

## 參與

歡迎回報問題、提出需求與 pull request。送出之前請先跑過 `pnpm check`、`pnpm typecheck` 與 `pnpm test`；如果動到會出貨的部分，也請確認打包後的建置——那就是 CI 裡叫 `packaged` 的那個 job。

## 致謝

架構——虛擬模組的探索機制、dev server 與 MCP 端點共用的 `ops` 層、以原始碼出貨的 viewer——延續 [open-doc](https://github.com/simonliu-ai-product/open-doc) 與 [@1weiho](https://github.com/1weiho) 的 [open-slide](https://github.com/1weiho/open-slide)。

## 授權

MIT
