# Dirección completa para los PDF de proforma y FE
def full_address(c) -> str:
    parts = [c.fiscal_address or c.address, c.city, c.department, c.country]
    return ", ".join(x for x in parts if x)