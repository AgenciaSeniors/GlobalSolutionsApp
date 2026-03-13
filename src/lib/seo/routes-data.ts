/**
 * @fileoverview Structured data for SEO route landing pages.
 * Each route entry contains all the info needed to render a full page.
 * @module lib/seo/routes-data
 */
import type { FAQItem } from './jsonld';

export interface RoutePageData {
  slug: string;
  originCode: string;
  destinationCode: string;
  originCity: string;
  destinationCity: string;
  originCountry: string;
  destinationCountry: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  introText: string;
  airlines: string[];
  estimatedLowPrice: number;
  estimatedHighPrice: number;
  flightDuration: string;
  directFlights: boolean;
  faqs: FAQItem[];
  relatedRoutes: string[];
  relatedGuides: string[];
}

export const ROUTE_PAGES: RoutePageData[] = [
  {
    slug: 'miami-habana',
    originCode: 'MIA',
    destinationCode: 'HAV',
    originCity: 'Miami',
    destinationCity: 'La Habana',
    originCountry: 'Estados Unidos',
    destinationCountry: 'Cuba',
    metaTitle: 'Vuelos de Miami a La Habana — Precios desde $149 | Reserva Hoy',
    metaDescription:
      'Compara vuelos de Miami (MIA) a La Habana (HAV). American Airlines, charters y más. Vuelos directos desde $149. Paga con Zelle, PIX o SPEI.',
    h1: 'Vuelos de Miami a La Habana',
    introText:
      'La ruta Miami–La Habana es la más popular para viajeros a Cuba. Con vuelos directos diarios operados por American Airlines y aerolíneas charter, puedes encontrar opciones desde $149. Compara precios y reserva con los métodos de pago más flexibles del mercado.',
    airlines: ['American Airlines', 'Southwest Airlines', 'JetBlue', 'Xael', 'HavanaAir'],
    estimatedLowPrice: 149,
    estimatedHighPrice: 509,
    flightDuration: '1h 15min',
    directFlights: true,
    faqs: [
      {
        question: '¿Cuánto cuesta un vuelo de Miami a La Habana?',
        answer:
          'Los vuelos de Miami a La Habana varían entre $149 y $509 dependiendo de la temporada y aerolínea. Diciembre es el mes más caro (~$509) y septiembre el más económico (~$327).',
      },
      {
        question: '¿Qué aerolíneas vuelan de Miami a La Habana?',
        answer:
          'American Airlines opera la mayoría de vuelos comerciales directos. También hay operadores charter como Xael, HavanaAir y Cubazul.',
      },
      {
        question: '¿Cuánto dura el vuelo de Miami a La Habana?',
        answer: 'El vuelo directo de Miami a La Habana dura aproximadamente 1 hora y 15 minutos.',
      },
      {
        question: '¿Puedo pagar mi vuelo a Cuba con Zelle?',
        answer:
          'Sí. Global Solutions Travel acepta Zelle, PIX, SPEI y Square. Somos la única agencia donde puedes comprar vuelos a Cuba con estos métodos de pago.',
      },
      {
        question: '¿Qué documentos necesito para volar de Miami a La Habana?',
        answer:
          'Necesitas pasaporte vigente con al menos 6 meses de validez, visa o tarjeta de turista, seguro médico obligatorio y el formulario D\'Viajeros completado.',
      },
    ],
    relatedRoutes: ['charter-cuba', 'new-york-cuba', 'cancun-habana'],
    relatedGuides: ['requisitos-viajar-cuba', 'aduana-cuba-equipaje', 'evisa-cuba-como-tramitar'],
  },
  {
    slug: 'panama-habana',
    originCode: 'PTY',
    destinationCode: 'HAV',
    originCity: 'Ciudad de Panamá',
    destinationCity: 'La Habana',
    originCountry: 'Panamá',
    destinationCountry: 'Cuba',
    metaTitle: 'Vuelos de Panamá a La Habana desde $189 — Copa Airlines y Más',
    metaDescription:
      'Encuentra vuelos baratos de Ciudad de Panamá (PTY) a La Habana (HAV). Copa Airlines opera vuelos directos. Compara precios y paga con Zelle, PIX o SPEI.',
    h1: 'Vuelos de Panamá a La Habana',
    introText:
      'Panamá es uno de los principales hubs de conexión para viajar a Cuba. Copa Airlines opera vuelos directos PTY–HAV varias veces por semana, y Wingo ofrece opciones low-cost. Esta ruta es ideal para viajeros que conectan desde Sudamérica.',
    airlines: ['Copa Airlines', 'Wingo'],
    estimatedLowPrice: 189,
    estimatedHighPrice: 420,
    flightDuration: '3h 30min',
    directFlights: true,
    faqs: [
      {
        question: '¿Cuánto cuesta un vuelo de Panamá a La Habana?',
        answer:
          'Los vuelos de Panamá a La Habana van desde $189 con Wingo hasta $420 con Copa Airlines en temporada alta.',
      },
      {
        question: '¿Qué aerolíneas vuelan de Panamá a Cuba?',
        answer:
          'Copa Airlines opera vuelos directos 3-4 veces por semana. Wingo es la opción low-cost con precios desde $189.',
      },
      {
        question: '¿Puedo conectar en Panamá para ir a Cuba desde Sudamérica?',
        answer:
          'Sí. PTY es el hub principal de Copa Airlines. Puedes conectar desde Bogotá, Lima, Quito, São Paulo y más ciudades con escala en Panamá hacia La Habana.',
      },
      {
        question: '¿Cuánto dura el vuelo de Panamá a La Habana?',
        answer: 'El vuelo directo de Ciudad de Panamá a La Habana dura aproximadamente 3 horas y 30 minutos.',
      },
    ],
    relatedRoutes: ['miami-habana', 'mexico-cuba', 'cancun-habana'],
    relatedGuides: ['requisitos-viajar-cuba', 'aduana-cuba-equipaje'],
  },
  {
    slug: 'new-york-cuba',
    originCode: 'JFK',
    destinationCode: 'HAV',
    originCity: 'Nueva York',
    destinationCity: 'La Habana',
    originCountry: 'Estados Unidos',
    destinationCountry: 'Cuba',
    metaTitle: 'Vuelos de Nueva York a Cuba — JFK a La Habana desde $249',
    metaDescription:
      'Vuelos de Nueva York (JFK) a La Habana (HAV). American Airlines, Delta y JetBlue. Directos y con escala. Paga con Zelle, PIX o SPEI.',
    h1: 'Vuelos de Nueva York a Cuba',
    introText:
      'Para la comunidad cubana en la costa este de EE.UU., la ruta Nueva York–La Habana es esencial. Varias aerolíneas operan vuelos directos desde JFK con una duración de ~3.5 horas. También hay opciones con conexión vía Miami que pueden ser más económicas.',
    airlines: ['American Airlines', 'Delta Air Lines', 'JetBlue', 'United Airlines'],
    estimatedLowPrice: 249,
    estimatedHighPrice: 600,
    flightDuration: '3h 30min',
    directFlights: true,
    faqs: [
      {
        question: '¿Cuánto cuesta un vuelo de Nueva York a Cuba?',
        answer:
          'Los vuelos de JFK a La Habana van desde $249 en temporada baja hasta $600 en diciembre. Vuelos con escala en Miami pueden ser más económicos.',
      },
      {
        question: '¿Hay vuelos directos de Nueva York a La Habana?',
        answer:
          'Sí. American Airlines y JetBlue operan vuelos directos desde JFK. El vuelo dura aproximadamente 3 horas y 30 minutos.',
      },
      {
        question: '¿Puedo pagar mi vuelo a Cuba con Zelle desde Nueva York?',
        answer:
          'Sí. Global Solutions Travel acepta Zelle para pagar vuelos a Cuba. Es el método preferido por la diáspora cubana en EE.UU.',
      },
    ],
    relatedRoutes: ['miami-habana', 'charter-cuba'],
    relatedGuides: ['requisitos-viajar-cuba', 'evisa-cuba-como-tramitar'],
  },
  {
    slug: 'cancun-habana',
    originCode: 'CUN',
    destinationCode: 'HAV',
    originCity: 'Cancún',
    destinationCity: 'La Habana',
    originCountry: 'México',
    destinationCountry: 'Cuba',
    metaTitle: 'Vuelos de Cancún a La Habana — Desde $159 | Compara y Reserva',
    metaDescription:
      'Vuelos baratos de Cancún (CUN) a La Habana (HAV). Cubana de Aviación y más. Vuelo directo ~1 hora. Paga con SPEI, Zelle o PIX.',
    h1: 'Vuelos de Cancún a La Habana',
    introText:
      'Cancún es la conexión más cercana desde México hacia Cuba, con vuelos directos de solo 1 hora. Es la opción más rápida y económica para viajeros mexicanos que quieren conocer La Habana.',
    airlines: ['Cubana de Aviación', 'Aeromexico', 'Viva Aerobus'],
    estimatedLowPrice: 159,
    estimatedHighPrice: 380,
    flightDuration: '1h 05min',
    directFlights: true,
    faqs: [
      {
        question: '¿Cuánto cuesta un vuelo de Cancún a La Habana?',
        answer:
          'Los vuelos de Cancún a La Habana van desde $159. Cubana de Aviación y aerolíneas mexicanas operan esta ruta con precios competitivos.',
      },
      {
        question: '¿Cuánto dura el vuelo de Cancún a La Habana?',
        answer: 'El vuelo directo de Cancún a La Habana dura solo 1 hora y 5 minutos. Es la ruta más corta desde México.',
      },
      {
        question: '¿Puedo pagar con SPEI?',
        answer:
          'Sí. Global Solutions Travel acepta SPEI para viajeros mexicanos, además de Zelle, PIX y Square.',
      },
    ],
    relatedRoutes: ['mexico-cuba', 'miami-habana'],
    relatedGuides: ['requisitos-viajar-cuba', 'aduana-cuba-equipaje'],
  },
  {
    slug: 'mexico-cuba',
    originCode: 'MEX',
    destinationCode: 'HAV',
    originCity: 'Ciudad de México',
    destinationCity: 'La Habana',
    originCountry: 'México',
    destinationCountry: 'Cuba',
    metaTitle: 'Vuelos de México a Cuba — CDMX a La Habana desde $199',
    metaDescription:
      'Vuelos de Ciudad de México (MEX) a La Habana (HAV). Aeromexico, Cubana y más. Directos y con escala vía Cancún. Paga con SPEI, Zelle o PIX.',
    h1: 'Vuelos de Ciudad de México a Cuba',
    introText:
      'La ruta Ciudad de México–La Habana conecta las dos capitales con vuelos directos de ~3 horas. Aeromexico opera la mayoría de frecuencias. También puedes conectar por Cancún con opciones más económicas.',
    airlines: ['Aeromexico', 'Cubana de Aviación', 'Viva Aerobus', 'Volaris'],
    estimatedLowPrice: 199,
    estimatedHighPrice: 480,
    flightDuration: '3h 00min',
    directFlights: true,
    faqs: [
      {
        question: '¿Cuánto cuesta un vuelo de México a Cuba?',
        answer:
          'Los vuelos directos de Ciudad de México a La Habana van desde $199 con Viva Aerobus hasta $480 con Aeromexico en temporada alta.',
      },
      {
        question: '¿Hay vuelos directos de CDMX a La Habana?',
        answer:
          'Sí. Aeromexico y Cubana de Aviación operan vuelos directos. También puedes volar vía Cancún con aerolíneas low-cost.',
      },
      {
        question: '¿Puedo pagar mi vuelo con SPEI?',
        answer:
          'Sí. Aceptamos SPEI para viajeros mexicanos. Es una transferencia electrónica instantánea segura y sin comisiones.',
      },
    ],
    relatedRoutes: ['cancun-habana', 'panama-habana', 'miami-habana'],
    relatedGuides: ['requisitos-viajar-cuba', 'aduana-cuba-equipaje'],
  },
];

/** Lookup a route by its slug */
export function getRouteBySlug(slug: string): RoutePageData | undefined {
  return ROUTE_PAGES.find((r) => r.slug === slug);
}
