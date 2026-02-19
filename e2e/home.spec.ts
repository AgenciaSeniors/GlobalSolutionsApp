import { test, expect } from '@playwright/test';

test('La página de inicio carga correctamente', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Verificar título
  await expect(page).toHaveTitle(/Global Solutions/i);

  // CORRECCIÓN: Buscamos específicamente el botón "Submit" del formulario
  // Esto evita la confusión con otros botones decorativos
  const searchButton = page.locator('button[type="submit"]').first(); 
  
  // O si prefieres usar texto pero filtrando:
  // const searchButton = page.getByRole('button', { name: /buscar/i }).filter({ hasText: 'Buscar Vuelos' }).last();

  await expect(searchButton).toBeVisible();
});

test('Navegación a Login funciona', async ({ page }) => {
  await page.goto('http://localhost:3000');

  // Hacemos clic en "Iniciar Sesión"
  // Si hay varios (ej. móvil y desktop), le decimos que toque el primero visible
  await page.getByText('Iniciar Sesión', { exact: false }).first().click();

  await expect(page).toHaveURL(/.*login/);
});