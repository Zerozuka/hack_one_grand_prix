"""add sos chat

Revision ID: 0002_sos_chat
Revises: 0001_initial
Create Date: 2026-05-04
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_sos_chat"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sos_chats",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("request_id", sa.String(length=64), sa.ForeignKey("sos_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("community_id", sa.String(length=64), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requester_user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("responder_user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("request_id", name="uq_sos_chat_request"),
    )
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("chat_id", sa.String(length=64), sa.ForeignKey("sos_chats.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chat_messages_chat_created", "chat_messages", ["chat_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_chat_created", table_name="chat_messages")
    op.drop_table("chat_messages")
    op.drop_table("sos_chats")
