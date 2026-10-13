"""add tabla invoices

Revision ID: 14e6f72f401c
Revises: f2924d0b909d
Create Date: 2026-10-09 16:35:39.034242

"""
from typing import Sequence, Union
from sqlalchemy.dialects import postgresql
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '14e6f72f401c'
down_revision: Union[str, Sequence[str], None] = 'f2924d0b909d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=False, unique=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('subtotal', sa.Numeric(12, 2), nullable=False),
        sa.Column('tax', sa.Numeric(12, 2), nullable=False),
        sa.Column('total', sa.Numeric(12, 2), nullable=False),
        sa.Column('invoice_number', sa.String(), nullable=True, unique=True),
        sa.Column('cufe', sa.String(), nullable=True),
        sa.Column('issued_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pdf_url', sa.String(), nullable=True),
        sa.Column('xml_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('updated_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('deleted_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
    )

    # Pedidos que ya tenían el pago confirmado antes de esta funcionalidad
    op.execute("""
        INSERT INTO invoices (id, order_id, status, subtotal, tax, total)
        SELECT gen_random_uuid(), id, 'pending', subtotal, tax, total
        FROM orders
        WHERE status <> 'created'
    """)


def downgrade() -> None:
    op.drop_table('invoices')