import { WifiOff } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";

export default function OfflinePage() {
  return (
    <PageWrapper className="items-center justify-center gap-4 bg-gradient-to-b from-blue-50 to-indigo-100 px-6 dark:from-slate-900 dark:to-slate-800">
      <WifiOff className="size-16 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-2xl font-bold text-foreground">Sin conexión</h1>
      <p className="text-center text-muted-foreground">
        No hay conexión a internet. Tus registros se guardarán localmente y se
        sincronizarán cuando vuelvas a estar conectado.
      </p>
    </PageWrapper>
  );
}
