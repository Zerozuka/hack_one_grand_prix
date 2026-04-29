const STORAGE_KEY = "knowledge-mesh-app-state-v1";
const AUTH_STORAGE_KEY = "knowledge-mesh-auth-session-v1";
const SEED_DATA_URL = "./data/demo-data.json";
const COURSES_DATA_URL = "./data/courses.json";
const svgNamespace = "http://www.w3.org/2000/svg";

const roleLabels = {
  core: "キーノード",
  new: "新規参加",
  bridge: "橋渡し候補",
  isolated: "孤立ノード",
};

const accountRoleLabels = {
  manager: "教員",
  member: "学生",
};

const recommendationModes = [
  {
    id: "bridge",
    title: "橋渡し重視",
    description: "別分野をまたぐ知見接続を優先",
  },
  {
    id: "complementary",
    title: "補完重視",
    description: "スキルが補い合う組み合わせを優先",
  },
  {
    id: "similar",
    title: "共通点重視",
    description: "専門や興味の近さを優先",
  },
];

const uiState = {
  data: null,
  seedData: null,
  courses: [],
  authSession: null,
  selectedCommunityId: null,
  selectedUserId: null,
  selectedCourseId: null,
  recommendationMode: recommendationModes[0].id,
  memberSearch: "",
  courseSearch: "",
  source: "json",
  sosList: [],
};

// D3 force graph state (module-level to persist across renderApp calls)
let _graphSim = null;
let _graphKey = null;

// SOS broadcast channel
let _sosBroadcast = null;

// Semantic synonym map for Japanese academic keywords
const SYNONYM_MAP = {
  "機械学習": ["ML", "深層学習", "ニューラルネット", "ニューラルネットワーク", "AI", "人工知能", "統計学習", "パターン認識"],
  "線形代数": ["ベクトル", "行列", "固有値", "固有ベクトル", "線形方程式", "行列式", "ベクトル空間"],
  "微分": ["解析", "微積分", "偏微分", "関数解析", "積分", "微分方程式"],
  "アルゴリズム": ["データ構造", "計算量", "グラフ理論", "探索", "ソート", "動的計画法"],
  "プログラミング": ["Python", "JavaScript", "C言語", "Java", "コーディング", "実装", "ソフトウェア"],
  "統計": ["確率", "データ分析", "回帰分析", "推定", "検定", "ベイズ", "確率論"],
  "物理": ["力学", "電磁気", "熱力学", "量子力学", "光学", "波動"],
  "数学": ["解析", "代数", "幾何学", "位相", "数論"],
  "情報工学": ["コンピュータ", "システム", "ネットワーク", "OS", "データベース", "セキュリティ"],
  "最適化": ["凸最適化", "勾配降下法", "線形計画", "数理計画"],
  "シミュレーション": ["数値計算", "モンテカルロ", "有限要素法"],
  "信号処理": ["フーリエ変換", "FFT", "フィルタ", "スペクトル"],
};

function expandKeywords(keywords) {
  const expanded = new Set(keywords.map(k => k.toLowerCase()));
  keywords.forEach(kw => {
    const lower = kw.toLowerCase();
    Object.entries(SYNONYM_MAP).forEach(([key, vals]) => {
      if (key.toLowerCase() === lower || vals.some(v => v.toLowerCase() === lower)) {
        expanded.add(key.toLowerCase());
        vals.forEach(v => expanded.add(v.toLowerCase()));
      }
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        expanded.add(key.toLowerCase());
      }
    });
  });
  return [...expanded];
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val ?? 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCommaSeparated(value) {
  return String(value ?? "")
    .split(/[,\u3001]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function mergeSeedAndSaved(seedData, savedData) {
  return {
    accounts: cloneData(seedData.accounts ?? []),
    communities: cloneData(savedData?.communities ?? seedData.communities ?? []),
    users: cloneData(savedData?.users ?? seedData.users ?? []),
    relationships: cloneData(savedData?.relationships ?? seedData.relationships ?? []),
    events: cloneData(savedData?.events ?? seedData.events ?? []),
  };
}

function persistData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uiState.data));
  uiState.source = "local";
  renderStorageBadge();
}

function persistAuthSession() {
  if (uiState.authSession?.accountId) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(uiState.authSession));
    return;
  }

  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function loadStoredAuthSession() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    uiState.authSession = null;
    return;
  }

  try {
    uiState.authSession = JSON.parse(raw);
  } catch (error) {
    uiState.authSession = null;
  }
}

function currentAccount() {
  if (!uiState.data || !uiState.authSession?.accountId) {
    return null;
  }

  return uiState.data.accounts.find((account) => account.id === uiState.authSession.accountId) ?? null;
}

function isAuthenticated() {
  return Boolean(currentAccount());
}

function isManager() {
  return currentAccount()?.role === "manager";
}

function isMember() {
  return currentAccount()?.role === "member";
}

function visibleCommunities() {
  if (!uiState.data) {
    return [];
  }

  const account = currentAccount();
  if (!account) {
    return uiState.data.communities;
  }

  if (!account.communityId) {
    return uiState.data.communities;
  }

  return uiState.data.communities.filter((community) => community.id === account.communityId);
}

function currentCommunity() {
  return uiState.data?.communities.find((community) => community.id === uiState.selectedCommunityId) ?? null;
}

function communityUsers(communityId = uiState.selectedCommunityId) {
  return (uiState.data?.users ?? []).filter((user) => user.communityId === communityId);
}

function communityRelationships(communityId = uiState.selectedCommunityId) {
  return (uiState.data?.relationships ?? []).filter((relationship) => relationship.communityId === communityId);
}

function communityEvents(communityId = uiState.selectedCommunityId) {
  return (uiState.data?.events ?? []).filter((event) => event.communityId === communityId);
}

function userById(userId) {
  return uiState.data?.users.find((user) => user.id === userId) ?? null;
}

function selectedUser() {
  return userById(uiState.selectedUserId);
}

function actorUser() {
  const account = currentAccount();
  if (account?.role === "member" && account.userId) {
    return userById(account.userId);
  }

  return selectedUser();
}

function normalizeSelection() {
  if (!uiState.data || uiState.data.communities.length === 0) {
    uiState.selectedCommunityId = null;
    uiState.selectedUserId = null;
    return;
  }

  const account = currentAccount();
  const availableCommunities = visibleCommunities();

  if (availableCommunities.length === 0) {
    uiState.selectedCommunityId = uiState.data.communities[0].id;
  } else if (!uiState.selectedCommunityId || !availableCommunities.some((community) => community.id === uiState.selectedCommunityId)) {
    uiState.selectedCommunityId = availableCommunities[0].id;
  }

  const users = communityUsers();

  if (users.length === 0) {
    uiState.selectedUserId = null;
    return;
  }

  if (isMember() && account?.userId) {
    const memberExists = users.some((user) => user.id === account.userId);
    if (!memberExists) {
      uiState.selectedUserId = users[0].id;
      return;
    }

    if (!uiState.selectedUserId || !users.some((user) => user.id === uiState.selectedUserId)) {
      uiState.selectedUserId = account.userId;
    }
    return;
  }

  if (isManager() && account?.userId && users.some((user) => user.id === account.userId) && !uiState.selectedUserId) {
    uiState.selectedUserId = account.userId;
    return;
  }

  if (!uiState.selectedUserId || !users.some((user) => user.id === uiState.selectedUserId)) {
    uiState.selectedUserId = users[0].id;
  }
}

async function loadSeedData(forceJson = false) {
  const response = await fetch(SEED_DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`seed data request failed: ${response.status}`);
  }

  const seedData = await response.json();
  uiState.seedData = seedData;

  if (!forceJson) {
    const savedRaw = localStorage.getItem(STORAGE_KEY);
    if (savedRaw) {
      try {
        const savedData = JSON.parse(savedRaw);
        uiState.data = mergeSeedAndSaved(seedData, savedData);
        uiState.source = "local";
        normalizeSelection();
        return;
      } catch (error) {
        uiState.data = mergeSeedAndSaved(seedData, null);
      }
    }
  }

  uiState.data = mergeSeedAndSaved(seedData, null);
  uiState.source = "json";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(uiState.data));
  normalizeSelection();
}

