# Registro de Cambios y Modificaciones (Changes Log)

Este archivo sirve para llevar un seguimiento de todas las modificaciones sustanciales, refactorizaciones, o integraciones realizadas en el proyecto por agentes IA.
Es **obligatorio** que el agente documente brevemente los cambios aquí tras finalizar un esfuerzo de desarrollo.

## Historial de Cambios

### [Generación Inicial]
- **Archivos Añadidos:** `/agent_docs/project_info.md`, `/agent_docs/changes_log.md`, `/agent_docs/errors_log.md`, `/agent_docs/prompts.md`, `/agent_docs/development_workflow.md`
- **Descripción:** Creación del sistema de documentación asistida para futuros agentes IA. Exploración estructural inicial del stack de Next.js, Firebase y Retell SDK.

### [1. Flujo Lead SMS & Cron - Marzo 2026]
- **Archivos Modificados:** `app/api/proxy/send-sms/route.ts`
- **Archivos Añadidos:** `app/api/cron/process-leads/route.ts`, `app/api/web/get-lead/route.ts`, `app/api/web/submit-incident/route.ts`, `app/reportar-averia/page.tsx`, `vercel.json`
- **Descripción:** 
  - Subsanado issue de envíos "id=undefined" en proxy Twilio.
  - Creado Cron en Vercel que envía el SMS de reconversión de leads a las 8 horas mitigando horas intempestivas (22h - 8h ES).
  - Componentizado formulario de Reporte de Avería con medidas de seguridad OTP idénticas a la corrección de dirección. El submiteado de esto cambia estado del lead a 'converted' e inyecta la cita en una nueva col. `incidents`.

### [2. Flujo Opiones (Reseñas) & Fixes - Marzo 2026]
- **Archivos Modificados:** `components/inbound/InboundAgentView.tsx`, `app/api/proxy/create-incident/route.ts`
- **Archivos Añadidos:** `components/inbound/AgentFeedback.tsx`, `app/api/cron/process-feedback/route.ts`, `app/resenas/page.tsx`, `app/api/web/submit-feedback/route.ts`
- **Descripción:**
  - Se eliminó el panel "Entrenamiento" de la config del agente y se sustituyó por una UI de "Reseñas", que calcula el Average de Notas Globales y muestra todas las reviews.
  - El SMS a la 4ta hora post-cita es manejado por el nuevo componente Cron `process-feedback`, mandando links seguros acortados por TinyURL.
  - El formulario se enruta hacia un backend en `submit-feedback` protegido por 2FA (OTP via SMS).
