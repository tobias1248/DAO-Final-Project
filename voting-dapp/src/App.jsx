import {
  ConnectWallet,
  useAddress,
  useContract,
  useContractRead,
  Web3Button,
} from "@thirdweb-dev/react";
import { useEffect, useState } from "react";
import "./App.css";

const VOTE_CONTRACT_ADDRESS = "0x015b294F6C66D480f7B57085526e73Ed888295dD";
const PROPOSAL_ID = "0";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// 用於格式化數字顯示的工具
const numberFormatter = new Intl.NumberFormat("zh-TW", {
  maximumFractionDigits: 2,
});

// Solidity 中的 uint256 數值通常以 1e18 為單位進行表示，以下函式將其轉換為較易讀的數字格式
const parseVotes = (value) => {
  if (!value) return 0;
  const asString =
    typeof value === "object" && value?.toString ? value.toString() : value;
  const asNumber = Number(asString);
  return Number.isFinite(asNumber) ? asNumber / 1e18 : 0;
};

// 將地址縮短顯示，例如 0x123456...abcd
const shorten = (value) =>
  value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";

// 將提案 ID 縮短顯示，過長時中間以省略號取代
const formatProposalId = (value) => {
  if (!value) return "—";
  const str = value.toString();
  return str.length > 14 ? `${str.slice(0, 8)}…${str.slice(-4)}` : str;
};

// 將輸入值轉換為數字，無法轉換時回傳 undefined
const toNumber = (value) => {
  if (value === undefined || value === null) return undefined;
  const raw =
    typeof value === "object" && value?.toString ? value.toString() : value;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
};

// 正規化提案狀態的表示方式
const normalizeState = (state) => {
  if (state === undefined || state === null) return "unknown";
  const str = state.toString().toLowerCase();
  if (str === "1" || str === "active") return "active";
  if (str === "0" || str === "pending") return "pending";
  return str;
};

// Governor/Vote 合約中 state = 1 代表 Active；若合約未回傳 state，預設視為可能有效以避免漏顯示
const isProposalActive = (proposal, externalState) => {
  const stateValue = externalState ?? proposal?.state ?? proposal?.status;
  const normalized = normalizeState(stateValue);
  if (normalized === "unknown") return true;
  return normalized === "active";
};

