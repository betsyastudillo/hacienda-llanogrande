"""partial dispatches

Revision ID: caffaa585f24
Revises: 9f17c7df6f41
Create Date: 2026-11-05 12:43:26.393005

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql



# revision identifiers, used by Alembic.
revision: str = 'caffaa585f24'
down_revision: Union[str, Sequence[str], None] = '9f17c7df6f41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
  # Assignments: un pedido puede tener varios retiros
  op.drop_constraint("assignments_order_id_key", "assignments", type_="unique")
  op.create_index("ix_assignments_order_id", "assignments", ["order_id"])
  op.add_column("assignments", sa.Column("sequence", sa.Integer(), nullable=False, server_default="1"))
  op.alter_column("assignments", "sequence", server_default=None)
  op.create_unique_constraint("uq_assignments_order_sequence", "assignments", ["order_id", "sequence"])
  op.add_column("assignments", sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))
  op.add_column("assignments", sa.Column("cancellation_reason", sa.String(255), nullable=True))

  # Cantidades de cada retiro
  op.create_table(
    "assignment_items",
    sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
    sa.Column("assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("assignments.id"), nullable=False),
    sa.Column("order_item_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("order_items.id"), nullable=False),
    sa.Column("quantity", sa.Integer(), nullable=False),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    sa.Column("created_by_user_id", sa.UUID(), nullable=True),
    sa.Column("updated_by_user_id", sa.UUID(), nullable=True),
    sa.Column("deleted_by_user_id", sa.UUID(), nullable=True),
    sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
    sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
    sa.ForeignKeyConstraint(["deleted_by_user_id"], ["users.id"]),
    sa.UniqueConstraint("assignment_id", "order_item_id", name="uq_assignment_items_assignment_order_item"),
    sa.CheckConstraint("quantity > 0", name="ck_assignment_items_quantity_positive"),
  )
  op.create_index("ix_assignment_items_assignment_id", "assignment_items", ["assignment_id"])

  # Guías: una por retiro
  op.drop_constraint("dispatch_guides_order_id_key", "dispatch_guides", type_="unique")
  op.create_index("ix_dispatch_guides_order_id", "dispatch_guides", ["order_id"])
  op.add_column("dispatch_guides", sa.Column("assignment_id", postgresql.UUID(as_uuid=True), nullable=False))
  op.create_foreign_key("dispatch_guides_assignment_id_fkey", "dispatch_guides", "assignments", ["assignment_id"], ["id"])
  op.create_unique_constraint("dispatch_guides_assignment_id_key", "dispatch_guides", ["assignment_id"])
  op.add_column("dispatch_guides", sa.Column("balance_detail", sa.Text(), nullable=True))


def downgrade() -> None:
  op.drop_column("dispatch_guides", "balance_detail")
  op.drop_constraint("dispatch_guides_assignment_id_key", "dispatch_guides", type_="unique")
  op.drop_constraint("dispatch_guides_assignment_id_fkey", "dispatch_guides", type_="foreignkey")
  op.drop_column("dispatch_guides", "assignment_id")
  op.drop_index("ix_dispatch_guides_order_id", table_name="dispatch_guides")
  op.create_unique_constraint("dispatch_guides_order_id_key", "dispatch_guides", ["order_id"])

  op.drop_index("ix_assignment_items_assignment_id", table_name="assignment_items")
  op.drop_table("assignment_items")
  op.drop_column("assignments", "cancellation_reason")
  op.drop_column("assignments", "cancelled_at")
  op.drop_constraint("uq_assignments_order_sequence", "assignments", type_="unique")
  op.drop_column("assignments", "sequence")
  op.drop_index("ix_assignments_order_id", table_name="assignments")
  op.create_unique_constraint("assignments_order_id_key", "assignments", ["order_id"])