"""Add bonus points to users."""

from alembic import op
import sqlalchemy as sa


revision = "0005_bonus_points"
down_revision = "0004_live_discussion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bonus_points", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("users", "bonus_points")
