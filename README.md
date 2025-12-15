# DAO Final Project – 投票 DApp

前端：Vite + React + thirdweb SDK（預設鏈：Sepolia）  
合約：使用 Vote/ Governor 相關合約（地址透過環境變數設定）

## 環境需求
- Node.js 18+、npm
- 已部署好的 Vote/Governor 合約地址
- thirdweb Client ID

## 安裝
npm install

## 設定環境變數
在專案根目錄新增 `.env`：
VITE_THIRDWEB_CLIENT_ID=<your_thirdweb_client_id>
VITE_VOTE_CONTRACT_ADDRESS=<your_vote_contract_address>

（如有其他自訂變數，照需求補充。）

## 開發模式
npm run dev
# 依照終端輸出開啟 http://localhost:5173

## 建置生產版
npm run build
npm run preview   # 可選，預覽產物

## 常見事項
- Sepolia 是預設鏈，如需更換請在程式中調整 `activeChain`。
- 沒有治理代幣或未 delegate 時，前端會提示請先取得代幣並 delegate 才能投票。
- Client ID/合約地址請勿硬編碼在程式碼裡，放在 `.env` 並保留 `.gitignore` 排除即可。
