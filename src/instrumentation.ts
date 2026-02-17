// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 🚀 En lugar de forzar instanciaciones que rompen los tipos de TypeScript,
    // usamos la variable de entorno nativa de OpenTelemetry para registrar el servicio.
    process.env.OTEL_SERVICE_NAME = 'global-solutions-api';

    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter(), // Exportará trazas al recolector local/nube
    });

    sdk.start();
  }
}