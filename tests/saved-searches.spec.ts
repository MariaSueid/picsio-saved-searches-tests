import { test, expect, GUIDE_PDF_SEARCH } from './fixtures';
import { assetIds } from '../pages/SearchPage';

test.describe('Saved searches', () => {
  test('create: a personal search with text + PDF filter lands in Personal, not Team @core', async ({
    page, searchPage, savedSearches, uniqueName,
  }) => {
    const name = uniqueName('create');

    // Build the search through the UI, the way a user does
    await searchPage.open();
    await savedSearches.open();
    await searchPage.searchInput.fill(GUIDE_PDF_SEARCH.text);
    await Promise.all([searchPage.waitForSearchResponse(), searchPage.searchInput.press('Enter')]);
    await page.getByRole('button', { name: 'Type', exact: true }).click();
    await page.locator('.react-select__control').click();
    await Promise.all([searchPage.waitForSearchResponse(), page.getByRole('option', { name: 'PDF documents' }).click()]);
    await page.keyboard.press('Escape');

    const response = await savedSearches.create(name);

    expect(response.status()).toBe(201);
    expect(response.request().postDataJSON()).toMatchObject({
      name,
      shared: false,
      data: { text: 'guide', type: 'pdf' },
    });

    // "Share with my team" off -> it must land in Personal, not in Team
    await expect(savedSearches.item(name, 'Personal Saved Searches')).toBeVisible();
    await expect(savedSearches.item(name, 'Team Saved Searches')).toHaveCount(0);
  });

  test('apply: returns the same filters and the same assets as the original search @core', async ({
    searchPage, savedSearches, savedSearchesApi, uniqueName,
  }) => {
    const originalIds = await searchPage.open(GUIDE_PDF_SEARCH);
    expect(originalIds.length, 'test data: the account needs PDFs matching "guide"').toBeGreaterThan(0);

    const name = uniqueName('apply');
    await savedSearchesApi.create(name);

    // Start from an unfiltered library so everything on screen comes from the saved search
    await searchPage.open();
    await savedSearches.open();
    const response = await savedSearches.apply(savedSearches.item(name));

    expect(await assetIds(response)).toEqual(originalIds);
    await expect(searchPage.page).toHaveURL(/[?&]text=guide(&|$)/);
    await expect(searchPage.page).toHaveURL(/[?&]type=pdf(&|$)/);
    await expect(searchPage.searchInput).toHaveValue('guide');
    await expect(searchPage.page.getByRole('button', { name: 'PDF documents', exact: true })).toBeVisible();
    await searchPage.expectResultsCount(originalIds.length);
  });

  test('persistence: a saved search created in the UI is still there after reload @core', async ({
    searchPage, savedSearches, uniqueName,
  }) => {
    const name = uniqueName('reload');
    await searchPage.open(GUIDE_PDF_SEARCH);
    await savedSearches.open();
    const response = await savedSearches.create(name);
    expect(response.status()).toBe(201);
    await expect(savedSearches.item(name)).toBeVisible();

    await searchPage.reload();
    await savedSearches.open();

    await expect(savedSearches.item(name)).toBeVisible();
  });

  test('rename: shows the new name and keeps the same results', async ({
    searchPage, savedSearches, savedSearchesApi, uniqueName,
  }) => {
    const originalIds = await searchPage.open(GUIDE_PDF_SEARCH);
    const oldName = uniqueName('rename');
    const newName = `${oldName}-new`;
    const id = await savedSearchesApi.create(oldName);

    await searchPage.open();
    await savedSearches.open();
    const response = await savedSearches.rename(savedSearches.itemById(id), newName);

    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({ name: newName });
    await expect(savedSearches.item(newName)).toBeVisible();
    await expect(savedSearches.item(oldName)).toHaveCount(0);

    // The rename must survive a reload and must not change what the search returns
    await searchPage.reload();
    await savedSearches.open();
    expect(await assetIds(await savedSearches.apply(savedSearches.item(newName)))).toEqual(originalIds);
  });

  test('delete: asks for confirmation, Cancel keeps it, Delete removes it', async ({
    page, searchPage, savedSearches, savedSearchesApi, uniqueName,
  }) => {
    const name = uniqueName('delete');
    const id = await savedSearchesApi.create(name);
    await searchPage.open();
    await savedSearches.open();
    const item = savedSearches.itemById(id);

    await test.step('Cancel keeps the saved search', async () => {
      await savedSearches.clickDelete(item);
      await expect(savedSearches.dialog).toContainText(`You are about to delete the saved search ${name}`);
      await savedSearches.dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(savedSearches.dialog).toBeHidden();
      await expect(item).toBeVisible();
    });

    await test.step('Delete removes it', async () => {
      await savedSearches.clickDelete(item);
      const [response] = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith(`/savedSearches/${id}`) && r.request().method() === 'DELETE'),
        savedSearches.dialog.getByRole('button', { name: 'Delete' }).click(),
      ]);
      expect(response.status()).toBe(200);
      await expect(item).toHaveCount(0);
    });

    await test.step('It does not come back after reload', async () => {
      await searchPage.reload();
      await savedSearches.open();
      await expect(savedSearches.item(name)).toHaveCount(0);
    });
  });

  test('edge case: the API rejects a name longer than 50 characters and nothing is created', async ({
    searchPage, savedSearches,
  }) => {
    // Documents today's server contract. If it changes (e.g. the UI starts truncating to 50 chars and the
    // request succeeds, or client-side validation stops the request), this test turns red on purpose.
    const name = `autotest-long-${'x'.repeat(40)}`; // 54 characters
    await searchPage.open(GUIDE_PDF_SEARCH);
    await savedSearches.open();

    const response = await savedSearches.create(name, { responseTimeout: 10_000 });

    expect(response.status()).toBe(400);
    expect((await response.json()).msg).toContain('less than or equal to 50 characters');
    await expect(savedSearches.item(name)).toHaveCount(0);
  });

  test('edge case: the user is told that a name is longer than 50 characters', async ({
    page, searchPage, savedSearches,
  }) => {
    test.info().annotations.push({
      type: 'known bug',
      description:
        'No length limit in the name field; the server rejects > 50 chars with 400 and the dialog just closes ' +
        'with no message. See docs/TEST_PLAN.md, section 8. Remove test.fail() once fixed.',
    });
    test.fail();

    const name = `autotest-long-${'x'.repeat(40)}`; // 54 characters
    await searchPage.open(GUIDE_PDF_SEARCH);
    await savedSearches.open();
    await savedSearches.fillCreateDialog(name);

    // Expected behaviour from the plan: the field limits the name to 50 characters OR a message explains it.
    // Each of these fixes makes the test pass, so Playwright reports "expected to fail but passed".
    if ((await savedSearches.nameInput.inputValue()).length <= 50) return;

    // Only a message about the limit counts: an unrelated error toast (e.g. "Seems you are offline") must not.
    // .first(): a fix may show both a dialog hint and a toast, which would be a strict mode violation,
    // and test.fail() would silently accept that as the "expected" failure.
    const message = savedSearches.dialog
      .getByText(/\b50\b/)
      .or(page.locator('.Toastify__toast--error', { hasText: /\b50\b/ }))
      .first();
    if (!(await message.isVisible())) await savedSearches.submitButton.click({ timeout: 5_000 });
    await expect(message).toBeVisible({ timeout: 5_000 });
  });
});