async function loadCourses() {
  try {
    const response = await fetch(COURSES_DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`courses data request failed: ${response.status}`);
    }
    uiState.courses = await response.json();
  } catch (error) {
    uiState.courses = [];
  }
}

function filteredCourses() {
  const query = uiState.courseSearch.trim().toLowerCase();
  if (!query) {
    return uiState.courses.slice(0, 30);
  }

  return uiState.courses.filter((course) => {
    const haystack = [
      course.course_title,
      course.instructor,
      course.contents,
      course.departments.join(" "),
      ...course.lecture_plan,
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  }).slice(0, 30);
}

function courseMatchingUsers(course) {
  const users = communityUsers();
  if (!course || !course.lecture_plan.length) {
    return [];
  }

  // Build expanded term set from course content (semantic routing)
  const rawCourseTerms = [
    course.course_title,
    course.contents ?? "",
    ...course.lecture_plan,
  ].join(" ").split(/[\s、。,・\-]+/).filter(t => t.length >= 2);

  const expandedCourseTerms = expandKeywords(rawCourseTerms);
  const courseTermSet = new Set(expandedCourseTerms);

  return users
    .map((user) => {
      const expandedInterests = expandKeywords(user.interests);
      const matchedInterests = user.interests.filter((interest) =>
        courseTermSet.has(interest.toLowerCase()) ||
        expandKeywords([interest]).some(exp => courseTermSet.has(exp))
      );

      const matchedGoals = user.goals.filter((goal) => {
        const keywords = goal.split(/[\s,、]+/).filter((w) => w.length >= 2);
        return expandKeywords(keywords).some((kw) => courseTermSet.has(kw));
      });

      // Semantic score: direct match weighted higher than synonym match
      const directInterests = user.interests.filter(i => {
        const planText = [course.course_title, course.contents ?? "", ...course.lecture_plan].join(" ").toLowerCase();
        return planText.includes(i.toLowerCase());
      });
      const semanticBonus = matchedInterests.length - directInterests.length;
      const score = directInterests.length * 4 + semanticBonus * 2 + matchedGoals.length * 2;

      return { user, matchedInterests, matchedGoals, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function renderMessage(targetId, message, tone = "info") {
  const target = document.getElementById(targetId);
  target.className = `${targetId === "authNotice" ? "auth-notice" : "app-notice"} ${tone}`;
  target.textContent = message;
}

function renderNotice(message, tone = "info") {
  renderMessage("appNotice", message, tone);
}

function renderAuthNotice(message, tone = "info") {
  renderMessage("authNotice", message, tone);
}

function renderStorageBadge() {
  const badge = document.getElementById("storageBadge");
  badge.textContent = uiState.source === "local" ? "localStorage 保存中" : "JSON シードデータ";
}

function neighborMap() {
  const map = new Map();
  communityUsers().forEach((user) => map.set(user.id, []));

  communityRelationships().forEach((relationship) => {
    if (map.has(relationship.fromUserId)) {
      map.get(relationship.fromUserId).push(relationship.toUserId);
    }
    if (map.has(relationship.toUserId)) {
      map.get(relationship.toUserId).push(relationship.fromUserId);
    }
  });

  return map;
}

function degreeOf(userId) {
  return neighborMap().get(userId)?.length ?? 0;
}

function relationshipExists(leftUserId, rightUserId) {
  return communityRelationships().some((relationship) => {
    return (
      (relationship.fromUserId === leftUserId && relationship.toUserId === rightUserId) ||
      (relationship.fromUserId === rightUserId && relationship.toUserId === leftUserId)
    );
  });
}

function userRelationships(userId) {
  return communityRelationships().filter((relationship) => {
    return relationship.fromUserId === userId || relationship.toUserId === userId;
  });
}

function intersection(leftItems, rightItems) {
  return leftItems.filter((item) => rightItems.includes(item));
}

function connectedClusters() {
  const users = communityUsers();
  const neighbors = neighborMap();
  const seen = new Set();
  const clusters = [];

  users.forEach((user) => {
    if (seen.has(user.id)) {
      return;
    }

    const queue = [user.id];
    const cluster = [];
    seen.add(user.id);

    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);

      neighbors.get(current).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }

    clusters.push(cluster);
  });

  return clusters;
}

function densityPercent() {
  const users = communityUsers();
  if (users.length <= 1) {
    return 0;
  }

  const allPossible = (users.length * (users.length - 1)) / 2;
  return Math.round((communityRelationships().length / allPossible) * 100);
}

function bridgePotential(user) {
  const others = communityUsers().filter((candidate) => candidate.id !== user.id);

  return others.reduce((score, candidate) => {
    if (relationshipExists(user.id, candidate.id)) {
      return score;
    }

    const crossGroup = user.group !== candidate.group ? 1 : 0;
    const commonInterests = intersection(user.interests, candidate.interests).length;
    const commonGoals = intersection(user.goals, candidate.goals).length;
    const roleBoost = user.role === "bridge" ? 2 : 0;

    return score + crossGroup * 4 + commonInterests * 2 + commonGoals * 2 + roleBoost;
  }, 0);
}

function communityLeads() {
  return [...communityUsers()]
    .map((user) => ({
      user,
      degree: degreeOf(user.id),
      bridgePotential: bridgePotential(user),
    }))
    .sort((left, right) => {
      if (right.degree !== left.degree) {
        return right.degree - left.degree;
      }
      return right.bridgePotential - left.bridgePotential;
    });
}

function recommendationScore(mode, baseUser, candidate) {
  const commonInterests = intersection(baseUser.interests, candidate.interests).length;
  const commonGoals = intersection(baseUser.goals, candidate.goals).length;
  const sharedAvailability = baseUser.availability === candidate.availability ? 1 : 0;
  const crossGroup = baseUser.group !== candidate.group ? 1 : 0;
  const isolationSupport = degreeOf(baseUser.id) <= 1 || degreeOf(candidate.id) <= 1 ? 1 : 0;
  const bridgeBoost = candidate.role === "bridge" ? 1 : 0;
  const roleComplement = baseUser.role !== candidate.role ? 1 : 0;

  // Semantic bonus: expanded keyword overlap even without exact match
  const baseExpanded = new Set(expandKeywords(baseUser.interests));
  const candidateExpanded = expandKeywords(candidate.interests);
  const semanticOverlap = candidateExpanded.filter(k => baseExpanded.has(k)).length;
  const semanticBonus = Math.min(semanticOverlap, 6);

  if (mode === "similar") {
    return commonInterests * 16 + commonGoals * 12 + sharedAvailability * 8 + isolationSupport * 4 + semanticBonus * 4;
  }

  if (mode === "complementary") {
    return crossGroup * 10 + roleComplement * 12 + commonGoals * 10 + commonInterests * 6 + bridgeBoost * 6;
  }

  return crossGroup * 16 + bridgeBoost * 10 + commonGoals * 8 + commonInterests * 6 + isolationSupport * 8 + semanticBonus * 2;
}

function recommendationReasons(baseUser, candidate) {
  const reasons = [];
  const commonInterests = intersection(baseUser.interests, candidate.interests);
  const commonGoals = intersection(baseUser.goals, candidate.goals);

  if (commonInterests.length > 0) {
    reasons.push(`共通の知見: ${commonInterests.slice(0, 2).join(" / ")}`);
  }
  if (commonGoals.length > 0) {
    reasons.push(`学びたい方向が近い: ${commonGoals.slice(0, 2).join(" / ")}`);
  }
  if (baseUser.group !== candidate.group) {
    reasons.push("別分野の知見を持っている");
  }
  if (baseUser.availability && baseUser.availability === candidate.availability) {
    reasons.push(`活動時間帯が近い: ${baseUser.availability}`);
  }
  if (degreeOf(baseUser.id) <= 1 || degreeOf(candidate.id) <= 1) {
    reasons.push("孤立ノード解消につながる");
  }

  return reasons.slice(0, 4);
}

function buildRecommendations() {
  const baseUser = actorUser();
  if (!baseUser) {
    return [];
  }

  return communityUsers()
    .filter((candidate) => candidate.id !== baseUser.id)
    .filter((candidate) => !relationshipExists(baseUser.id, candidate.id))
    .map((candidate) => ({
      user: candidate,
      score: recommendationScore(uiState.recommendationMode, baseUser, candidate),
      reasons: recommendationReasons(baseUser, candidate),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

function introductionIdeas() {
  const baseUser = actorUser();
  if (!baseUser) {
    return [];
  }

  return buildRecommendations().slice(0, 3).map((entry) => {
    const sameInterest = intersection(baseUser.interests, entry.user.interests);
    let format = "5分Sync";

    if (baseUser.group !== entry.user.group) {
      format = "分野横断ミニセッション";
    } else if (sameInterest.includes("線形代数") || sameInterest.includes("統計")) {
      format = "もくもく勉強会";
    } else if (sameInterest.length > 0) {
      format = "テーマ別ペアリング";
    }

    return {
      title: `${baseUser.name} × ${entry.user.name}`,
      format,
      body: entry.reasons[0] ?? "知見ネットワークを広げる入口になれる組み合わせです。",
    };
  });
}

function relationshipTypeLabel(type) {
  const labels = {
    known: "知っている",
    talked: "知見を交換した",
    event: "同じ勉強会",
    project: "一緒に研究・開発",
  };
  return labels[type] ?? type;
}

function groupLabel(group) {
  const labels = {
    newcomer: "新入生",
    math: "数学",
    cs: "情報科学",
    physics: "物理",
    design: "デザイン",
    social: "社会科学",
    interdisciplinary: "学際",
    local: "地域連携",
    international: "国際交流",
    tech: "技術",
    media: "メディア",
    research: "研究",
    event: "イベント運営",
    community: "コミュニティ",
  };

  return labels[group] ?? group;
}

function roleColor(role) {
  const colors = {
    core: "#1c6b5a",
    new: "#e3a531",
    bridge: "#c65b4b",
    isolated: "#9078dc",
  };

  return colors[role] ?? "#1c6b5a";
}

function formatTokens(items) {
  return items.map((item) => `<span class="token">${escapeHtml(item)}</span>`).join("");
}

function setAppVisibility() {
  document.getElementById("authScreen").hidden = isAuthenticated();
  document.getElementById("appShell").hidden = !isAuthenticated();
  document.body.dataset.viewMode = isAuthenticated() ? (isManager() ? "manager" : "member") : "guest";
}

function renderDemoAccountList() {
  const list = document.getElementById("demoAccountList");
  const accounts = uiState.data?.accounts ?? [];

  list.innerHTML = accounts.map((account) => `
    <button class="demo-account-card" data-account-id="${escapeHtml(account.id)}" type="button">
      <span class="demo-account-role">${escapeHtml(accountRoleLabels[account.role] ?? account.role)}</span>
      <strong>${escapeHtml(account.displayName)}</strong>
      <span>${escapeHtml(account.username)} / ${escapeHtml(account.password)}</span>
      <small>${escapeHtml(account.demoNote ?? "")}</small>
    </button>
  `).join("");

  list.querySelectorAll("[data-account-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const account = uiState.data.accounts.find((item) => item.id === button.dataset.accountId);
      if (!account) {
        renderAuthNotice("アカウント情報が見つかりませんでした。", "error");
        return;
      }

      loginAsAccount(account);
    });
  });
}

function renderSessionChrome() {
  const account = currentAccount();
  if (!account) {
    return;
  }

  const sessionBadge = document.getElementById("sessionBadge");
  const resetButton = document.getElementById("resetDataButton");
  const createUserPanel = document.getElementById("createUserPanel");

  sessionBadge.textContent = `${accountRoleLabels[account.role] ?? account.role} / ${account.displayName}`;
  resetButton.hidden = isMember();
  createUserPanel.hidden = isMember();

  if (isManager()) {
    document.getElementById("topbarHeadline").textContent = `${currentCommunity()?.name ?? "キャンパス"} のナレッジダッシュボード`;
    document.getElementById("topbarSubcopy").textContent = "教員はキャンパス全体の知見グラフを見ながら、学生追加、知見エッジ編集、橋渡し候補の発見を行えます。";
    document.getElementById("communitySectionTitle").textContent = "キャンパス";
    document.getElementById("memberSectionTitle").textContent = "学生ノード一覧";
    document.getElementById("heroKicker").textContent = "Knowledge Dashboard";
    document.getElementById("analyticsTitle").textContent = "知見接続の分析";
    document.getElementById("analyticsPrimaryLabel").textContent = "知見クラスタ";
    document.getElementById("analyticsSecondaryLabel").textContent = "孤立ノードの学生";
    document.getElementById("recommendationTitle").textContent = "おすすめ知見接続";
    document.getElementById("introductionTitle").textContent = "5分Syncの提案";
    document.getElementById("selectedProfileTitle").textContent = "選択中の学生ノード";
    document.getElementById("profileFormTitle").textContent = "プロフィール編集";
    document.getElementById("relationshipTitle").textContent = "知見エッジを追加";
    document.getElementById("eventTitle").textContent = "キャンパスイベント";
    document.getElementById("profileSaveButton").textContent = "プロフィールを保存";
    document.getElementById("relationshipSubmitButton").textContent = "知見エッジを追加";
    return;
  }

  const actor = actorUser();
  document.getElementById("topbarHeadline").textContent = `${actor?.name ?? account.displayName} さんのナレッジホーム`;
  document.getElementById("topbarSubcopy").textContent = "学生画面では、自分向けのおすすめ知見接続、イベント、5分Syncの候補を確認しながら、マイプロフィールとつながり申告を更新できます。";
  document.getElementById("communitySectionTitle").textContent = "所属キャンパス";
  document.getElementById("memberSectionTitle").textContent = "キャンパスの学生";
  document.getElementById("heroKicker").textContent = "My Knowledge";
  document.getElementById("analyticsTitle").textContent = "あなたの知見ネットワーク";
  document.getElementById("analyticsPrimaryLabel").textContent = "知見が近い人";
  document.getElementById("analyticsSecondaryLabel").textContent = "あなたの知見エッジ";
  document.getElementById("recommendationTitle").textContent = "あなたへのおすすめ知見接続";
  document.getElementById("introductionTitle").textContent = "あなた向けの5分Sync提案";
  document.getElementById("selectedProfileTitle").textContent = "閲覧中の学生ノード";
  document.getElementById("profileFormTitle").textContent = "マイプロフィール編集";
  document.getElementById("relationshipTitle").textContent = "知見のつながり申告";
  document.getElementById("eventTitle").textContent = "参加できそうな勉強会";
  document.getElementById("profileSaveButton").textContent = "マイプロフィールを保存";
  document.getElementById("relationshipSubmitButton").textContent = "知見エッジを申告";
}

function renderCommunityList() {
  const communityList = document.getElementById("communityList");
  const communities = visibleCommunities();
  const canSwitch = isManager() && communities.length > 1;

  communityList.innerHTML = communities.map((community) => {
    const isActive = community.id === uiState.selectedCommunityId;
    const memberCount = communityUsers(community.id).length;
    return `
      <button
        class="community-card ${isActive ? "active" : ""} ${canSwitch ? "" : "locked"}"
        data-community-id="${escapeHtml(community.id)}"
        type="button"
        ${canSwitch ? "" : "disabled"}
      >
        <strong>${escapeHtml(community.name)}</strong>
        <span>${escapeHtml(community.subtitle)}</span>
        <small>${memberCount} members</small>
      </button>
    `;
  }).join("");

  if (!canSwitch) {
    return;
  }

  communityList.querySelectorAll("[data-community-id]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.selectedCommunityId = button.dataset.communityId;
      uiState.memberSearch = "";
      normalizeSelection();
      renderApp();
    });
  });
}

function filteredMembers() {
  const query = uiState.memberSearch.trim().toLowerCase();
  const users = communityUsers();

  if (!query) {
    return users;
  }

  return users.filter((user) => {
    const haystack = [
      user.name,
      user.bio,
      user.group,
      user.availability,
      ...user.interests,
      ...user.goals,
      ...user.activityTags,
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });
}

function renderMemberList() {
  const list = document.getElementById("memberList");
  const users = filteredMembers();
  const actor = actorUser();

  if (users.length === 0) {
    list.innerHTML = `<div class="empty-state">該当する学生がいません。</div>`;
    return;
  }

  list.innerHTML = users.map((user) => {
    const selected = user.id === uiState.selectedUserId;
    const self = actor?.id === user.id;
    const pts = computeUserPoints(user.id);
    return `
      <button class="member-card ${selected ? "selected" : ""}" data-user-id="${escapeHtml(user.id)}" type="button">
        <span class="member-card-top">
          <strong>${escapeHtml(user.name)}</strong>
          <em>${self ? "あなた" : escapeHtml(roleLabels[user.role] ?? user.role)}</em>
        </span>
        <span>${escapeHtml(groupLabel(user.group))}</span>
        <span style="display:flex;justify-content:space-between;align-items:center">
          <small>${escapeHtml(user.availability || "予定未設定")}</small>
          ${pts > 0 ? `<span class="member-points">${pts}pt</span>` : ""}
        </span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-user-id]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.selectedUserId = button.dataset.userId;
      renderApp();
    });
  });
}

function renderHeroSection() {
  const community = currentCommunity();
  const actor = actorUser();
  const headline = document.getElementById("communityHeadline");
  const description = document.getElementById("communityDescription");

  if (isManager()) {
    headline.textContent = `${community.name} の知見グラフを編集する`;
    description.textContent = `${community.description} 現在は GPS を使わず、専門・興味・活動タグ・知見エッジだけで接続を提案しています。`;
    return;
  }

  headline.textContent = `${actor.name} さんの疑問を5分で解決できる人を、${community.name} の中から探す`;
  description.textContent = `${community.description} 学生画面では、あなた自身のプロフィール、知見エッジ、勉強会、接続候補を中心に見られます。`;
}

function renderOverviewStats() {
  const stats = [];
  const events = communityEvents();

  if (isManager()) {
    const users = communityUsers();
    const relationships = communityRelationships();
    const isolatedCount = users.filter((user) => degreeOf(user.id) <= 1).length;
    const lead = communityLeads()[0];

    stats.push(
      {
        label: "学生ノード数",
        value: users.length,
        body: "フォームからダミー学生を追加できます。",
      },
      {
        label: "知見エッジ数",
        value: relationships.length,
        body: "「知見交換」「同じ勉強会」などを登録できます。",
      },
      {
        label: "ネットワーク密度",
        value: `${densityPercent()}%`,
        body: "高いほどキャンパス全体の知見接続が多い状態です。",
      },
      {
        label: "キーノード",
        value: lead ? lead.user.name : "-",
        body: lead ? `${lead.degree} 本の接続を持つ知見ハブ` : "学生がいません。",
      },
      {
        label: "孤立ノード",
        value: isolatedCount,
        body: "エッジが 1 本以下の学生です。",
      },
    );
  } else {
    const actor = actorUser();
    const recommendations = buildRecommendations();
    const sharedInterestPeers = communityUsers().filter((user) => {
      return user.id !== actor.id && intersection(actor.interests, user.interests).length > 0;
    }).length;
    const nextEvent = events[0];

    stats.push(
      {
        label: "あなたの知見エッジ",
        value: degreeOf(actor.id),
        body: "今登録されている知見接続の数です。",
      },
      {
        label: "おすすめ候補",
        value: recommendations.length,
        body: "5分Syncで繋がるとよい候補です。",
      },
      {
        label: "知見が近い人",
        value: sharedInterestPeers,
        body: "専門や興味が重なる学生の人数です。",
      },
      {
        label: "橋渡し余地",
        value: bridgePotential(actor),
        body: "別分野との知見接続を増やせる可能性です。",
      },
      {
        label: "次の勉強会",
        value: nextEvent ? nextEvent.title : "予定なし",
        body: nextEvent ? `${nextEvent.time} / ${nextEvent.format}` : "勉強会の情報はまだありません。",
      },
    );
  }

  document.getElementById("overviewStats").innerHTML = stats.map((stat) => `
    <article class="metric-card">
      <p class="metric-label">${escapeHtml(stat.label)}</p>
      <p class="metric-value">${escapeHtml(stat.value)}</p>
      <p class="card-caption">${escapeHtml(stat.body)}</p>
    </article>
  `).join("");
}

function renderGraph() {
  const svgEl = document.getElementById("graphCanvas");
  const actor = actorUser();
  const users = communityUsers();
  const rels = communityRelationships();
  const W = 860, H = 480;

  // Fall back to static layout if D3 not loaded
  if (typeof d3 === "undefined") {
    _renderGraphStatic(svgEl, users, rels, actor, W, H);
    return;
  }

  const key = [
    uiState.selectedCommunityId,
    users.map(u => u.id).sort().join(","),
    rels.map(r => r.id).sort().join(","),
  ].join("|");

  if (_graphKey !== key) {
    _graphKey = key;
    if (_graphSim) _graphSim.stop();
    svgEl.innerHTML = "";

    const svg = d3.select(svgEl);
    const edgeLayer = svg.append("g");
    const nodeLayer = svg.append("g");

    const nodeData = users.map(u => ({ ...u }));
    const linkData = rels.map(r => ({
      ...r,
      source: r.fromUserId,
      target: r.toUserId,
    }));

    const edges = edgeLayer.selectAll("line")
      .data(linkData, d => d.id)
      .join("line")
      .attr("class", "edge")
      .attr("stroke-width", d => Math.max(1, 1 + (d.strength ?? 3) * 0.4));

    const nodeGs = nodeLayer.selectAll("g.node")
      .data(nodeData, d => d.id)
      .join("g")
      .attr("class", "node")
      .on("click", (event, d) => {
        uiState.selectedUserId = d.id;
        renderApp();
      })
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) _graphSim?.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = clamp(event.x, 20, W - 20);
            d.fy = clamp(event.y, 20, H - 20);
          })
          .on("end", (event, d) => {
            if (!event.active) _graphSim?.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      );

    nodeGs.append("circle")
      .attr("class", "node-halo")
      .attr("r", 26)
      .attr("fill", "transparent");

    nodeGs.append("circle")
      .attr("class", "node-circle")
      .attr("r", 17)
      .attr("fill", d => roleColor(d.role))
      .attr("stroke", "rgba(255,255,255,0.84)")
      .attr("stroke-width", 2);

    nodeGs.append("text")
      .attr("class", "node-label")
      .attr("y", 34)
      .attr("text-anchor", "middle")
      .text(d => d.name);

    nodeGs.append("text")
      .attr("class", "node-meta")
      .attr("y", 50)
      .attr("text-anchor", "middle")
      .text(d => roleLabels[d.role] ?? d.role);

    const sim = d3.forceSimulation(nodeData)
      .force("link", d3.forceLink(linkData).id(d => d.id).distance(100).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-240))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(30))
      .force("x", d3.forceX(W / 2).strength(0.04))
      .force("y", d3.forceY(H / 2).strength(0.04))
      .on("tick", () => {
        edges
          .attr("x1", d => clamp(d.source.x, 20, W - 20))
          .attr("y1", d => clamp(d.source.y, 20, H - 20))
          .attr("x2", d => clamp(d.target.x, 20, W - 20))
          .attr("y2", d => clamp(d.target.y, 20, H - 20));

        nodeGs.attr("transform", d => `translate(${clamp(d.x, 20, W - 20)},${clamp(d.y, 20, H - 20)})`);
      });

    _graphSim = sim;
  }

  // Update highlights without rebuilding (every renderApp call)
  d3.select(svgEl).selectAll("g.node").each(function(d) {
    const sel = d3.select(this);
    const isActor = actor?.id === d.id;
    const isSelected = d.id === uiState.selectedUserId;

    sel.select(".node-circle")
      .attr("stroke", isActor ? "#c65b4b" : isSelected ? "#1b160f" : "rgba(255,255,255,0.84)")
      .attr("stroke-width", isActor || isSelected ? 3 : 2)
      .attr("r", isSelected ? 20 : 17);

    sel.select(".node-halo")
      .attr("fill", isActor ? "rgba(198,91,75,0.10)" : isSelected ? "rgba(28,107,90,0.08)" : "transparent");
  });
}

function _renderGraphStatic(svgEl, users, rels, actor, W, H) {
  svgEl.innerHTML = "";
  const groups = [...new Set(users.map(u => u.group))];
  const positions = new Map();

  groups.forEach((group, gi) => {
    const angle = (Math.PI * 2 * gi) / Math.max(groups.length, 1) - Math.PI / 2;
    const cx = W / 2 + Math.cos(angle) * 240;
    const cy = H / 2 + Math.sin(angle) * 140;
    const members = users.filter(u => u.group === group);
    members.forEach((user, mi) => {
      const ma = (Math.PI * 2 * mi) / Math.max(members.length, 1);
      const r = members.length === 1 ? 0 : 54;
      positions.set(user.id, { x: cx + Math.cos(ma) * r, y: cy + Math.sin(ma) * r });
    });
  });

  rels.forEach(rel => {
    const from = positions.get(rel.fromUserId);
    const to = positions.get(rel.toUserId);
    if (!from || !to) return;
    const line = document.createElementNS(svgNamespace, "line");
    line.setAttribute("x1", String(from.x)); line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x)); line.setAttribute("y2", String(to.y));
    line.setAttribute("stroke-width", String(1 + (rel.strength ?? 3)));
    line.setAttribute("class", "edge");
    svgEl.appendChild(line);
  });

  users.forEach(user => {
    const pt = positions.get(user.id);
    if (!pt) return;
    const isActor = actor?.id === user.id;
    const isSelected = user.id === uiState.selectedUserId;
    const g = document.createElementNS(svgNamespace, "g");
    g.setAttribute("class", "node");
    const circle = document.createElementNS(svgNamespace, "circle");
    circle.setAttribute("cx", String(pt.x)); circle.setAttribute("cy", String(pt.y));
    circle.setAttribute("r", isSelected ? "20" : "17");
    circle.setAttribute("fill", roleColor(user.role));
    circle.setAttribute("stroke", isActor ? "#c65b4b" : isSelected ? "#1b160f" : "rgba(255,255,255,0.84)");
    circle.setAttribute("stroke-width", isActor || isSelected ? "3" : "2");
    g.appendChild(circle);
    const label = document.createElementNS(svgNamespace, "text");
    label.setAttribute("x", String(pt.x)); label.setAttribute("y", String(pt.y + 36));
    label.setAttribute("class", "node-label"); label.textContent = user.name;
    g.appendChild(label);
    g.addEventListener("click", () => { uiState.selectedUserId = user.id; renderApp(); });
    svgEl.appendChild(g);
  });
}

function renderAnalytics() {
  const users = communityUsers();
  const actor = actorUser();
  const cards = [];

  if (isManager()) {
    const isolated = users.filter((user) => degreeOf(user.id) <= 1);
    const leads = communityLeads();
    const bridgeUsers = [...users].sort((left, right) => bridgePotential(right) - bridgePotential(left)).slice(0, 3);
    const clusters = connectedClusters();

    cards.push(
      {
        label: "キーノード",
        value: leads[0]?.user.name ?? "-",
        body: leads[0] ? `${leads[0].degree} 本の知見エッジ` : "データなし",
      },
      {
        label: "橋渡し候補",
        value: bridgeUsers[0]?.name ?? "-",
        body: bridgeUsers[0] ? `${bridgePotential(bridgeUsers[0])} 点の橋渡しポテンシャル` : "データなし",
      },
      {
        label: "知見クラスタ数",
        value: clusters.length,
        body: "知見の分断をざっくり見られる指標です。",
      },
      {
        label: "孤立ノード",
        value: isolated.length,
        body: "優先的に繋ぎたい学生数",
      },
    );

    document.getElementById("clusterList").innerHTML = clusters.map((cluster) => {
      const labels = cluster.map((userId) => userById(userId)?.name).filter(Boolean).join(" ・ ");
      return `<span class="token wide">${escapeHtml(labels)}</span>`;
    }).join("") || `<span class="token wide">知見クラスタなし</span>`;

    document.getElementById("isolatedList").innerHTML = isolated.map((user) => {
      return `<span class="token wide">${escapeHtml(user.name)} (${escapeHtml(groupLabel(user.group))})</span>`;
    }).join("") || `<span class="token wide">孤立ノードの学生はいません。</span>`;
  } else {
    const partnerIds = userRelationships(actor.id).map((relationship) => {
      return relationship.fromUserId === actor.id ? relationship.toUserId : relationship.fromUserId;
    });
    const partners = partnerIds.map((userId) => userById(userId)).filter(Boolean);
    const crossGroupLinks = partners.filter((partner) => partner.group !== actor.group).length;
    const similarPeers = buildRecommendations()
      .filter((entry) => intersection(actor.interests, entry.user.interests).length > 0)
      .slice(0, 4);

    cards.push(
      {
        label: "登録済み知見エッジ",
        value: degreeOf(actor.id),
        body: "あなたが今つながっている学生の数です。",
      },
      {
        label: "別分野接続",
        value: crossGroupLinks,
        body: "異なる専門分野への知見接続です。",
      },
      {
        label: "橋渡し余地",
        value: bridgePotential(actor),
        body: "新しい知見接続を生む余白です。",
      },
      {
        label: "おすすめ候補",
        value: buildRecommendations().length,
        body: "5分Syncで繋がるとよい学生数です。",
      },
    );

    document.getElementById("clusterList").innerHTML = similarPeers.map((entry) => {
      const shared = intersection(actor.interests, entry.user.interests);
      return `<span class="token wide">${escapeHtml(entry.user.name)} / ${escapeHtml(shared.join("・") || "共通知見あり")}</span>`;
    }).join("") || `<span class="token wide">知見が近い候補はまだ少なめです。</span>`;

    document.getElementById("isolatedList").innerHTML = partners.map((partner) => {
      return `<span class="token wide">${escapeHtml(partner.name)} / ${escapeHtml(groupLabel(partner.group))}</span>`;
    }).join("") || `<span class="token wide">まだ知見エッジの申告がありません。</span>`;
  }

  document.getElementById("analyticsGrid").innerHTML = cards.map((card) => `
    <article class="analytic-card">
      <p class="metric-label">${escapeHtml(card.label)}</p>
      <div class="analytic-value">${escapeHtml(card.value)}</div>
      <p class="card-caption">${escapeHtml(card.body)}</p>
    </article>
  `).join("");
}

function renderRecommendations() {
  const modeContainer = document.getElementById("modeSwitcher");
  const actor = actorUser();

  modeContainer.innerHTML = recommendationModes.map((mode) => `
    <button class="mode-button ${mode.id === uiState.recommendationMode ? "active" : ""}" data-mode-id="${escapeHtml(mode.id)}" type="button">
      <strong>${escapeHtml(mode.title)}</strong>
      <span>${escapeHtml(mode.description)}</span>
    </button>
  `).join("");

  modeContainer.querySelectorAll("[data-mode-id]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.recommendationMode = button.dataset.modeId;
      renderRecommendations();
      renderIntroductions();
      if (!isManager()) {
        renderAnalytics();
        renderOverviewStats();
      }
    });
  });

  const list = document.getElementById("recommendationList");
  const recommendations = buildRecommendations();

  if (recommendations.length === 0) {
    list.innerHTML = `<div class="empty-state">この${isManager() ? "学生" : "アカウント"}におすすめできる新規知見接続はありません。</div>`;
    return;
  }

  list.innerHTML = recommendations.map((entry) => `
    <article class="recommendation-card">
      <div class="recommendation-head">
        <div>
          <p class="metric-label">${escapeHtml(roleLabels[entry.user.role] ?? entry.user.role)}</p>
          <h3>${escapeHtml(entry.user.name)}</h3>
        </div>
        <strong class="score-pill">${entry.score}</strong>
      </div>
      <p class="subdued">${escapeHtml(entry.user.bio)}</p>
      <div class="token-list">${formatTokens(entry.reasons)}</div>
      <button class="tiny-button" data-recommend-user-id="${escapeHtml(entry.user.id)}" type="button">
        ${isManager() ? "この学生を見る" : `${actor.name} さんから見て詳細を見る`}
      </button>
    </article>
  `).join("");

  list.querySelectorAll("[data-recommend-user-id]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.selectedUserId = button.dataset.recommendUserId;
      renderApp();
    });
  });
}

function renderIntroductions() {
  const ideas = introductionIdeas();
  const list = document.getElementById("introductionList");

  if (ideas.length === 0) {
    list.innerHTML = `<div class="empty-state">5分Syncの提案を出すには、まだ知見接続候補が必要です。</div>`;
    return;
  }

  list.innerHTML = ideas.map((idea) => `
    <article class="recommendation-card">
      <div class="recommendation-head">
        <div>
          <p class="metric-label">${escapeHtml(idea.format)}</p>
          <h3>${escapeHtml(idea.title)}</h3>
        </div>
      </div>
      <p class="subdued">${escapeHtml(idea.body)}</p>
    </article>
  `).join("");
}

function renderEvents() {
  const list = document.getElementById("eventList");
  const events = communityEvents();

  if (events.length === 0) {
    list.innerHTML = `<div class="empty-state">勉強会・イベントはまだありません。</div>`;
    return;
  }

  list.innerHTML = events.map((event) => `
    <article class="event-card">
      <div class="event-head">
        <h3>${escapeHtml(event.title)}</h3>
        <span>${escapeHtml(event.time)}</span>
      </div>
      <p class="subdued">${escapeHtml(event.format)}</p>
      <div class="token-list">${formatTokens(event.participants.map((userId) => userById(userId)?.name).filter(Boolean))}</div>
    </article>
  `).join("");
}

function renderSelectedUser() {
  const preview = selectedUser();
  const actor = actorUser();
  const summary = document.getElementById("selectedUserSummary");
  const meta = document.getElementById("selectedUserMeta");

  if (!preview) {
    summary.innerHTML = `<div class="empty-state">学生ノードを選択してください。</div>`;
    meta.innerHTML = "";
    return;
  }

  const viewingOwnProfile = actor?.id === preview.id;
  const subtitle = isMember() && !viewingOwnProfile
    ? `閲覧中: ${preview.name} / ログイン中: ${actor.name}`
    : `${roleLabels[preview.role] ?? preview.role} / ${groupLabel(preview.group)}`;

  const pts = computeUserPoints(preview.id);
  const badges = computeUserBadges(preview.id);

  summary.innerHTML = `
    <h3>${escapeHtml(preview.name)}</h3>
    <p class="subdued">${escapeHtml(subtitle)}</p>
    <p>${escapeHtml(preview.bio)}</p>
    <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
      <span class="points-pill">${pts} pt</span>
      ${badges.length > 0 ? `<div class="badges-display">${badges.map(b => `<span class="badge-chip" title="${escapeHtml(b.desc)}">${b.icon} ${escapeHtml(b.label)}</span>`).join("")}</div>` : ""}
    </div>
  `;

  meta.innerHTML = `
    <div class="meta-block">
      <span class="meta-label">専門・興味</span>
      <div class="token-list">${formatTokens(preview.interests)}</div>
    </div>
    <div class="meta-block">
      <span class="meta-label">学びたいこと</span>
      <div class="token-list">${formatTokens(preview.goals)}</div>
    </div>
    <div class="meta-block">
      <span class="meta-label">活動タグ</span>
      <div class="token-list">${formatTokens(preview.activityTags)}</div>
    </div>
    <div class="meta-block">
      <span class="meta-label">活動時間帯</span>
      <div class="token-list"><span class="token wide">${escapeHtml(preview.availability || "未設定")}</span></div>
    </div>
  `;
}

function fillProfileForm() {
  const user = actorUser();
  const preview = selectedUser();
  const form = document.getElementById("profileForm");

  if (!user) {
    form.reset();
    return;
  }

  form.elements.namedItem("name").value = user.name;
  form.elements.namedItem("group").value = user.group;
  form.elements.namedItem("role").value = user.role;
  form.elements.namedItem("availability").value = user.availability || "";
  form.elements.namedItem("bio").value = user.bio || "";
  form.elements.namedItem("interests").value = user.interests.join(", ");
  form.elements.namedItem("goals").value = user.goals.join(", ");
  form.elements.namedItem("activityTags").value = user.activityTags.join(", ");

  const groupField = form.elements.namedItem("group");
  const roleField = form.elements.namedItem("role");
  groupField.disabled = isMember();
  roleField.disabled = isMember();

  if (isMember()) {
    document.getElementById("profileFormNote").textContent = preview?.id === user.id
      ? `${user.name} さん自身のプロフィール（専門・知見）を編集できます。`
      : `このフォームは ${user.name} さん自身を編集します。右上のカードは他の学生の閲覧用です。`;
    return;
  }

  document.getElementById("profileFormNote").textContent = "選択中の学生ノード情報を編集できます。";
}

function fillRelationshipControls() {
  const actingUser = actorUser();
  const select = document.getElementById("targetUserSelect");
  const list = document.getElementById("relationshipList");

  if (!actingUser) {
    select.innerHTML = "";
    list.innerHTML = `<div class="empty-state">学生を選ぶと知見エッジを編集できます。</div>`;
    return;
  }

  const candidates = communityUsers().filter((candidate) => candidate.id !== actingUser.id);
  select.innerHTML = candidates.map((candidate) => `
    <option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)} / ${escapeHtml(groupLabel(candidate.group))}</option>
  `).join("");

  document.getElementById("relationshipFormNote").textContent = isMember()
    ? `${actingUser.name} さん視点で「知見を共有した人」を申告できます。`
    : `教員として ${actingUser.name} さんの知見エッジを登録できます。`;

  const relationships = userRelationships(actingUser.id);
  if (relationships.length === 0) {
    list.innerHTML = `<div class="empty-state">まだ知見エッジがありません。</div>`;
    return;
  }

  list.innerHTML = relationships.map((relationship) => {
    const partnerId = relationship.fromUserId === actingUser.id ? relationship.toUserId : relationship.fromUserId;
    const partner = userById(partnerId);
    return `
      <div class="relationship-item">
        <div>
          <strong>${escapeHtml(partner?.name ?? "Unknown")}</strong>
          <p>${escapeHtml(relationshipTypeLabel(relationship.type))} / 強さ ${relationship.strength}</p>
          <small>${escapeHtml(relationship.note || "メモなし")}</small>
        </div>
        <button class="tiny-button danger" data-relationship-id="${escapeHtml(relationship.id)}" type="button">削除</button>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-relationship-id]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.data.relationships = uiState.data.relationships.filter((relationship) => relationship.id !== button.dataset.relationshipId);
      persistData();
      renderNotice("知見エッジを削除しました。", "success");
      renderApp();
    });
  });
}