export default function App() {
  const [hasVoted, setHasVoted] = useState(false);
  const [txNotice, setTxNotice] = useState({ type: "idle", message: "" });
  const [selectedProposalId, setSelectedProposalId] = useState(PROPOSAL_ID);
  const [hasDelegated, setHasDelegated] = useState(false);
  const [proposalStates, setProposalStates] = useState({});
  const address = useAddress();
  const { contract } = useContract(VOTE_CONTRACT_ADDRESS);
  const {
    data: proposals,
    isLoading: isLoadingProposals,
    error: proposalsError,
    refetch: refetchProposals,
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
  const { data: delegatee, isLoading: isLoadingDelegate } = useContractRead(
    tokenContract,
    "delegates",
    [address || ZERO_ADDRESS],
  );

  // 每 15 秒重新抓取提案列表，避免漏掉新建立的提案
  useEffect(() => {
    if (!refetchProposals) return undefined;
    // 啟動輪詢
    const interval = setInterval(() => {
      refetchProposals();
    }, 15000);
    // 離開元件時停止輪詢
    return () => clearInterval(interval);
  }, [refetchProposals]);

  // 取得所有提案後，自動鎖定最新的 Active 提案並重置投票狀態
  useEffect(() => {
    if (!proposals?.length) return;
    // 篩出 Active 並由大到小排序 ID
    const sortedActive = proposals
      .filter((proposal) =>
        isProposalActive(
          proposal,
          proposalStates[proposal?.proposalId?.toString?.() || ""],
        ),
      )
      .sort(
        (a, b) =>
          (toNumber(b?.proposalId) || 0) - (toNumber(a?.proposalId) || 0),
      );
    // 取最新 ID，若不同則更新選取並重置提示/投票狀態
    const latestId = sortedActive[0]?.proposalId?.toString();
    if (latestId && latestId !== selectedProposalId) {
      setSelectedProposalId(latestId);
      setHasVoted(false);
      setTxNotice({ type: "idle", message: "" });
    }
  }, [proposals, proposalStates, selectedProposalId]);

  const yesValue = parseVotes(voteCounts?.forVotes);
  const noValue = parseVotes(voteCounts?.againstVotes);
  const abstainValue = parseVotes(voteCounts?.abstainVotes);

  // 檢查當前地址是否已具備投票權（有權重或已委託）
  useEffect(() => {
    if (parseVotes(votingPower) > 0) {
      // 有票重即視為已委託
      setHasDelegated(true);
    } else {
      const delegatedTo =
        delegatee?.toString && delegatee.toString().toLowerCase();
      const hasDelegate =
        delegatedTo && delegatedTo !== ZERO_ADDRESS.toLowerCase();
      // 沒票重時，判斷是否至少委託過非零地址
      setHasDelegated(Boolean(hasDelegate));
    }
  }, [votingPower, delegatee, address]);

  // 定期向鏈上呼叫 state(proposalId)，同步每個提案的最新狀態
  useEffect(() => {
    if (!contract || !proposals?.length) return undefined;
    let cancelled = false;
    const fetchStates = async () => {
      try {
        // 逐一查詢每個提案的 state 值
        const entries = await Promise.all(
          proposals.map(async (p) => {
            const idStr = p?.proposalId?.toString?.();
            if (!idStr) return null;
            try {
              const stateValue = await contract.call("state", [p.proposalId]);
              return [idStr, stateValue];
            } catch (err) {
              // 呼叫失敗時回退用原資料的 state/status
              return [idStr, p?.state ?? p?.status ?? "unknown"];
            }
          }),
        );
        if (cancelled) return;
        // 整理成 {proposalId: state} 形式後寫入
        const next = entries.reduce((acc, item) => {
          if (!item) return acc;
          const [id, stateValue] = item;
          acc[id] = stateValue;
          return acc;
        }, {});
        setProposalStates(next);
      } catch (err) {
        // 不影響主流程，僅記錄錯誤
        console.error("Failed to fetch proposal states", err);
      }
    };
    fetchStates();
    // 每 15 秒更新一次提案狀態
    const interval = setInterval(fetchStates, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [contract, proposals]);

  const activeProposals =
    proposals?.filter((proposal) =>
      isProposalActive(
        proposal,
        proposalStates[proposal?.proposalId?.toString?.() || ""],
      ),
    ) || [];
  const currentProposal =
    activeProposals.find(
      (item) =>
        item?.proposalId?.toString() === selectedProposalId?.toString(),
    ) || activeProposals[0];
  const hasActiveProposal = Boolean(currentProposal);

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
    (hasActiveProposal &&
      (proposalMeta?.description || currentProposal?.description)) ||
    "目前尚無提案";
  const displayProposalId = hasActiveProposal
    ? formatProposalId(selectedProposalId)
    : "—";
  const readyToVote = Boolean(hasActiveProposal && selectedProposalId);
  const isVotingDisabled = !readyToVote || hasVoted;
  const votingPowerValue = parseVotes(votingPower);
  const hasVotingPower = votingPower && Number(votingPowerValue) > 0 && address;
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
              !isLoadingDelegate &&
              !hasDelegated &&
              !hasVotingPower && (
              <div className="status-banner warning">
                您尚未擁有投票權，請先 delegate。
              </div>
            )}
            {hasActiveProposal ? (
              <>
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
              </>
            ) : (
              <div className="empty-proposal">
                <div className="chip ghost">待提案</div>
                <p className="empty-title">目前尚無提案</p>
                <p className="empty-body">
                  前端未偵測到 Active 狀態的提案。治理團隊提交新提案後，內容會自動出現在這裡。
                </p>
              </div>
            )}
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
            ) : !activeProposals?.length ? (
              <div className="locked">
                <p className="locked-title">目前尚無提案</p>
                <p className="locked-body">
                  尚未有 Active 提案，等待治理團隊提交後即可在此觀看票數。
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
