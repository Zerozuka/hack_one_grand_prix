"""add password_hash to auth_identities

Revision ID: 0003_auth_password
Revises: 0002_sos_chat
Create Date: 2026-05-04
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_auth_password"
down_revision = "0002_sos_chat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "auth_identities",
        sa.Column("password_hash", sa.String(128), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("auth_identities", "password_hash")