function authenticate(username, password) {
  const normalizedUsername = username.trim();
  const normalizedPassword = password.trim();

  return uiState.data.accounts.find((account) => {
    return account.username === normalizedUsername && account.password === normalizedPassword;
  }) ?? null;
}

function loginAsAccount(account) {
  uiState.authSession = { accountId: account.id };
  persistAuthSession();
  uiState.selectedCommunityId = account.communityId ?? uiState.selectedCommunityId;
  uiState.selectedUserId = account.userId ?? uiState.selectedUserId;
  uiState.memberSearch = "";
  normalizeSelection();
  renderNotice(`${account.displayName} としてログインしました。`, "success");
  renderAuthNotice("デモアカウントからログインできます。", "info");
  renderApp();
}

function logout() {
  uiState.authSession = null;
  persistAuthSession();
  uiState.memberSearch = "";
  uiState.selectedCommunityId = null;
  uiState.selectedUserId = null;
  renderAuthNotice("ログアウトしました。別のアカウントでログインできます。", "success");
  renderApp();
}

function bindStaticEvents() {
  document.getElementById("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const account = authenticate(String(formData.get("username")), String(formData.get("password")));

    if (!account) {
      renderAuthNotice("ユーザー名またはパスワードが違います。Demo Accounts から選ぶこともできます。", "error");
      return;
    }

    loginAsAccount(account);
    event.currentTarget.reset();
  });

  document.getElementById("logoutButton").addEventListener("click", () => {
    logout();
  });

  document.getElementById("memberSearchInput").addEventListener("input", (event) => {
    uiState.memberSearch = event.target.value;
    renderMemberList();
  });

  document.getElementById("courseSearchInput").addEventListener("input", (event) => {
    uiState.courseSearch = event.target.value;
    renderCoursePanel();
  });

  document.getElementById("resetDataButton").addEventListener("click", async () => {
    try {
      await loadSeedData(true);
      normalizeSelection();
      renderNotice("JSON シードデータに戻しました。", "success");
      renderApp();
    } catch (error) {
      renderNotice("JSON シードデータの再読み込みに失敗しました。Docker 経由で開いているか確認してください。", "error");
    }
  });

  document.getElementById("profileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const user = actorUser();
    if (!user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    user.name = String(formData.get("name")).trim();
    user.availability = String(formData.get("availability")).trim();
    user.bio = String(formData.get("bio")).trim();
    user.interests = parseCommaSeparated(formData.get("interests"));
    user.goals = parseCommaSeparated(formData.get("goals"));
    user.activityTags = parseCommaSeparated(formData.get("activityTags"));

    if (isManager()) {
      user.group = String(formData.get("group")).trim() || user.group;
      user.role = String(formData.get("role")).trim() || user.role;
    }

    persistData();
    renderNotice(`${user.name} のプロフィールを保存しました。`, "success");
    renderApp();
  });

  document.getElementById("relationshipForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const user = actorUser();
    if (!user) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const targetUserId = String(formData.get("targetUserId"));

    if (!targetUserId) {
      renderNotice("知見を繋げる相手を選んでください。", "error");
      return;
    }

    if (relationshipExists(user.id, targetUserId)) {
      renderNotice("その組み合わせの知見エッジはすでに存在します。", "error");
      return;
    }

    uiState.data.relationships.push({
      id: toId("rel"),
      communityId: uiState.selectedCommunityId,
      fromUserId: user.id,
      toUserId: targetUserId,
      type: String(formData.get("type")),
      strength: Number(formData.get("strength")) || 3,
      note: String(formData.get("note")).trim(),
    });

    persistData();
    event.currentTarget.reset();
    const targetUser = userById(targetUserId);
    const pts = computeUserPoints(user.id);
    showPointsToast(`⚡ 知見エッジ追加！ ${user.name} +${10}pt`);
    renderNotice(`知見エッジを追加しました。 ${user.name}↔${targetUser?.name ?? ""}`, "success");
    renderApp();
  });

  document.getElementById("createUserForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!isManager()) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const newUser = {
      id: toId("user"),
      communityId: uiState.selectedCommunityId,
      name: String(formData.get("name")).trim(),
      group: String(formData.get("group")).trim(),
      role: String(formData.get("role")).trim(),
      availability: String(formData.get("availability")).trim(),
      bio: String(formData.get("bio")).trim(),
      interests: parseCommaSeparated(formData.get("interests")),
      goals: parseCommaSeparated(formData.get("goals")),
      activityTags: parseCommaSeparated(formData.get("activityTags")),
    };

    if (!newUser.name || !newUser.group) {
      renderNotice("名前と所属分野は必須です。", "error");
      return;
    }

    uiState.data.users.push(newUser);
    uiState.selectedUserId = newUser.id;
    persistData();
    event.currentTarget.reset();
    renderNotice(`${newUser.name} をナレッジグラフに追加しました。`, "success");
    renderApp();
  });
}

