import {
  ConnectWallet,
  useAddress,
  useContract,
  useContractRead,
  Web3Button,
} from "@thirdweb-dev/react";
import { useEffect, useState } from "react";
import "./App.css";

// ================= 🛠️ 設定區 (請修改這裡) =================
// 1. 您的 Vote 合約地址 (不是 Token 地址喔！)
const VOTE_CONTRACT_ADDRESS = "0x015b294F6C66D480f7B57085526e73Ed888295dD";

// 2. 提案 ID (第一題通常是 0)
const PROPOSAL_ID = "0";
// ========================================================
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const numberFormatter = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 2,
});

const parseVotes = (value) => {
  if (!value) return 0;
  const asString =
    typeof value === "object" && value?.toString ? value.toString() : value;
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber / 1e18 : 0;
};

const shorten = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";

const formatProposalId = (value) => {
  if (!value) return "—";
  const str = value.toString();
  return str.length > 14 ? `${str.slice(0, 8)}…${str.slice(-4)}` : str;
};

export default function App() {
  const [hasVoted, setHasVoted] = useState(false);
  const [txNotice, setTxNotice] = useState({ type: "idle", message: "" });
  const [selectedProposalId, setSelectedProposalId] = useState(PROPOSAL_ID);
  const [hasDelegated, setHasDelegated] = useState(false);
  const address = useAddress();
  const { contract } = useContract(VOTE_CONTRACT_ADDRESS);
  const {
    data: proposals,
    isLoading: isLoadingProposals,
    error: proposalsError,
  } = useContractRead(contract, "getAllProposals", []);
  const {
    data: voteCounts,
    isLoading: isLoadingVotes,
    refetch: refetchVotes,
  } = useContractRead(contract, "proposalVotes", [selectedProposalId]);
  const { data: proposalMeta } = useContractRead(
    contract,
    "proposals",
    [selectedProposalId],
  );
  const { data: snapshotBlock } = useContractRead(
    contract,
    "proposalSnapshot",
    [selectedProposalId],
  );
  const { data: tokenAddress } = useContractRead(contract, "token", []);
  const { contract: tokenContract } = useContract(
    tokenAddress?.toString() || undefined,
  );
  const {
    data: votingPower,
    isLoading: isLoadingVotingPower,
    refetch: refetchVotingPower,
  } = useContractRead(tokenContract, "getVotes", [
    address || ZERO_ADDRESS,
    snapshotBlock || proposalMeta?.startBlock || 0,
  ]);
  const { data: tokenBalance, isLoading: isLoadingBalance } = useContractRead(
    tokenContract,
    "balanceOf",
    [address || ZERO_ADDRESS],
  );

  useEffect(() => {
    if (proposals?.length) {
      const sorted = [...proposals].sort(
        (a, b) => Number(b.proposalId) - Number(a.proposalId),
      );
      const latestId = sorted[0]?.proposalId?.toString();
      if (latestId && latestId !== selectedProposalId) {
        setSelectedProposalId(latestId);
        setHasVoted(false);
        setTxNotice({ type: "idle", message: "" });
      }
    }
  }, [proposals, selectedProposalId]);

  const yesValue = parseVotes(voteCounts?.forVotes);
  const noValue = parseVotes(voteCounts?.againstVotes);
  const abstainValue = parseVotes(voteCounts?.abstainVotes);

  useEffect(() => {
    if (parseVotes(votingPower) > 0) {
      setHasDelegated(true);
    }
  }, [votingPower]);

  const currentProposal =
    proposals?.find(
      (item) =>
        item?.proposalId?.toString() === selectedProposalId?.toString(),
    ) || proposals?.[0];

  const stats = [
    { key: "yes", label: "贊成 Yes", value: yesValue },
    { key: "no", label: "反對 No", value: noValue },
    { key: "abstain", label: "棄權 Abstain", value: abstainValue },
  ];
  const totalVotes = stats.reduce((sum, item) => sum + item.value, 0);

  const refreshVotes = () => {
    refetchVotes?.();
    setTimeout(() => refetchVotes?.(), 1800);
  };

  const handleVoteSuccess = (label) => {
    setHasVoted(true);
    setTxNotice({ type: "success", message: `投票成功：${label}` });
    refreshVotes();
  };

  const handleVoteError = (error) => {
    const message =
      error?.reason ||
      error?.data?.message ||
      error?.message ||
      "交易失敗，請稍後再試";
    setTxNotice({ type: "error", message });
  };

  const proposalTitle =
    proposalMeta?.description ||
    currentProposal?.description ||
    "尚無提案，請先建立提案";
  const displayProposalId = formatProposalId(selectedProposalId);
  const readyToVote = Boolean(currentProposal && selectedProposalId);
  const isVotingDisabled = !readyToVote || hasVoted;
  const hasVotingPower =
    votingPower && Number(parseVotes(votingPower)) > 0 && address;
  const hasTokens =
    tokenBalance && Number(parseVotes(tokenBalance)) > 0 && address;

  return (
    <div className="app-shell">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <div className="container">
        <header className="top-bar">
          <div className="brand">
            <div className="brand-mark">DAO</div>
            <div>
              <p className="eyebrow">
                鏈上治理 · Proposal #{displayProposalId}
              </p>
              <h1>PEPE DAO</h1>
            </div>
          </div>
          <div className="wallet-stack">
            <span className="chip">Sepolia</span>
            <div className="wallet-cta">
              <ConnectWallet
                theme="light"
                modalSize="compact"
                btnTitle={address ? "已連接" : "連接錢包"}
              />
            </div>
          </div>
        </header>

        <main className="grid">
          <section className="panel spotlight">
            <div className="panel-head">
              <div>
                <p className="eyebrow">本次提案</p>
                <h2>{proposalTitle}</h2>
              </div>
              <div className="chip ghost">
                {address ? `已連接 ${shorten(address)}` : "請連接錢包以參與"}
              </div>
            </div>
            {txNotice.type !== "idle" && (
              <div className={`status-banner ${txNotice.type}`}>
                {txNotice.message}
              </div>
            )}
            <div className="delegate-box">
              <div>
                <p className="eyebrow">投票權</p>
                <p className="hint">
                  要先 delegate 給自己，錢包持有的代幣才會轉成可用的 Voting
                  Power。
                </p>
              </div>
              <Web3Button
                contractAddress={tokenAddress?.toString() || ""}
                action={(contract) => contract.call("delegate", [address])}
                onSuccess={() => {
                  setTxNotice({
                    type: "success",
                    message: "已將投票權委託給自己",
                  });
                  refetchVotingPower?.();
                  setHasDelegated(true);
                }}
                onError={handleVoteError}
                isDisabled={!address || !tokenAddress || hasDelegated}
                className="delegate-btn"
              >
                Delegate
              </Web3Button>
            </div>
            {address && !isLoadingBalance && !hasTokens && (
              <div className="status-banner warning">
                您尚未持有治理代幣，請先取得代幣再 delegate。
              </div>
            )}
            {address &&
              !isLoadingVotingPower &&
              hasTokens &&
              !hasVotingPower && (
              <div className="status-banner warning">
                您尚未擁有投票權，請先 delegate。
              </div>
            )}
            <p className="lede">
              體驗 web3 投票，所有票數直接寫入區塊鏈。選擇立場並在錢包中確認
              transaction，您的選擇將即時同步。
            </p>

            <div className="vote-actions">
              <Web3Button
                contractAddress={VOTE_CONTRACT_ADDRESS}
                action={(contract) => {
                  if (!readyToVote) throw new Error("尚未載入提案");
                  return contract.call("castVote", [selectedProposalId, 1]);
                }}
                onSuccess={() => handleVoteSuccess("贊成")}
                onError={handleVoteError}
                className="vote-btn yes"
                isDisabled={isVotingDisabled}
              >
                贊成 Yes
              </Web3Button>

              <Web3Button
                contractAddress={VOTE_CONTRACT_ADDRESS}
                action={(contract) => {
                  if (!readyToVote) throw new Error("尚未載入提案");
                  return contract.call("castVote", [selectedProposalId, 0]);
                }}
                onSuccess={() => handleVoteSuccess("反對")}
                onError={handleVoteError}
                className="vote-btn no"
                isDisabled={isVotingDisabled}
              >
                反對 No
              </Web3Button>

              <Web3Button
                contractAddress={VOTE_CONTRACT_ADDRESS}
                action={(contract) => {
                  if (!readyToVote) throw new Error("尚未載入提案");
                  return contract.call("castVote", [selectedProposalId, 2]);
                }}
                onSuccess={() => handleVoteSuccess("棄權")}
                onError={handleVoteError}
                className="vote-btn neutral"
                isDisabled={isVotingDisabled}
              >
                棄權 Abstain
              </Web3Button>
            </div>

            <p className="hint">
              送出後請在錢包確認交易；鏈上確認可能需要幾秒鐘，請勿重複點擊。
            </p>
          </section>

          <section className="panel stats-card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">即時結果</p>
                <h3>鏈上票數</h3>
              </div>
              <div className="chip soft">Live</div>
            </div>

            {proposalsError ? (
              <div className="status-banner error">
                無法載入提案：{proposalsError?.message || "未知錯誤"}
              </div>
            ) : isLoadingProposals ? (
              <div className="skeleton">正在載入提案...</div>
            ) : !proposals?.length ? (
              <div className="locked">
                <p className="locked-title">尚未有提案</p>
                <p className="locked-body">
                  請先在合約上建立提案；或確認您填入的合約地址正確。
                </p>
              </div>
            ) : !hasVoted ? (
              <div className="locked">
                <p className="locked-title">請先完成投票</p>
                <p className="locked-body">
                  提交任一選項後解鎖結果，我們會自動同步鏈上最新票數。
                </p>
              </div>
            ) : isLoadingVotes ? (
              <div className="skeleton">正在鏈上抓取提案...</div>
            ) : (
              <div className="vote-stats">
                {stats.map((stat) => {
                  const percent =
                    totalVotes > 0
                      ? Math.round((stat.value / totalVotes) * 100)
                      : 0;
                  const progressWidth = Math.min(percent, 100);
                  return (
                    <div key={stat.key} className={`stat-row ${stat.key}`}>
                      <div className="stat-label">
                        <span className="dot" />
                        <span>{stat.label}</span>
                      </div>
                      <div className="stat-values">
                        <span className="number">
                          {numberFormatter.format(stat.value)} 票
                        </span>
                        <span className="percent">{percent}%</span>
                      </div>
                      <div className="progress">
                        <div
                          className="progress-bar"
                          style={{
                            width:
                              totalVotes === 0 ? "0%" : `${progressWidth}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="footer-meta">
              <div className="meta-row">
                <span className="muted">Vote Contract</span>
                <span className="code">{shorten(VOTE_CONTRACT_ADDRESS)}</span>
              </div>
              <div className="meta-row">
                <span className="muted">Proposal ID</span>
                <span className="code">#{displayProposalId}</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
