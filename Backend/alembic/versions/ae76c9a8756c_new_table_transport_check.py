"""new table transport_check

Revision ID: ae76c9a8756c
Revises: 404f1b66a7f6
Create Date: 2026-10-26 17:12:25.718918

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'ae76c9a8756c'
down_revision: Union[str, Sequence[str], None] = '404f1b66a7f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  op.create_table(
    'transport_checks',
    sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
    sa.Column('assignment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('assignments.id'), nullable=False),
    sa.Column('subject', sa.String(), nullable=False),
    sa.Column('check_key', sa.String(), nullable=False),
    sa.Column('has_findings', sa.Boolean(), nullable=False),
    sa.Column('note', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
    sa.Column('updated_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
    sa.Column('deleted_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
    sa.UniqueConstraint('assignment_id', 'subject', 'check_key', name='uq_transport_check'),
  )


def downgrade() -> None:
    op.drop_table('transport_checks')