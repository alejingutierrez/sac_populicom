import { expect, test } from "@playwright/test";

test("dashboard loads and navigates through core modules", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Centro de monitoreo" })).toBeVisible();
  await page.getByRole("link", { name: "Menciones" }).click();
  await expect(page.getByText("Menciones detectadas")).toBeVisible();

  await page.getByRole("link", { name: "Bandeja SAC" }).click();
  await expect(page.getByText("Crear caso operativo")).toBeVisible();
});

test("can create and update a case", async ({ page }) => {
  await page.goto("/bandeja");

  await page.getByLabel("Título").fill("Validación operativa desde smoke");
  await page.getByLabel("Resumen").fill("Caso de prueba para validar el flujo inicial.");
  await page.getByRole("button", { name: "Crear caso" }).click();

  await expect(page.getByText("Validación operativa desde smoke")).toBeVisible();
  await page.locator(".case-inline-editor").first().getByRole("combobox").first().selectOption("triaged");
  await page.locator(".case-inline-editor").first().getByRole("button", { name: "Actualizar" }).click();
});
