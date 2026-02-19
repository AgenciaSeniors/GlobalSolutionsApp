import React from 'react';
import Image from 'next/image';
import styles from './FlightLoader.module.css';

export function FlightLoader() {
  return (
    <div className={styles.loaderContainer}>
      {/* Contenedor que inclina la escena 3D para que veamos la órbita en ángulo */}
      <div className={styles.escena3D}>
        
        {/* 1. Logo principal estático en el centro del espacio 3D */}
        <div className={styles.logoCentral}>
          <Image 
            src="/brand/logo-centro.png" 
            alt="Global Solutions Travel" 
            width={200} 
            height={200}
            priority
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* 2. El anillo invisible que gira en profundidad (3D) */}
        <div className={styles.orbitaAnimada}>
          
          {/* 3. El avioncito, empujado hacia el borde de la órbita */}
          <div className={styles.avionWrapper}>
            <Image 
              src="/brand/avion-check.png" 
              alt="Buscando vuelos..." 
              width={80} 
              height={80}
              priority
              style={{ objectFit: 'contain' }}
              className={styles.avionRotacion} 
            />
          </div>
        </div>
        
      </div>
    </div>
  );
}