# Documentación del Proyecto: Voice CRM

## Descripción General
El proyecto "Voice CRM" es una aplicación Next.js diseñada como un CRM y un panel de control para gestionar teleoperadores basados en IA. Utiliza capacidades avanzadas de agentes de voz para interactuar con clientes, manejar campañas (inbound/outbound), y recopilar análisis en tiempo real. 

## Stack Tecnológico
- **Framework Frontend/Backend:** Next.js (App Router, versión 16.x).
- **Estilos:** Tailwind CSS (v4) con uso extensivo de componentes UI base (Radix UI) e iconos de Lucide.
- **IA y Voz:** Integración con OpenAI y la plataforma de Retell AI (usando sus SDK de Node.js y Client JS).
- **Comunicaciones Adicionales:** Twilio.
- **Base de Datos y Autenticación:** Firebase (con Admin SDK para operaciones backend seguras y Client SDK en frontend).
- **Lenguaje:** TypeScript estricto.

## Organización del Directorio Funcional
- `app/`: Contiene el enrutamiento y las páginas de la aplicación.
  - Vistas principales de panel de administración y agentes (`dashboard`, `agent-view`).
  - `api/`: Rutas del backend para interacciones seguras, ejecución de herramientas (tools), y webhooks (comunicación con Retell AI).
- `components/`: Componentes modulares de React.
  - Subdirectorios clasificados lógicamente: `calls`, `campaigns`, `inbound`, `stats`, `team`, `tools`, `ui`, etc.
  - Módulos interactivos clave de IA: `ToolEditorDialog`, `PromptEditor`, `VoiceOrb`, `Playground`, `TestingEnvironment`.
- `lib/`: Lógica central, configuraciones de conexión y utilidades.
  - Conexión a DB y Auth: `firebase.ts`, `firebase-admin.ts`, `auth-middleware.ts`.
  - Integración de IA: `retell-agents.ts`, `tools-execution.ts`.
- `types/`: Tipados globales o interfaces reutilizables.
- `contexts/`: Proveedores de Contexto React (e.g., gestión del estado de autenticación y de workspaces).

## Flujos Clave de la Aplicación
1. **Campañas y Llamadas:** Configuración de números telefónicos o llamadas web a través de agentes configurados, tanto para flujos Inbound como Outbound.
2. **Sistema Multi-Workspace / Team:** Existen referencias a Workspaces y roles de administradores que sugieren un modelo multi-inquilino.
3. **Herramientas de Agente (Tools Execution):** Los agentes conversacionales pueden invocar llamadas a herramientas (ej., llamadas a la API proxy) para acceder a registros de clientes u operaciones CRM durante una llamada en tiempo real.

## Instrucciones y Propósito
Este directorio (`agent_docs`) ha sido preparado como el "cerebro local" del repositorio. Como agente AI, siempre usa estas notas para entender el contexto arquitectónico de manera rápida y eficiente antes de emprender modificaciones pesadas, mitigando el riesgo de romper módulos consolidados.
