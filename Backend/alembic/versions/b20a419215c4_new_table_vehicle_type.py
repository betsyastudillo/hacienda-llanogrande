"""new table vehicle_type

Revision ID: b20a419215c4
Revises: d70365204055
Create Date: 2026-10-30 14:09:52.969948

"""
from typing import Sequence, Union

import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b20a419215c4'
down_revision: Union[str, Sequence[str], None] = 'd70365204055'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
  op.create_table(
    "vehicle_types",
    sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
    sa.Column("code", sa.String(20), nullable=False, unique=True),
    sa.Column("name", sa.String(50), nullable=False),
    sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
    sa.Column('updated_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
    sa.Column('deleted_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
  )

  table = sa.table("vehicle_types",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("code", sa.String), sa.column("name", sa.String), sa.column("is_active", sa.Boolean))

  # Los tipos que hoy están en el código, para que los vehículos existentes sigan siendo válidos
  op.bulk_insert(table, [
    {"id": uuid.uuid4(), "code": "camioneta", "name": "Camioneta", "is_active": True},
    {"id": uuid.uuid4(), "code": "camion_sencillo", "name": "Camión sencillo", "is_active": True},
    {"id": uuid.uuid4(), "code": "doble_troque", "name": "Doble troque", "is_active": True},
    {"id": uuid.uuid4(), "code": "tractomula", "name": "Tractomula", "is_active": True},
    {"id": uuid.uuid4(), "code": "volqueta", "name": "Volqueta", "is_active": True},
  ])

def downgrade():
  op.drop_table("vehicle_types")