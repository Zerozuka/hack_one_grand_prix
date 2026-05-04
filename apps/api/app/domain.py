from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass

from app.models import NodeRole, Relationship, User

SYNONYM_MAP = {
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
}


ROLE_LABELS = {
    NodeRole.core: "キーノード",
    NodeRole.new: "新規参加",
    NodeRole.bridge: "橋渡し候補",
    NodeRole.isolated: "孤立ノード",
}


GROUP_LABELS = {
    "newcomer": "新入生",
    "math": "数学",
    "cs": "情報科学",
    "physics": "物理",
    "design": "デザイン",
    "social": "社会科学",
    "interdisciplinary": "学際",
    "local": "地域連携",
    "international": "国際交流",
    "tech": "技術",
    "media": "メディア",
    "research": "研究",
    "event": "イベント運営",
    "community": "コミュニティ",
}


def expand_keywords(keywords: list[str]) -> list[str]:
    expanded = {keyword.lower() for keyword in keywords}
    for keyword in keywords:
        lower = keyword.lower()
        for key, values in SYNONYM_MAP.items():
            lower_key = key.lower()
            lower_values = [value.lower() for value in values]
            if lower_key == lower or lower in lower_values:
                expanded.add(lower_key)
                expanded.update(lower_values)
            if lower_key in lower or lower in lower_key:
                expanded.add(lower_key)
    return list(expanded)


def intersection(left_items: list[str], right_items: list[str]) -> list[str]:
    right_set = set(right_items)
    return [item for item in left_items if item in right_set]


def neighbor_map(users: list[User], relationships: list[Relationship]) -> dict[str, list[str]]:
    neighbors = {user.id: [] for user in users}
    for relationship in relationships:
        if relationship.from_user_id in neighbors:
            neighbors[relationship.from_user_id].append(relationship.to_user_id)
        if relationship.to_user_id in neighbors:
            neighbors[relationship.to_user_id].append(relationship.from_user_id)
    return neighbors


def degree_of(user_id: str, neighbors: dict[str, list[str]]) -> int:
    return len(neighbors.get(user_id, []))


def relationship_exists(left_user_id: str, right_user_id: str, relationships: list[Relationship]) -> bool:
    return any(
        (
            relationship.from_user_id == left_user_id
            and relationship.to_user_id == right_user_id
        )
        or (
            relationship.from_user_id == right_user_id
            and relationship.to_user_id == left_user_id
        )
        for relationship in relationships
    )


def bridge_potential(user: User, users: list[User], relationships: list[Relationship], user_tags: dict[str, dict[str, list[str]]]) -> int:
    score = 0
    current_tags = user_tags[user.id]
    for candidate in users:
        if candidate.id == user.id or relationship_exists(user.id, candidate.id, relationships):
            continue
        candidate_tags = user_tags[candidate.id]
        cross_group = int(candidate.group_code != user.group_code)
        common_interests = len(intersection(current_tags["interests"], candidate_tags["interests"]))
        common_goals = len(intersection(current_tags["goals"], candidate_tags["goals"]))
        role_boost = 2 if user.node_role == NodeRole.bridge else 0
        score += cross_group * 4 + common_interests * 2 + common_goals * 2 + role_boost
    return score


def connected_clusters(users: list[User], relationships: list[Relationship]) -> list[list[str]]:
    neighbors = neighbor_map(users, relationships)
    seen: set[str] = set()
    clusters: list[list[str]] = []
    for user in users:
        if user.id in seen:
            continue
        queue: deque[str] = deque([user.id])
        cluster: list[str] = []
        seen.add(user.id)
        while queue:
            current = queue.popleft()
            cluster.append(current)
            for nxt in neighbors.get(current, []):
                if nxt not in seen:
                    seen.add(nxt)
                    queue.append(nxt)
        clusters.append(cluster)
    return clusters


def density_percent(users: list[User], relationships: list[Relationship]) -> int:
    if len(users) <= 1:
        return 0
    all_possible = (len(users) * (len(users) - 1)) / 2
    return round((len(relationships) / all_possible) * 100)


def recommendation_score(
    mode: str,
    base_user: User,
    candidate: User,
    relationships: list[Relationship],
    user_tags: dict[str, dict[str, list[str]]],
    neighbors: dict[str, list[str]],
) -> int:
    base = user_tags[base_user.id]
    other = user_tags[candidate.id]
    common_interests = len(intersection(base["interests"], other["interests"]))
    common_goals = len(intersection(base["goals"], other["goals"]))
    shared_availability = int((base_user.availability or "") == (candidate.availability or "") and bool(base_user.availability))
    cross_group = int(base_user.group_code != candidate.group_code)
    isolation_support = int(degree_of(base_user.id, neighbors) <= 1 or degree_of(candidate.id, neighbors) <= 1)
    bridge_boost = int(candidate.node_role == NodeRole.bridge)
    role_complement = int(base_user.node_role != candidate.node_role)
    base_expanded = set(expand_keywords(base["interests"]))
    candidate_expanded = expand_keywords(other["interests"])
    semantic_overlap = sum(1 for token in candidate_expanded if token in base_expanded)
    semantic_bonus = min(semantic_overlap, 6)

    if mode == "similar":
        return common_interests * 16 + common_goals * 12 + shared_availability * 8 + isolation_support * 4 + semantic_bonus * 4
    if mode == "complementary":
        return cross_group * 10 + role_complement * 12 + common_goals * 10 + common_interests * 6 + bridge_boost * 6
    return cross_group * 16 + bridge_boost * 10 + common_goals * 8 + common_interests * 6 + isolation_support * 8 + semantic_bonus * 2


