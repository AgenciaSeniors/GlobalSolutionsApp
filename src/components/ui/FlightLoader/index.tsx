import React from 'react';
import styles from './FlightLoader.module.css';

// ✅ Paths vectorizados desde tu PNG (isotipo.png)
const ISO_PATH_TRAIL =
  'M 559 168 L 536 149 L 459 215 L 454 216 L 435 235 L 412 250 L 403 260 L 400 259 L 399 263 L 332 315 L 329 314 L 327 319 L 314 326 L 311 331 L 248 376 L 240 378 L 242 379 L 215 399 L 212 398 L 191 415 L 159 435 L 144 440 L 144 443 L 135 448 L 133 446 L 128 451 L 122 451 L 119 455 L 89 460 L 82 457 L 76 448 L 77 437 L 89 411 L 109 384 L 137 356 L 158 340 L 185 324 L 194 323 L 202 315 L 215 310 L 217 312 L 217 308 L 237 300 L 247 300 L 249 296 L 261 291 L 255 289 L 232 293 L 189 305 L 187 302 L 185 307 L 165 312 L 164 315 L 139 325 L 120 337 L 119 335 L 111 343 L 102 344 L 104 347 L 68 373 L 38 403 L 22 424 L 6 456 L 0 485 L 1 514 L 5 527 L 16 541 L 16 545 L 31 555 L 80 557 L 82 554 L 86 556 L 89 552 L 112 546 L 137 534 L 202 492 L 206 493 L 203 492 L 254 457 L 262 448 L 265 449 L 408 322 L 410 326 L 403 333 L 399 332 L 400 336 L 359 381 L 357 379 L 358 382 L 307 433 L 304 433 L 300 440 L 212 515 L 208 515 L 184 535 L 176 536 L 178 538 L 135 563 L 113 568 L 113 571 L 99 575 L 71 575 L 71 578 L 58 579 L 78 594 L 107 606 L 152 614 L 164 612 L 164 615 L 167 612 L 193 609 L 196 611 L 194 608 L 215 602 L 243 586 L 283 550 L 357 461 L 357 457 L 397 401 L 400 401 L 405 389 L 429 355 L 432 355 L 433 349 L 440 339 L 442 340 L 441 337 L 493 261 L 503 248 L 506 248 L 508 240 Z';

const ISO_PATH_PLANE =
  'M 725 1 L 709 3 L 708 7 L 684 16 L 678 15 L 676 19 L 672 18 L 666 23 L 645 31 L 640 30 L 641 32 L 628 35 L 624 39 L 615 39 L 615 43 L 583 55 L 571 56 L 571 59 L 563 63 L 555 63 L 543 71 L 519 80 L 517 78 L 512 83 L 472 99 L 464 99 L 461 103 L 446 108 L 444 111 L 448 113 L 445 114 L 507 135 L 534 119 L 538 120 L 541 115 L 568 100 L 573 100 L 576 103 L 534 131 L 533 137 L 535 136 L 555 157 L 598 193 L 660 100 L 665 98 L 665 92 L 681 68 L 688 64 L 685 61 Z';

function SwooshArrow(props: React.SVGProps<SVGSVGElement>) {
  // ✅ Evita colisiones de IDs si se renderiza más de una vez
  const uid = React.useId().replace(/:/g, '');

  const baseId = `isoBase_${uid}`;
  const hiId = `isoHi_${uid}`;
  const shadowId = `isoShadow_${uid}`;

  return (
    <svg
      viewBox="0 0 726 616"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <defs>
        {/* Degradado base (volumen) */}
        <linearGradient
          id={baseId}
          x1="0"
          y1="616"
          x2="726"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="var(--coral-1)" />
          <stop offset="0.55" stopColor="var(--coral-2)" />
          <stop offset="1" stopColor="var(--coral-3)" />
        </linearGradient>

        {/* Highlight (brillo) */}
        <linearGradient
          id={hiId}
          x1="120"
          y1="520"
          x2="640"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.65" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        {/* Sombra sutil (para que "asiente" como en el PNG) */}
        <filter id={shadowId} x="-12%" y="-12%" width="124%" height="124%">
          <feDropShadow
            dx="0"
            dy="10"
            stdDeviation="8"
            floodColor="#000000"
            floodOpacity="0.18"
          />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        {/* Base */}
        <path d={ISO_PATH_TRAIL} fill={`url(#${baseId})`} />
        <path d={ISO_PATH_PLANE} fill={`url(#${baseId})`} />

        {/* Brillo */}
        <g opacity="0.95">
          <path d={ISO_PATH_TRAIL} fill={`url(#${hiId})`} />
          <path d={ISO_PATH_PLANE} fill={`url(#${hiId})`} />
        </g>
      </g>
    </svg>
  );
}

function PlaneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      {/* Silueta simple tipo "airplanemode_active" (vista superior) */}
      <path
        d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Loader de vuelos optimizado:
 * - No usa MP4.
 * - No carga PNGs grandes.
 * - Animación CSS (avión atravesando el wordmark).
 */
export function FlightLoader() {
  return (
    <div className={styles.loaderContainer} aria-hidden="true">
      <div className={styles.stage}>
        <div className={styles.brand}>
          <SwooshArrow className={styles.swoosh} />

          <div className={styles.wordmark}>
            <div className={styles.brandTop}>GLOBAL SOLUTIONS</div>
            <div className={styles.brandBottom}>Travel</div>
          </div>
        </div>

        {/* Sombra suave inferior como en el video */}
        <div className={styles.baseShadow} />

        {/* Avión + sombra animados */}
        <div className={styles.planeShadow} />
        <PlaneIcon className={styles.plane} />
      </div>
    </div>
  );
}
