import { FlightOffer } from '@/types/models';
import FlightCard from './FlightCard';
import Skeleton from '@/components/ui/Skeleton';
import { AlertCircle } from 'lucide-react'; // Necesitaremos este icono

interface FlightResultsListProps {
  flights: FlightOffer[];
  isLoading?: boolean;
  error?: string | null; // <--- NUEVO: Prop para recibir errores
  onSelectFlight?: (flightId: string) => void;
}

export default function FlightResultsList({ 
  flights, 
  isLoading = false, 
  error = null, // <--- NUEVO: Valor por defecto
  onSelectFlight 
}: FlightResultsListProps) {

  // 1. Estado de Carga
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <FlightCardSkeleton key={i} />
        ))}
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
        <button 
          onClick={() => window.location.reload()}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Intentar de nuevo
        </button>
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

// Sub-componente Skeleton (Se mantiene igual)
function FlightCardSkeleton() {
  return (
    <div className="w-full bg-white rounded-xl border border-gray-100 p-5 mb-4 animate-pulse">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-1/4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex-1 w-full px-4">
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="w-full md:w-auto pl-6">
           <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}