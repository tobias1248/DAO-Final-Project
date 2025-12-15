# DAO Final Project – Voting DApp

Frontend: Vite + React + thirdweb SDK (default chain: Sepolia)  
Contracts: Vote/Governor contracts (addresses set via environment variables)

## Requirements
- Node.js 18+ and npm
- Deployed Vote/Governor contract address
- thirdweb Client ID

## Install
```
npm install
```

## Environment variables
Create `.env` in the project root:
- VITE_THIRDWEB_CLIENT_ID=<your_thirdweb_client_id>
- VITE_VOTE_CONTRACT_ADDRESS=<your_vote_contract_address>

(Add any extra variables as needed.)

## Development
```
npm run dev
```

## Production build
```
npm run build
npm run preview   # optional preview of the build output
```

## Notes
- Sepolia is the default chain; change `activeChain` in code if needed.
- If the wallet lacks governance tokens or delegation, the UI will prompt to acquire tokens and delegate before voting.
- Do not hardcode Client ID/contract addresses; keep them in `.env` and ensure `.gitignore` excludes it.
