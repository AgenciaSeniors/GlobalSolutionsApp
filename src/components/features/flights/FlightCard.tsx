import { FlightOffer } from '@/types/models';
// CORRECCIÓN AQUÍ: Quitamos las llaves {} porque son export default
import Button from '@/components/ui/Button'; 
import Badge from '@/components/ui/Badge';
import { Plane } from 'lucide-react'; 

interface FlightCardProps {
  flight: FlightOffer;
  onSelect?: (id: string) => void;
}

export default function FlightCard({ flight, onSelect }: FlightCardProps) {
  // Tomamos el primer tramo para mostrar la info principal (salida)
  const firstSegment = flight.segments[0];
  // Tomamos el último para la llegada
  const lastSegment = flight.segments[flight.segments.length - 1];
  
  const isDirect = flight.segments.length === 1;

  return (
    <div className="w-full bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5 mb-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* 1. Info de la Aerolínea */}
        <div className="flex items-center gap-3 w-full md:w-1/4">
          <div className="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center text-xs font-bold text-[#0F2545]">
             {/* Si hay logo lo mostramos, si no, las siglas */}
             {firstSegment.airline.code}
          </div>
          <div>
            <p className="font-bold text-[#0F2545]">{firstSegment.airline.name}</p>
            <p className="text-xs text-gray-400">Vuelo {firstSegment.flightNumber}</p>
          </div>
        </div>

        {/* 2. Horarios y Ruta */}
        <div className="flex-1 w-full flex justify-between items-center px-4">
          {/* Salida */}
          <div className="text-center">
            <p className="text-xl font-bold text-[#0F2545]">
              {new Date(firstSegment.departureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
            <p className="text-sm text-gray-500">{firstSegment.origin}</p>
          </div>

          {/* Duración y Escalas */}
          <div className="flex flex-col items-center px-4 w-full">
            <p className="text-xs text-gray-400 mb-1">{flight.totalDuration}</p>
            <div className="w-full h-[2px] bg-gray-200 relative flex items-center justify-center">
               {/* Icono de avión en medio de la línea */}
               <Plane className="w-4 h-4 text-gray-300 absolute bg-white px-1" />
            </div>
            
            {/* CORRECCIÓN AQUÍ: Usamos el Badge correctamente importado */}
            <div className="mt-2">
                <Badge variant={isDirect ? "success" : "warning"}>
                    {isDirect ? 'Directo' : `${flight.segments.length - 1} Escala(s)`}
                </Badge>
            </div>
          </div>

          {/* Llegada */}
          <div className="text-center">
            <p className="text-xl font-bold text-[#0F2545]">
              {new Date(lastSegment.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </p>
            <p className="text-sm text-gray-500">{lastSegment.destination}</p>
          </div>
        </div>

        {/* 3. Precio y Botón */}
        <div className="w-full md:w-auto flex md:flex-col items-center justify-between gap-2 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
          <div className="text-right">
             <span className="text-xs text-gray-400">Total por pasajero</span>
             <p className="text-2xl font-bold text-[#FF4757]">
               ${flight.price}
             </p>
          </div>
          
          <Button 
            onClick={() => onSelect?.(flight.id)}
            // CORRECCIÓN: 'primary' es una variante válida según tu archivo Button.tsx
            variant="primary"
            className="w-full md:w-auto"
          >
            Seleccionar
          </Button>
        </div>

      </div>
    </div>
  );
}