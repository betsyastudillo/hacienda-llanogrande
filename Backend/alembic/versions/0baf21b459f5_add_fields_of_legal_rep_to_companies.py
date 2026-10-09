"""add fields of legal rep to companies

Revision ID: 0baf21b459f5
Revises: bc76cfdcd55f
Create Date: 2026-10-09 09:48:14.263008

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0baf21b459f5'
down_revision: Union[str, Sequence[str], None] = 'bc76cfdcd55f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('legal_rep_name', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('legal_rep_document_type', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('legal_rep_document_number', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('legal_rep_email', sa.String(), nullable=True))
    op.add_column('companies', sa.Column('legal_rep_city', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('companies', 'legal_rep_city')
    op.drop_column('companies', 'legal_rep_email')
    op.drop_column('companies', 'legal_rep_document_number')
    op.drop_column('companies', 'legal_rep_document_type')
    op.drop_column('companies', 'legal_rep_name')