// ── Gamification ────────────────────────────────────────────

function computeUserPoints(userId) {
  const user = userById(userId);
  if (!user) return 0;
  let points = 0;
  communityRelationships().forEach(r => {
    if (r.fromUserId === userId || r.toUserId === userId) {
      const otherId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
      const other = userById(otherId);
      const crossGroup = other && other.group !== user.group;
      points += 10 + (crossGroup ? 5 : 0) + ((r.strength ?? 3) - 3) * 2;
    }
  });
  return Math.max(0, points);
}

function computeUserBadges(userId) {
  const user = userById(userId);
  if (!user) return [];
  const degree = degreeOf(userId);
  const bp = bridgePotential(user);
  const rels = userRelationships(userId);
  const connectedGroups = new Set();
  rels.forEach(r => {
    const otherId = r.fromUserId === userId ? r.toUserId : r.fromUserId;
    const other = userById(otherId);
    if (other) connectedGroups.add(other.group);
  });
  const badges = [];
  if (degree >= 1) badges.push({ icon: "🚀", label: "ファーストコネクト", desc: "最初の知見エッジを作った" });
  if (degree >= 5) badges.push({ icon: "⭐", label: "キーノード", desc: `${degree}本の知見エッジ` });
  if (degree >= 10) badges.push({ icon: "🏆", label: "スーパーコネクター", desc: "10本以上の知見エッジ" });
  if (bp >= 20) badges.push({ icon: "🌉", label: "橋渡し師", desc: "高い橋渡しポテンシャル" });
  if (connectedGroups.size >= 3) badges.push({ icon: "🎯", label: "知識の伝道師", desc: `${connectedGroups.size}分野と接続` });
  return badges;
}

