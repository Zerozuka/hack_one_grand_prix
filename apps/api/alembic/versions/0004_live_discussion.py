"""add live discussion fields to events

Revision ID: 0004_live_discussion
Revises: 0003_auth_password
Create Date: 2026-05-05
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_live_discussion"
down_revision = "0003_auth_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("is_live", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("events", sa.Column("location", sa.String(255), nullable=True))
    op.add_column("events", sa.Column("sos_request_id", sa.String(64), nullable=True))
    op.add_column("events", sa.Column("creator_user_id", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("events", "creator_user_id")
    op.drop_column("events", "sos_request_id")
    op.drop_column("events", "location")
    op.drop_column("events", "is_live")
