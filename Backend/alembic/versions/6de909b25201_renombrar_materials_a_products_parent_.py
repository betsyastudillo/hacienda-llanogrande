"""renombrar materials a products, parent_product_id a parent_product_id

Revision ID: 6de909b25201
Revises: 6e8be909083f
Create Date: 2026-09-25 11:06:37.573538

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6de909b25201'
down_revision: Union[str, Sequence[str], None] = '6e8be909083f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Renombrar la tabla principal
    op.rename_table('materials', 'products')

    # 2. Renombrar la columna de auto-referencia (paquete -> producto base)
    op.alter_column('products', 'parent_material_id', new_column_name='parent_product_id')

    # 3. Renombrar la FK en order_items
    op.alter_column('order_items', 'material_id', new_column_name='product_id')

    # 4. Renombrar la FK en inventory_movements
    op.alter_column('inventory_movements', 'material_id', new_column_name='product_id')


def downgrade() -> None:
    op.alter_column('inventory_movements', 'product_id', new_column_name='material_id')
    op.alter_column('order_items', 'product_id', new_column_name='material_id')
    op.alter_column('products', 'parent_product_id', new_column_name='parent_material_id')
    op.rename_table('products', 'materials')
