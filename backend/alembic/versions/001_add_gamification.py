"""Add gamification: XP/level to children, achievements, word_mastery tables

Revision ID: 001
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "achievements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id"), index=True),
        sa.Column("achievement_type", sa.String(50), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("child_id", "achievement_type", name="uq_child_achievement"),
    )

    op.create_table(
        "word_mastery",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id"), index=True),
        sa.Column("word_id", sa.Integer(), sa.ForeignKey("words.id"), index=True),
        sa.Column("meaning_score", sa.Integer(), default=0),
        sa.Column("spelling_score", sa.Integer(), default=0),
        sa.Column("pronunciation_score", sa.Integer(), default=0),
        sa.Column("attempt_count", sa.Integer(), default=0),
        sa.Column("correct_streak", sa.Integer(), default=0),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_practiced_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("child_id", "word_id", name="uq_child_word_mastery"),
    )

    with op.batch_alter_table("children") as batch_op:
        batch_op.add_column(sa.Column("xp", sa.Integer(), server_default="0"))
        batch_op.add_column(sa.Column("level", sa.Integer(), server_default="1"))


def downgrade():
    with op.batch_alter_table("children") as batch_op:
        batch_op.drop_column("xp")
        batch_op.drop_column("level")
    op.drop_table("word_mastery")
    op.drop_table("achievements")
