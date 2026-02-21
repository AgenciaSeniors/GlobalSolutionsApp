import { FlightOffer } from '@/types/models';
import FlightCard from './FlightCard';
import { AlertCircle } from 'lucide-react';
import { FlightLoader } from '@/components/ui';
interface FlightResultsListProps {
  flights: FlightOffer[];
  isLoading?: boolean;
  error?: string | null;
  onSelectFlight?: (flightId: string) => void;
  onRetry?: () => void;
}

export default function FlightResultsList({
  flights,
  isLoading = false,
  error = null,
  onSelectFlight,
  onRetry,
}: FlightResultsListProps) {
  console.log(`[FlightResultsList] isLoading=${isLoading} flights=${flights?.length ?? 0} error=${String(error)}`);

  // 1. Estado de Carga
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-100 shadow-sm">
        {/* Aquí llamamos a tu nueva animación */}
        <FlightLoader />
        
        {/* Texto que acompaña a la animación */}
        <h3 className="mt-12 text-xl font-bold text-[#0F2545]">
          Buscando los mejores vuelos...
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Por favor, espera unos segundos mientras conectamos con las aerolíneas.
        </p>
      </div>
    );
  }

  // 2. NUEVO: Estado de Error
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-red-900">Ocurrió un error</h3>
        <p className="mb-4 text-sm text-red-700">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Intentar de nuevo
          </button>
        )}
      </div>
    );
  }

  // 3. Estado Vacío
  if (!flights || flights.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
        <p className="text-[#0F2545] font-medium text-lg">No encontramos vuelos</p>
        <p className="text-gray-400 text-sm">Intenta ajustar tus filtros de búsqueda</p>
      </div>
    );
  }

  // 4. Lista de Resultados
  return (
    <div className="space-y-4">
      {flights.map((flight) => (
        <FlightCard 
          key={flight.id} 
          flight={flight} 
          onSelect={onSelectFlight}
        />
      ))}
    </div>
  );
}

