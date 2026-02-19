import { test, expect } from '@playwright/test';

test('Usuario puede buscar un vuelo de MIA a HAV', async ({ page }) => {
  // 1. MOCKING (Configuración)
  await page.route(/\/api\/flights\/autocomplete/, async route => {
    const url = route.request().url();
    if (url.includes('MIA')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [{ code: 'MIA', city: 'Miami', country: 'EEUU', name: 'Intl', label: 'Miami (MIA)' }] })
      });
    } else if (url.includes('HAV')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [{ code: 'HAV', city: 'Havana', country: 'Cuba', name: 'Jose Marti', label: 'Havana (HAV)' }] })
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('http://localhost:3000');

  // 2. ORÍGEN (MIA)
  const originInput = page.locator('input[type="text"]').first();
  await originInput.click();

  // 🧠 TRUCO PRO: Preparamos la promesa de espera ANTES de escribir
  // "Prométeme que esperarás a que la API responda antes de seguir"
  const responseMiami = page.waitForResponse(resp => resp.url().includes('autocomplete') && resp.status() === 200);
  
  // Ahora escribimos (esto dispara el evento que eventualmente llama a la API)
  await originInput.fill('MIA'); 
  
  // 🛑 ALTO: Esperamos a que la promesa se cumpla (que la API responda)
  await responseMiami;

  // Ahora estamos 100% seguros de que la data llegó. Solo falta que React pinte.
  // Buscamos la lista y el elemento
  await page.locator('ul[role="listbox"]').waitFor({ state: 'visible' }); 
  await page.getByText('Miami').first().click();


  // 3. DESTINO (HAV)
  const destinationInput = page.locator('input[type="text"]').nth(1);
  await destinationInput.click();

  // Preparamos la espera de nuevo
  const responseHavana = page.waitForResponse(resp => resp.url().includes('autocomplete') && resp.status() === 200);
  await destinationInput.fill('HAV');
  
  // 🛑 Esperamos respuesta
  await responseHavana;

  // Seleccionamos
  await page.locator('ul[role="listbox"]').waitFor({ state: 'visible' });
  await page.getByText('Havana').first().click();


  // 4. FECHA y BUSCAR
  await page.locator('input[type="date"]').first().fill('2026-03-20');
  await page.locator('button[type="submit"]').first().click();

  // 5. VERIFICAR
  await expect(page).toHaveURL(/.*search/);
});