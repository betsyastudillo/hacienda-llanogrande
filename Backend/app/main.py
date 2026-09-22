from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.routers import company, document, auth, user, material, order, vehicle, carrier, assignment, payment, dispatch_guide, bank_account, document_blacklist

app = FastAPI(title="Hacienda Llanogrande API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.include_router(auth.router)
app.include_router(company.router)
app.include_router(document.router)
app.include_router(user.router)
app.include_router(material.router)
app.include_router(order.router)
app.include_router(vehicle.router)
app.include_router(carrier.router)
app.include_router(assignment.router)
app.include_router(payment.router)
app.include_router(dispatch_guide.router)
app.include_router(bank_account.router)
app.include_router(document_blacklist.router)

@app.get("/")
def root():
    return {"status": "ok"}
