"""add order_number and order_counters

Revision ID: bc76cfdcd55f
Revises: d2cd0c825bfd
Create Date: 2026-10-08 14:11:51.208785

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc76cfdcd55f'
down_revision: Union[str, Sequence[str], None] = 'd2cd0c825bfd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        'order_counters',
        sa.Column('year', sa.Integer(), primary_key=True),
        sa.Column('last_number', sa.Integer(), nullable=False, server_default='0'),
    )

    # 1) Nullable, para poder rellenar los pedidos existentes
    op.add_column('orders', sa.Column('order_number', sa.String(), nullable=True))

    # 2) Relleno: PED-AAAA-0001... en orden de creación, reiniciando por año
    op.execute("""
      WITH numbered AS (
        SELECT id,
              EXTRACT(YEAR FROM created_at)::int AS yr,
              ROW_NUMBER() OVER (
                  PARTITION BY EXTRACT(YEAR FROM created_at)
                  ORDER BY created_at, id
              ) AS rn
        FROM orders
      )
      UPDATE orders o
      SET order_number = 'PED-' || n.yr || '-' || LPAD(n.rn::text, 4, '0')
      FROM numbered n
      WHERE o.id = n.id
    """)

    # 3) El contador arranca desde el último número usado de cada año
    op.execute("""
      INSERT INTO order_counters (year, last_number)
      SELECT split_part(order_number, '-', 2)::int,
            MAX(split_part(order_number, '-', 3)::int)
      FROM orders
      GROUP BY 1
    """)

    # 4) Ahora sí obligatoria y única
    op.alter_column('orders', 'order_number', nullable=False)
    op.create_index('ix_orders_order_number', 'orders', ['order_number'], unique=True)


def downgrade():
    op.drop_index('ix_orders_order_number', table_name='orders')
    op.drop_column('orders', 'order_number')
    op.drop_table('order_counters')