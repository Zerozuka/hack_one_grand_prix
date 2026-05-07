"""Add tags to SOS requests."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0006_sos_tags"
down_revision = "0005_bonus_points"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sos_requests",
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("sos_requests", "tags")
