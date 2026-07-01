import { test, expect } from '@playwright/test';

test.describe('AsistApp E2E Security and Portal Controls', () => {
  
  test('should redirect unauthenticated guest to login page', async ({ page }) => {
    // Attempting to visit private dashboard
    await page.goto('/dashboard/admin');

    // Should immediately get intercepted by Edge middleware and redirected to /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should render beautiful and dynamic login interface', async ({ page }) => {
    await page.goto('/login');

    // 1. Title verification
    await expect(page.locator('h2')).toContainText('Iniciar Sesión');

    // 2. Form input visibility
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // 3. Dynamic interaction: Switch to "Forgot Password" view
    const forgotPasswordLink = page.locator('text=¿Olvidaste tu contraseña?');
    await forgotPasswordLink.click();

    // The view should switch smoothly (conditional rendering view === 'forgot-password')
    await expect(page.locator('h2')).toContainText('Recuperar Contraseña');
    await expect(page.locator('button:has-text("Enviar Instrucciones")')).toBeVisible();

    // Switch back to login
    const backToLoginLink = page.locator('text=Volver al inicio de sesión');
    await backToLoginLink.click();
    await expect(page.locator('h2')).toContainText('Iniciar Sesión');
  });

  test('should respect responsive layout and support desktop sidebar actions', async ({ page }) => {
    // 1. Set viewport to standard desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');

    // Visual side illustrations should only be visible on desktop viewports
    const sideIllustration = page.locator('.hidden.lg\\:flex');
    await expect(sideIllustration).toBeVisible();

    // 2. Set viewport to mobile
    await page.setViewportSize({ width: 375, height: 812 });
    // Side illustration should be hidden on mobile
    await expect(sideIllustration).toBeHidden();
  });
});
