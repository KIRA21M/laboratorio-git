# Laboratorio Git y GitHub

Práctica de creación de un repositorio local y su conexión con GitHub.

## Datos del proyecto

- Plataforma: GitHub.
- Propietario: KIRA21M.
- Repositorio: laboratorio-git.
- Visibilidad: privado.
- Rama principal: `main`.

## Objetivos de la práctica

1. Crear un repositorio vacío en GitHub.
2. Configurar `user.name` y `user.email` en Git.
3. Inicializar el repositorio local y conectarlo al remoto `origin`.
4. Crear este archivo `README.md` y un `.gitignore`.
5. Registrar los archivos en un commit inicial y enviarlos a GitHub.

## Archivos

- `README.md`: descripción y objetivos del proyecto.
- `.gitignore`: exclusión de archivos temporales, registros, dependencias y configuraciones locales.
- `src/`: servidor HTTP con registro, inicio de sesión, cierre de sesión, sesiones y autorización por rol.
- `public/`: interfaz web para registrar una cuenta de prueba, iniciar sesión y cerrar sesión.
- `test/`: pruebas automatizadas de los criterios de aceptación de FEAT-07.

## FEAT-07: Iniciar y cerrar sesión

Responsable: Reing01.

Esta entrega agrega autenticación para usuarios registrados:

- `POST /api/register`: crea una cuenta con hash PBKDF2 de la contraseña.
- `POST /api/login`: valida credenciales y emite una sesión en cookie `HttpOnly`.
- `GET /api/me`: retorna el usuario autenticado si la sesión sigue vigente.
- `POST /api/logout`: invalida la sesión activa en el servidor.
- `GET /api/admin/users`: ejemplo de endpoint protegido por rol administrativo.

Reglas implementadas:

- Correo desconocido y contraseña incorrecta responden con el mismo mensaje genérico.
- La sesión vence tras 30 minutos de inactividad.
- Cerrar sesión elimina la sesión del servidor.
- Cinco intentos fallidos por cuenta en 15 minutos bloquean nuevos intentos durante 15 minutos.
- El rol se valida desde el servidor; modificarlo desde el cliente no concede permisos administrativos.

## Ejecución local

```sh
npm start
```

Abrir `http://localhost:3000`.

## Verificación de FEAT-07

```sh
npm test
```

## Verificación

```sh
git status
git remote -v
git log --oneline
```

Repositorio remoto: https://github.com/KIRA21M/laboratorio-git
