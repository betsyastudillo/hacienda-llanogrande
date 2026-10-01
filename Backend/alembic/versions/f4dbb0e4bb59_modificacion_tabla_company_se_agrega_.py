"""modificacion tabla company, se agrega document_type, se modifica nit por document_number y se modifica type por company_type

Revision ID: f4dbb0e4bb59
Revises: caa6033d4077
Create Date: 2026-10-01 14:28:00.211133

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4dbb0e4bb59'
down_revision: Union[str, Sequence[str], None] = 'caa6033d4077'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('companies', 'nit', new_column_name='document_number')
    op.alter_column('companies', 'type', new_column_name='company_type')
    op.add_column('companies', sa.Column('document_type', sa.String(), nullable=False, server_default='NIT'))


def downgrade() -> None:
    op.drop_column('companies', 'document_type')
    op.alter_column('companies', 'company_type', new_column_name='type')
    op.alter_column('companies', 'document_number', new_column_name='nit')