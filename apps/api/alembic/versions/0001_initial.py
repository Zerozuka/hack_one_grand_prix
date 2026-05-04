"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    user_role = postgresql.ENUM("platform_admin", "community_manager", "member", name="user_role", create_type=False)
    node_role = postgresql.ENUM("core", "new", "bridge", "isolated", name="node_role", create_type=False)
    relationship_type = postgresql.ENUM("known", "talked", "event", "project", name="relationship_type", create_type=False)
    sos_status = postgresql.ENUM("active", "resolved", name="sos_status", create_type=False)
    tag_kind = postgresql.ENUM("interest", "goal", "activity", name="tag_kind", create_type=False)

    bind = op.get_bind()
    user_role.create(bind, checkfirst=True)
    node_role.create(bind, checkfirst=True)
    relationship_type.create(bind, checkfirst=True)
    sos_status.create(bind, checkfirst=True)
    tag_kind.create(bind, checkfirst=True)

    op.create_table(
        "communities",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("subtitle", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("group_code", sa.String(length=64), nullable=False),
        sa.Column("node_role", node_role, nullable=False),
        sa.Column("availability", sa.String(length=128), nullable=True),
        sa.Column("bio", sa.Text(), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "community_memberships",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("community_id", sa.String(length=64), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("community_id", "user_id", name="uq_community_membership"),
    )
    op.create_table(
        "auth_identities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("provider", sa.String(length=128), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("provider", "subject", name="uq_auth_identity_provider_subject"),
    )
    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("kind", tag_kind, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.UniqueConstraint("kind", "name", name="uq_tag_kind_name"),
    )
    op.create_table(
        "user_tags",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("user_id", "tag_id", name="uq_user_tag"),
    )
    op.create_table(
        "relationships",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("community_id", sa.String(length=64), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", relationship_type, nullable=False),
        sa.Column("strength", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("community_id", sa.String(length=64), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("time_label", sa.String(length=255), nullable=False),
        sa.Column("format", sa.Text(), nullable=False),
    )
    op.create_table(
        "event_participants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_id", sa.String(length=64), sa.ForeignKey("events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("event_id", "user_id", name="uq_event_participant"),
    )
    op.create_table(
        "courses",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("course_title", sa.String(length=255), nullable=False),
        sa.Column("instructor", sa.String(length=255), nullable=False),
        sa.Column("term", sa.String(length=64), nullable=False),
        sa.Column("day", sa.String(length=64), nullable=False),
        sa.Column("period", sa.String(length=64), nullable=False),
        sa.Column("program", sa.String(length=255), nullable=False),
        sa.Column("grade", sa.String(length=255), nullable=False),
        sa.Column("credits", sa.String(length=64), nullable=False),
        sa.Column("contents", sa.Text(), nullable=False),
        sa.Column("grading", sa.Text(), nullable=False),
        sa.Column("textbook", sa.Text(), nullable=False),
        sa.Column("reference", sa.Text(), nullable=False),
    )
    op.create_table(
        "course_topics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("course_id", sa.String(length=64), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("topic", sa.Text(), nullable=False),
    )
    op.create_table(
        "course_departments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("course_id", sa.String(length=64), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.UniqueConstraint("course_id", "name", name="uq_course_department"),
    )
    op.create_table(
        "sos_requests",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("community_id", sa.String(length=64), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic", sa.Text(), nullable=False),
        sa.Column("status", sos_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "sos_responses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("request_id", sa.String(length=64), sa.ForeignKey("sos_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("responder_user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("actor_user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("resource_type", sa.String(length=128), nullable=False),
        sa.Column("resource_id", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index("ix_users_name_trgm", "users", ["name"], postgresql_using="gin", postgresql_ops={"name": "gin_trgm_ops"})
    op.create_index("ix_users_bio_trgm", "users", ["bio"], postgresql_using="gin", postgresql_ops={"bio": "gin_trgm_ops"})
    op.create_index("ix_courses_title_trgm", "courses", ["course_title"], postgresql_using="gin", postgresql_ops={"course_title": "gin_trgm_ops"})
    op.create_index("ix_courses_instructor_trgm", "courses", ["instructor"], postgresql_using="gin", postgresql_ops={"instructor": "gin_trgm_ops"})
    op.create_index("ix_courses_contents_trgm", "courses", ["contents"], postgresql_using="gin", postgresql_ops={"contents": "gin_trgm_ops"})


def downgrade() -> None:
    op.drop_index("ix_courses_contents_trgm", table_name="courses")
    op.drop_index("ix_courses_instructor_trgm", table_name="courses")
    op.drop_index("ix_courses_title_trgm", table_name="courses")
    op.drop_index("ix_users_bio_trgm", table_name="users")
    op.drop_index("ix_users_name_trgm", table_name="users")
    for table_name in [
        "audit_logs",
        "sos_responses",
        "sos_requests",
        "course_departments",
        "course_topics",
        "courses",
        "event_participants",
        "events",
        "relationships",
        "user_tags",
        "tags",
        "auth_identities",
        "community_memberships",
        "users",
        "communities",
    ]:
        op.drop_table(table_name)
    bind = op.get_bind()
    sa.Enum(name="tag_kind").drop(bind, checkfirst=True)
    sa.Enum(name="sos_status").drop(bind, checkfirst=True)
    sa.Enum(name="relationship_type").drop(bind, checkfirst=True)
    sa.Enum(name="node_role").drop(bind, checkfirst=True)
    sa.Enum(name="user_role").drop(bind, checkfirst=True)
