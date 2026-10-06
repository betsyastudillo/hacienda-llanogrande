from datetime import datetime, timedelta
import bcrypt
from jose import jwt
from app.config import settings


# Manejo de contraseñas
# Toma la contraseña y la convierte en un texto irreversible (hash) para guardarla en la base de datos
def hash_password(password: str) -> str:
  # Convierte la contraseña en bytes y luego genera un hash usando bcrypt
  password_bytes = password.encode("utf-8")
  hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())

  return hashed.decode("utf-8")


# Verifica si la contraseña proporcionada coincide con la almacenada (hash)
def verify_password(plain_password: str, hashed_password: str) -> bool:
  return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))



# Manejo de tokens JWT
def create_access_token(data: dict) -> str:
  # data.copy toma lo que le pasamos y lo convierte en un diccionario para poder agregarle la fecha de expiración
  to_encode = data.copy()
  expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
  # Agrega la fecha de expiración al diccionario
  to_encode.update({"exp": expire})
  # jwt.encode toma el diccionario, la clave secreta y el algoritmo para generar el token
  jwt_token = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
  
  return jwt_token


# Recibe un token y lo decodifica para obtener la información que contiene, si el token es inválido o ha expirado, devuelve None
def decode_access_token(token: str) -> dict:
  try:
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    
    return payload
  except jwt.JWTError:
    return None