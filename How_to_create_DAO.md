# How to Create Your Own DAO with thirdweb SDK

- **Prerequisites**
  - Install Node.js 18+ and npm.
  - Prepare a wallet with test ETH (e.g., Sepolia) for gas.
  - (Optional) Install Git and VS Code for version control and editing.

- **Install the thirdweb CLI (one-time)**
  - ```
    npm install -g thirdweb
    ```
  - If you prefer not to install globally, you can swap any `thirdweb` command below with `npx thirdweb`.

- **Scaffold a contract project**
  - From an empty folder, run:
    ```
    thirdweb create contract
    ```
  - Choose your framework (Hardhat/Forge), TypeScript or JavaScript, and name the project (e.g., `class-dao-vote`).
  - After creation:
    ```
    cd class-dao-vote
    npm install
    ```

- **Add core DAO contracts**
  - Install contract helpers:
    ```
    npm install @thirdweb-dev/contracts
    ```
  - Create a governance token that supports delegation (ERC20Votes) and a Governor contract. Example structure (simplified):
    ```solidity
    // contracts/GovToken.sol
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;
    import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
    contract GovToken is ERC20Votes {
        constructor() ERC20("GovToken", "GVT") ERC20Permit("GovToken") {
            _mint(msg.sender, 1_000_000 ether);
        }
        function _update(address from, address to, uint256 amount)
            internal override(ERC20, ERC20Votes) { super._update(from, to, amount); }
        function nonces(address owner)
            public view override(ERC20Permit, Nonces) returns (uint256) { return super.nonces(owner); }
    }
    ```
    ```solidity
    // contracts/GovernorDAO.sol
    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;
    import "@thirdweb-dev/contracts/extension/Governor.sol";
    contract GovernorDAO is Governor {
        constructor(address token) Governor(token) {}
    }
    ```
  - Adjust names, supply, and governance parameters to fit your DAO.

- **Configure environment secrets**
  - Create `.env` in the project root:
    ```
    PRIVATE_KEY=<wallet_private_key_for_deployment>
    THIRDWEB_API_KEY=<your_thirdweb_api_key>
    ```
  - Keep `.env` in `.gitignore`.

- **Compile locally**
  - ```
    npm run build
    ```
  - Fix any compiler errors before deploying.

- **Deploy contracts with thirdweb**
  - Deploy the governance token:
    ```
    npm run deploy -- --network sepolia -k $THIRDWEB_API_KEY
    ```
  - Deploy the Governor contract (pass the token address to the constructor when prompted).
  - Record deployed addresses for the frontend.

- **Distribute and delegate voting power**
  - Transfer tokens to participants.
  - Each participant must delegate to themselves once to activate voting power:
    - Call `delegate(address)` on the token contract (can be done via thirdweb dashboard, script, or frontend).

- **Create proposals**
  - Use a script or thirdweb dashboard to call `propose(...)` on the Governor contract.
  - After the voting delay passes, accounts with delegated voting power can vote (`castVote` or `castVoteWithReason`).
  - After voting ends, queue and execute the proposal if it passes.

- **Hook up a frontend with thirdweb React**
  - Install frontend deps:
    ```
    npm install @thirdweb-dev/react @thirdweb-dev/sdk ethers
    ```
  - Wrap your app with `ThirdwebProvider` (set `activeChain` and `clientId`).
  - Use hooks/components: `useContract`, `useContractRead`, `useContractWrite`, `ConnectWallet`, `Web3Button` to list proposals, show votes, and trigger `castVote`.

- **Testing and verification**
  - Use Hardhat tests to cover proposal lifecycle (propose → vote → queue → execute).
  - Verify contract source (if desired) using `thirdweb verify` or the explorer for your network.

- **Operations checklist**
  - Rotate API keys and keep private keys secure.
  - Maintain sufficient token distribution and delegation before starting a vote.
  - Monitor events (`ProposalCreated`, `VoteCast`, `ProposalExecuted`) for off-chain indexing or notifications.