function showPointsToast(message) {
  const toast = document.createElement("div");
  toast.className = "points-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function renderGamificationPanel() {
  const el = document.getElementById("gamificationPanel");
  if (!el) return;
  const users = communityUsers();
  const actor = actorUser();
  const ranked = [...users]
    .map(u => ({ user: u, points: computeUserPoints(u.id), badges: computeUserBadges(u.id) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 8);

  el.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="section-kicker">Gamification / Points</p>
        <h2>知見ポイント ランキング</h2>
      </div>
    </div>
    <p class="subdued">知見エッジを増やすほどポイントが上がります。別分野との接続はボーナス+5pt。</p>
    <div class="leaderboard">
      ${ranked.map((entry, i) => `
        <div class="leaderboard-row ${actor?.id === entry.user.id ? "self-row" : ""}">
          <span class="rank-num">${i + 1}</span>
          <div class="rank-info">
            <strong>${escapeHtml(entry.user.name)}</strong>
            <span>${escapeHtml(groupLabel(entry.user.group))}</span>
          </div>
          <div class="badge-row">${entry.badges.map(b => `<span class="badge-icon" title="${escapeHtml(b.label + ": " + b.desc)}">${b.icon}</span>`).join("")}</div>
          <span class="points-pill">${entry.points} pt</span>
        </div>
      `).join("")}
    </div>
  `;
}

// ── SOS / Real-time ──────────────────────────────────────────

function initSosChannel() {
  if (typeof BroadcastChannel === "undefined") return;
  _sosBroadcast = new BroadcastChannel("knowledge-mesh-sos");
  _sosBroadcast.onmessage = (event) => {
    const msg = event.data;
    if (msg.type === "sos-new" && !uiState.sosList.find(s => s.id === msg.id)) {
      uiState.sosList.unshift(msg);
      renderSosPanel();
      renderNotice(`🆘 ${escapeHtml(msg.userName)} さんがSOSを送信: ${escapeHtml(msg.topic)}`, "info");
    }
    if (msg.type === "sos-resolved") {
      const entry = uiState.sosList.find(s => s.id === msg.id);
      if (entry) { entry.status = "resolved"; renderSosPanel(); }
    }
  };
}

function renderSosPanel() {
  const el = document.getElementById("sosPanel");
  if (!el) return;
  const actor = actorUser();
  const activeSos = uiState.sosList.filter(s => s.status === "active");

  const sosFormHtml = isMember() ? `
    <form id="sosForm" class="form-grid" style="margin-top:14px">
      <label class="field full">
        <span>何に困っていますか？</span>
        <input name="topic" type="text" placeholder="例: 線形代数の固有値が全然わからない" required />
      </label>
      <button class="primary-button full sos-button" type="submit">🆘 SOSを送る</button>
    </form>
  ` : "";

  const listHtml = activeSos.length === 0
    ? `<div class="empty-state">現在アクティブなSOSはありません。</div>`
    : activeSos.map(sos => `
        <article class="sos-card ${sos.userId === actor?.id ? "sos-self" : ""}">
          <div class="sos-head">
            <strong>${escapeHtml(sos.userName)}</strong>
            <span class="sos-time">${escapeHtml(sos.timeLabel)}</span>
          </div>
          <p class="sos-topic">${escapeHtml(sos.topic)}</p>
          ${sos.userId !== actor?.id
            ? `<button class="tiny-button" data-sos-id="${escapeHtml(sos.id)}" type="button">✋ 5分Syncを申し出る</button>`
            : `<span class="subdued" style="font-size:0.82rem">（あなたのSOS）</span>`
          }
        </article>
      `).join("");

  el.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="section-kicker">SOS / BroadcastChannel</p>
        <h2>リアルタイムSOS</h2>
      </div>
      <span class="status-badge ${activeSos.length > 0 ? "badge-active" : ""}">
        ${activeSos.length > 0 ? `${activeSos.length}件 アクティブ` : "待機中"}
      </span>
    </div>
    <p class="subdued">今すぐ助けが必要な時はSOSを送信。同一ページを開いている別タブにリアルタイムで届きます。</p>
    ${sosFormHtml}
    <div class="sos-list">${listHtml}</div>
  `;

  const form = el.querySelector("#sosForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const currentActor = actorUser();
      if (!currentActor) return;
      const topic = String(new FormData(event.currentTarget).get("topic")).trim();
      if (!topic) return;
      const sos = {
        id: toId("sos"),
        userId: currentActor.id,
        userName: currentActor.name,
        topic,
        timeLabel: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
        status: "active",
        type: "sos-new",
      };
      uiState.sosList.unshift(sos);
      _sosBroadcast?.postMessage(sos);
      form.reset();
      renderSosPanel();
      renderNotice(`SOSを送信しました: ${topic}`, "success");
    });
  }

  el.querySelectorAll("[data-sos-id]").forEach(button => {
    button.addEventListener("click", () => {
      const currentActor = actorUser();
      const sosId = button.dataset.sosId;
      const sos = uiState.sosList.find(s => s.id === sosId);
      if (!sos || !currentActor) return;
      sos.status = "resolved";
      _sosBroadcast?.postMessage({ id: sosId, type: "sos-resolved" });
      showPointsToast(`✋ ${currentActor.name} さんが応答！ +10pt`);
      renderSosPanel();
      renderGamificationPanel();
      renderNotice(`${currentActor.name} さんが ${sos.userName} さんのSOSに応答しました！`, "success");
    });
  });
}

