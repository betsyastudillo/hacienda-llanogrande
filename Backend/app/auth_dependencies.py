from typing import Annotated
from fastapi import Depends
from app.models.user import User
from app.dependencies import get_current_user, require_any_permission, require_permission

# Tiene permisos para todo
AdminOnly = Annotated[User, Depends(require_permission("*"))]

UserManager = Annotated[User, Depends(require_permission("user:gestionar"))]
CurrentUser = Annotated[User, Depends(get_current_user)]

# Payment
PaymentViewerAny = Annotated[User, Depends(require_any_permission("payment:ver", "payment:ver_propio"))]
PaymentCreator = Annotated[User, Depends(require_permission("payment:crear"))]
PaymentConfirmer = Annotated[User, Depends(require_permission("payment:confirmar"))]
PaymentViewer = Annotated[User, Depends(require_permission("payment:ver"))]
PaymentViewerOwn = Annotated[User, Depends(require_permission("payment:ver_propio"))]

# BankAccount
BankAccountManager = Annotated[User, Depends(require_permission("bank_account:gestionar"))]
BankAccountViewer = Annotated[User, Depends(require_permission("bank_account:ver"))]

# Company
CompanyManager = Annotated[User, Depends(require_permission("company:gestionar"))]
CompanyViewer = Annotated[User, Depends(require_permission("company:ver"))]

# Vehicle / Carrier
VehicleManager = Annotated[User, Depends(require_permission("vehicle:gestionar"))]
VehicleViewer = Annotated[User, Depends(require_permission("vehicle:ver"))]
CarrierManager = Annotated[User, Depends(require_permission("carrier:gestionar"))]
CarrierViewer = Annotated[User, Depends(require_permission("carrier:ver"))]

# Assignment 
AssignmentValidator = Annotated[User, Depends(require_permission("assignment:validar"))]
AssignmentViewer = Annotated[User, Depends(require_permission("assignment:ver"))]
AssignmentCreatorOwn = Annotated[User, Depends(require_permission("assignment:crear_propio"))]
AssignmentViewerAny = Annotated[User, Depends(require_any_permission(
    "assignment:ver", "assignment:ver_propio"
))]

# DispatchGuide
DispatchGuideCreator = Annotated[User, Depends(require_permission("dispatch_guide:crear"))]
DispatchGuideViewer = Annotated[User, Depends(require_permission("dispatch_guide:ver"))]
DispatchGuideViewerAny = Annotated[User, Depends(require_any_permission(
    "dispatch_guide:ver", "dispatch_guide:ver_propio"
))]
DispatchGuideViewerOwn = Annotated[User, Depends(require_permission("dispatch_guide:ver_propio"))]

# Producto 
ProductManager = Annotated[User, Depends(require_permission("product:gestionar"))]

# Document 
DocumentReviewer = Annotated[User, Depends(require_permission("document:revisar"))]
DocumentViewer = Annotated[User, Depends(require_permission("document:ver"))]

# Order 
OrderCreator = Annotated[User, Depends(require_permission("order:crear"))]
OrderViewerAny = Annotated[User, Depends(require_any_permission(
    "order:ver_todos", "order:ver_empresa", "order:ver_propios"
))]
OrderViewerAll = Annotated[User, Depends(require_permission("order:ver_todos"))]
OrderViewerCompany = Annotated[User, Depends(require_permission("order:ver_empresa"))]
OrderViewerOwn = Annotated[User, Depends(require_permission("order:ver_propios"))]
OrderEditorOwn = Annotated[User, Depends(require_permission("order:editar_propio"))]
OrderEditorLimited = Annotated[User, Depends(require_permission("order:editar_limitado"))]

# BlackList
BlacklistManager = Annotated[User, Depends(require_permission("blacklist:gestionar"))]

# InventoryManager
InventoryManager = Annotated[User, Depends(require_permission("inventory:gestionar"))]
InventoryViewer = Annotated[User, Depends(require_permission("inventory:ver"))]