"""add performance indexes

Revision ID: f2924d0b909d
Revises: 77dbc0ab0d79
Create Date: 2026-10-09 14:24:54.922722

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2924d0b909d'
down_revision: Union[str, Sequence[str], None] = '77dbc0ab0d79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RENAMES = [
    # (tabla, nombre viejo, nombre nuevo)
    ("products", "materials_pkey", "products_pkey"),
    ("products", "materials_created_by_user_id_fkey", "products_created_by_user_id_fkey"),
    ("products", "materials_updated_by_user_id_fkey", "products_updated_by_user_id_fkey"),
    ("products", "materials_deleted_by_user_id_fkey", "products_deleted_by_user_id_fkey"),
    ("products", "materials_parent_material_id_fkey", "products_parent_product_id_fkey"),
    ("order_items", "order_items_material_id_fkey", "order_items_product_id_fkey"),
    ("inventory_movements", "inventory_movements_material_id_fkey", "inventory_movements_product_id_fkey"),
]

INDEXES = [
    ('ix_orders_company_id', 'orders', 'company_id'),
    ('ix_orders_created_by_user_id', 'orders', 'created_by_user_id'),
    ('ix_orders_created_at', 'orders', 'created_at'),
    ('ix_order_items_order_id', 'order_items', 'order_id'),
    ('ix_inventory_movements_order_id', 'inventory_movements', 'order_id'),
    ('ix_inventory_product_created', 'inventory_movements', 'product_id, created_at'),
    ('ix_documents_company_id', 'documents', 'company_id'),
]


def _rename_if_exists(table: str, old: str, new: str) -> None:
    op.execute(f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = '{old}' AND conrelid = '{table}'::regclass
            ) THEN
                ALTER TABLE {table} RENAME CONSTRAINT {old} TO {new};
            END IF;
        END $$;
    """)


def upgrade() -> None:
    for name, table, cols in INDEXES:
        op.execute(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})")

    for table, old, new in RENAMES:
        _rename_if_exists(table, old, new)


def downgrade() -> None:
    for table, old, new in reversed(RENAMES):
        _rename_if_exists(table, new, old)

    for name, _, _ in reversed(INDEXES):
        op.execute(f"DROP INDEX IF EXISTS {name}")