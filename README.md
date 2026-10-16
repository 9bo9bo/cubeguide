# CubeGuide — ルービックキューブ解法ガイド

写真・Webカメラ・手動入力で現在のキューブ状態を取り込み、一手ずつ 3D アニメーションで回し方を案内する Web アプリです。

## 使い方

```bash
npm install
npm run dev
```

ブラウザで表示された URL を開きます。

1. **面を入力** — 展開図に直接塗るか、Webカメラ / 写真で各面を取り込み（白を上・緑を手前に持つ）
2. **色を確認** — 展開図上でステッカー色を修正。揃えられない配置（面の向き違いなど）はここで理由を表示
3. **解法** — 「次の一手」または自動再生でアニメーション手順を確認

デモとして「ランダムスクランブル」から試すこともできます。

## 技術

- Vite + React + TypeScript
- Three.js（3D キューブと回転アニメーション）
- cubejs（Kociemba two-phase ソルバー）

## Vercel へのデプロイ

スマホから開くには HTTPS が必要なので、Vercel への公開を推奨します。

```bash
npm i -g vercel
npx vercel login
npx vercel --prod
```

または [Vercel ダッシュボード](https://vercel.com/new) でこのリポジトリを Import しても同じです（Framework Preset: Vite、Output: `dist`）。

CLI からトークンでデプロイする場合:

```bash
npx vercel --prod --token "$VERCEL_TOKEN" --yes
```