def recommendation_reasons(base_user: User, candidate: User, user_tags: dict[str, dict[str, list[str]]], neighbors: dict[str, list[str]]) -> list[str]:
    base = user_tags[base_user.id]
    other = user_tags[candidate.id]
    common_interests = intersection(base["interests"], other["interests"])
    common_goals = intersection(base["goals"], other["goals"])
    reasons: list[str] = []
    if common_interests:
        reasons.append(f"共通の知見: {' / '.join(common_interests[:2])}")
    if common_goals:
        reasons.append(f"学びたい方向が近い: {' / '.join(common_goals[:2])}")
    if base_user.group_code != candidate.group_code:
        reasons.append("別分野の知見を持っている")
    if base_user.availability and base_user.availability == candidate.availability:
        reasons.append(f"活動時間帯が近い: {base_user.availability}")
    if degree_of(base_user.id, neighbors) <= 1 or degree_of(candidate.id, neighbors) <= 1:
        reasons.append("孤立ノード解消につながる")
    return reasons[:4]


@dataclass
class RecommendationResult:
    user_id: str
    score: int
    reasons: list[str]


def build_recommendations(
    base_user: User,
    users: list[User],
    relationships: list[Relationship],
    user_tags: dict[str, dict[str, list[str]]],
    mode: str,
) -> list[RecommendationResult]:
    neighbors = neighbor_map(users, relationships)
    results: list[RecommendationResult] = []
    for candidate in users:
        if candidate.id == base_user.id or relationship_exists(base_user.id, candidate.id, relationships):
            continue
        results.append(
            RecommendationResult(
                user_id=candidate.id,
                score=recommendation_score(mode, base_user, candidate, relationships, user_tags, neighbors),
                reasons=recommendation_reasons(base_user, candidate, user_tags, neighbors),
            )
        )
    results.sort(key=lambda item: item.score, reverse=True)
    return results[:4]


def build_introductions(base_user: User, recommendations: list[RecommendationResult], users_by_id: dict[str, User], user_tags: dict[str, dict[str, list[str]]]) -> list[dict[str, str]]:
    ideas: list[dict[str, str]] = []
    for entry in recommendations[:3]:
        candidate = users_by_id[entry.user_id]
        same_interest = intersection(user_tags[base_user.id]["interests"], user_tags[candidate.id]["interests"])
        format_label = "5分Sync"
        if base_user.group_code != candidate.group_code:
            format_label = "分野横断ミニセッション"
        elif "線形代数" in same_interest or "統計" in same_interest:
            format_label = "もくもく勉強会"
        elif same_interest:
            format_label = "テーマ別ペアリング"
        ideas.append(
            {
                "title": f"{base_user.name} × {candidate.name}",
                "format": format_label,
                "body": entry.reasons[0] if entry.reasons else "知見ネットワークを広げる入口になれる組み合わせです。",
            }
        )
    return ideas


def build_course_matches(course_terms: list[str], users: list[User], user_tags: dict[str, dict[str, list[str]]]) -> list[dict[str, object]]:
    if not course_terms:
        return []
    expanded_terms = expand_keywords(course_terms)
    term_set = set(expanded_terms)
    results: list[dict[str, object]] = []
    for user in users:
        tags = user_tags[user.id]
        matched_interests = [
            interest for interest in tags["interests"]
            if interest.lower() in term_set or any(token in term_set for token in expand_keywords([interest]))
        ]
        matched_goals: list[str] = []
        for goal in tags["goals"]:
            keywords = [word for word in goal.replace("、", " ").split() if len(word) >= 2]
            if any(keyword in term_set for keyword in expand_keywords(keywords)):
                matched_goals.append(goal)
        raw_text = " ".join(course_terms).lower()
        direct_interests = [interest for interest in tags["interests"] if interest.lower() in raw_text]
        semantic_bonus = len(matched_interests) - len(direct_interests)
        score = len(direct_interests) * 4 + semantic_bonus * 2 + len(matched_goals) * 2
        if score > 0:
            results.append(
                {
                    "user_id": user.id,
                    "matched_interests": matched_interests,
                    "matched_goals": matched_goals,
                    "score": score,
                }
            )
    results.sort(key=lambda item: item["score"], reverse=True)
    return results


def group_label(group_code: str) -> str:
    return GROUP_LABELS.get(group_code, group_code)

