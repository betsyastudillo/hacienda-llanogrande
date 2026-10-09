"""add fields to compliance_check

Revision ID: 77dbc0ab0d79
Revises: cb93789ef0a8
Create Date: 2026-10-09 11:06:50.252519

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '77dbc0ab0d79'
down_revision: Union[str, Sequence[str], None] = 'cb93789ef0a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('compliance_checks', sa.Column('subject', sa.String(), nullable=False, server_default='company'))
    op.drop_constraint('uq_compliance_check_company_key', 'compliance_checks', type_='unique')
    op.create_unique_constraint(
        'uq_compliance_check_company_subject_key', 'compliance_checks',
        ['company_id', 'subject', 'check_key'],
    )


def downgrade() -> None:
    op.execute("DELETE FROM compliance_checks WHERE subject <> 'company'")
    op.drop_constraint('uq_compliance_check_company_subject_key', 'compliance_checks', type_='unique')
    op.create_unique_constraint('uq_compliance_check_company_key', 'compliance_checks', ['company_id', 'check_key'])
    op.drop_column('compliance_checks', 'subject')
