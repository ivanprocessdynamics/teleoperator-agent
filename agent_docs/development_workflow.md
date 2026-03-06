# Flujo de Desarrollo Sugerido (Development Workflow)

*(Este archivo fue añadido dinámicamente para reforzar las dinámicas del proyecto).*

## Procedimiento Estándar Operativo para Agentes de IA

### Fase 1: Entendimiento y Planificación (PLANNING)
1. Iniciar leyendo el `agent_docs/project_info.md` y revisar las últimas anotaciones en el `errors_log.md` respectivo para nutrir el contexto.
2. Formular un "implementation plan" si la modificación que ordena el usuario es estructural extensa o tiene el potencial de incurrir en breaking changes en la base de datos o APIs.

### Fase 2: Ejecución y Codificación (EXECUTION)
1. Escribir/Modificar en rangos lógicos (`multi_replace_file_content` o `replace_file_content`) cuidando de conservar identación y formato Tailwind.
2. Evitar borrar código arbitrariamente sin un exhaustivo chequeo de dependencias de importación.

### Fase 3: Validación e Inyección de Logs (VERIFICATION)
1. Comprobar internamente posibles errores o pedir al usuario compilación manual / checkeo si aplica.
2. Actualizar el documento `changes_log.md` tras estabilizar una nueva feature y describir qué componentes nuevos existen.
3. Si durante la ejecución se descubrió un problema técnico grave (ejemplo: Firebase no refrescando tokens), agregarlo a `errors_log.md` junto con su contramedida respectiva (ej. Auth Context force-refresh).
