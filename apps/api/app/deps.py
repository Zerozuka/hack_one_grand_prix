from dataclasses import dataclass
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import AuthIdentity, Community, CommunityMembership, NodeRole, User, UserRole
from app.security import decode_internal_token


@dataclass
class RequestContext:
    user: User
    memberships: list[CommunityMembership]

    def role_for(self, community_id: str) -> UserRole | None:
        for membership in self.memberships:
            if membership.community_id == community_id:
                return membership.role
        return None

    def is_platform_admin(self) -> bool:
        return any(membership.role == UserRole.platform_admin for membership in self.memberships)

    def can_manage(self, community_id: str) -> bool:
        role = self.role_for(community_id)
        return self.is_platform_admin() or role == UserRole.community_manager


def get_request_context(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> RequestContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_internal_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user = None
    user_id = payload.get("user_id")
    if user_id:
        user = db.get(User, user_id)
    else:
        provider = payload.get("provider")
        subject = payload.get("subject")
        if not provider or not subject:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing identity claims")
        identity = db.scalar(
            select(AuthIdentity).where(
                AuthIdentity.provider == provider,
                AuthIdentity.subject == subject,
            )
        )
        if identity is None:
            settings = get_settings()
            community = db.get(Community, settings.default_community_id)
            if community is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Default community not found")
            user = User(
                id=f"user-{uuid4()}",
                name=payload.get("name") or payload.get("email") or "New Member",
                group_code="undeclared",
                node_role=NodeRole.new,
                availability="要調整",
                bio="OIDC 初回ログインで自動作成されたプロフィールです。",
            )
            db.add(user)
            db.flush()
            db.add(
                CommunityMembership(
                    community_id=community.id,
                    user_id=user.id,
                    role=UserRole.member,
                    is_primary=True,
                )
            )
            db.add(
                AuthIdentity(
                    provider=provider,
                    subject=subject,
                    email=payload.get("email"),
                    user_id=user.id,
                )
            )
            db.commit()
        else:
            user = db.get(User, identity.user_id)

    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")

    memberships = db.scalars(select(CommunityMembership).where(CommunityMembership.user_id == user.id)).all()
    return RequestContext(user=user, memberships=list(memberships))


def ensure_can_manage(context: RequestContext, community_id: str) -> None:
    if not context.can_manage(community_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def ensure_self_or_manager(context: RequestContext, user: User, community_id: str) -> None:
    if context.user.id == user.id or context.can_manage(community_id):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