function renderCoursePanel() {
  const list = document.getElementById("courseList");
  const detail = document.getElementById("courseDetail");
  if (!list || !detail) {
    return;
  }

  const courses = filteredCourses();

  if (courses.length === 0) {
    list.innerHTML = `<div class="empty-state">該当するコースがありません。</div>`;
    detail.innerHTML = "";
    return;
  }

  list.innerHTML = courses.map((course) => {
    const active = course.id === uiState.selectedCourseId;
    const planCount = course.lecture_plan.length;
    return `
      <button class="course-card ${active ? "active" : ""}" data-course-id="${escapeHtml(course.id)}" type="button">
        <strong>${escapeHtml(course.course_title)}</strong>
        <span>${escapeHtml(course.instructor)} / ${escapeHtml(course.term)} ${escapeHtml(course.day)} ${escapeHtml(course.period)}</span>
        <small>${escapeHtml(course.departments.join("・"))} / ${planCount} トピック</small>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-course-id]").forEach((button) => {
    button.addEventListener("click", () => {
      uiState.selectedCourseId = button.dataset.courseId;
      renderCoursePanel();
    });
  });

  const selected = uiState.courses.find((c) => c.id === uiState.selectedCourseId);
  if (!selected) {
    detail.innerHTML = `<div class="empty-state">コースを選択すると、授業計画と関連する学生が表示されます。</div>`;
    return;
  }

  const matches = courseMatchingUsers(selected);

  detail.innerHTML = `
    <div class="course-detail-header">
      <h3>${escapeHtml(selected.course_title)}</h3>
      <p class="subdued">${escapeHtml(selected.instructor)} / ${escapeHtml(selected.term)} ${escapeHtml(selected.day)} ${escapeHtml(selected.period)}</p>
      <p class="subdued">${escapeHtml(selected.program)} / ${escapeHtml(selected.departments.join("・"))} / ${escapeHtml(selected.grade)} / ${escapeHtml(selected.credits)}</p>
    </div>
    ${selected.contents ? `<p class="course-contents">${escapeHtml(selected.contents)}</p>` : ""}
    ${selected.lecture_plan.length > 0 ? `
      <div class="course-plan">
        <h4>授業計画 (${selected.lecture_plan.length} トピック)</h4>
        <ol class="plan-list">
          ${selected.lecture_plan.map((topic) => `<li>${escapeHtml(topic)}</li>`).join("")}
        </ol>
      </div>
    ` : ""}
    ${matches.length > 0 ? `
      <div class="course-matches">
        <h4>関連する学生ノード</h4>
        ${matches.map((entry) => `
          <div class="course-match-item">
            <strong>${escapeHtml(entry.user.name)}</strong>
            <div class="token-list">${formatTokens(entry.matchedInterests)}</div>
          </div>
        `).join("")}
      </div>
    ` : `<div class="empty-state">このコースにマッチする学生はまだいません。</div>`}
  `;
}

function renderApp() {
  normalizeSelection();
  setAppVisibility();
  renderDemoAccountList();

  if (!isAuthenticated()) {
    return;
  }

  renderStorageBadge();
  renderSessionChrome();
  renderCommunityList();
  renderMemberList();
  renderHeroSection();
  renderOverviewStats();
  renderGraph();
  renderAnalytics();
  renderRecommendations();
  renderIntroductions();
  renderEvents();
  renderSelectedUser();
  fillProfileForm();
  fillRelationshipControls();
  renderCoursePanel();
  renderSosPanel();
  renderGamificationPanel();
  document.getElementById("memberSearchInput").value = uiState.memberSearch;
  document.getElementById("courseSearchInput").value = uiState.courseSearch;
}

async function initApp() {
  bindStaticEvents();
  initSosChannel();
  loadStoredAuthSession();

  try {
    await Promise.all([loadSeedData(), loadCourses()]);
    normalizeSelection();

    if (isAuthenticated()) {
      renderNotice("保存済みセッションを復元しました。", "success");
    } else {
      renderAuthNotice("Demo Accounts から教員または学生としてログインできます。", "info");
    }

    renderApp();
  } catch (error) {
    const protocolHint = window.location.protocol === "file:"
      ? "現在は file:// で開かれているため JSON を読み込めません。Docker で http://127.0.0.1:8080 を開いてください。"
      : "JSON シードデータの読み込みに失敗しました。Docker コンテナが起動しているか確認してください。";
    renderAuthNotice(protocolHint, "error");
    renderApp();
  }
}

initApp();
