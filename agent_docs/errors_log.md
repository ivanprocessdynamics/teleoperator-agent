# Registro de Errores (Errors Log)

Este archivo contiene un listado de errores recurrentes que hayan sido detectados durante sesiones previas o peculiaridades técnicas que deben eludirse en el futuro. Permite que el Agente IA recuerde de forma constante situaciones problemáticas o deuda técnica que debe abordarse y evitar.

## Errores Conocidos y Prevenciones

*(Ejemplo Histórico previo sobre integraciones telefónicas y webhooks basado en conocimiento)*
- **Webhook Params & Retell:** Asegurarse siempre de extraer correctamente el número de teléfono con `x-user-number` y `call.from_number`, ya que no contar con esto puede resultar en errores 404 al llamar a utilidades de búsqueda de sistema (`search-customer`, `create-incident`).
- **Team Management:** Recordar la existencia de dependencias críticas entre `auth-fetch.ts`, `workspace_members` y la autenticación de Firebase al manipular el control de acceso en frontend y backend.
- **Tipados TypeScript:** Los objetos mapeados u obtenidos dinámicamente de Firebase requieren tipado estricto. Evitar solucionar problemas con asignación de variable `any` dentro de utilidades iterativas.

*(Añade nuevos bloques aquí según descubras o provoques fallos)*
