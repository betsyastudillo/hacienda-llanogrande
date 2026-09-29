# Login

`pages/Login/Login.jsx` — único formulario público del sistema (junto con `/magic-login`, ver `magic-link.md`).

- Login por `document_id`, no email — coincide con el backend (`POST /auth/login`).
- Al autenticar con éxito, `login(access_token)` del `AuthContext` guarda el token y navega a `/orders`.
- Errores 401 muestran "Documento o contraseña incorrectos"; cualquier otro fallo (red, servidor caído) muestra un mensaje genérico de conexión.
- Estilos con paleta propia de marca, sin usar `react-bootstrap` para este formulario en particular — se decidió CSS a mano para tener control total del diseño en la pantalla de primera impresión.
