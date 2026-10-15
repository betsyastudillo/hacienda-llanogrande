import json
import unicodedata
import requests
from collections import Counter, defaultdict

URL = "https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=2000"

rows = requests.get(URL, timeout=30).json()
print(f"Filas recibidas: {len(rows)}")
print("Tipos:", dict(Counter(r["tipo_municipio"] for r in rows)))

SMALL = {"de", "del", "la", "las", "los", "el", "y"}


def title(text):
  words = text.strip().lower().split()
  return " ".join(w if (i > 0 and w in SMALL) else w.capitalize() for i, w in enumerate(words))


# Los dos departamentos cuyo nombre no sale bien con solo pasar a formato título
DEPT_OVERRIDES = {
  "BOGOTÁ, D.C.": "Bogotá D.C.",
  "ARCHIPIÉLAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA": "San Andrés y Providencia",
}

by_dept = defaultdict(list)
for r in rows:
  # Las áreas no municipalizadas no son ciudades para una dirección
  if r["tipo_municipio"] == "Área no municipalizada":
    continue

  dept = DEPT_OVERRIDES.get(r["dpto"], title(r["dpto"]))
  name = "Bogotá D.C." if r["cod_mpio"] == "11001" else title(r["nom_mpio"])
  by_dept[dept].append({"name": name, "code": r["cod_mpio"]})

def sort_key(item):
  # Ordena ignorando tildes (si no, "Ábrego" quedaría después de "Zapatoca")
  return unicodedata.normalize("NFD", item["name"]).encode("ascii", "ignore").decode()


out = {d: sorted(v, key=sort_key) for d, v in sorted(by_dept.items())}

with open("colombia.js", "w", encoding="utf-8") as f:
  f.write("// Generado desde la DIVIPOLA del DANE (datos.gov.co, dataset gdxc-w37w). No editar a mano.\n")
  f.write("export const CITIES_BY_DEPARTMENT = ")
  json.dump(out, f, ensure_ascii=False, indent=2)
  f.write("\n\nexport const DEPARTMENTS = Object.keys(CITIES_BY_DEPARTMENT).sort((a, b) => a.localeCompare(b, 'es'))\n")

print(f"Departamentos: {len(out)}")
print("Archivo generado: colombia.js")