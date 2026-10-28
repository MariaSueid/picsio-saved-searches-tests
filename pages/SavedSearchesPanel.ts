import { expect, type Locator, type Page, type Response } from '@playwright/test';

export type SavedSearchSection = 'Favorites' | 'Team Saved Searches' | 'Personal Saved Searches';

/** Left "Saved searches" panel plus the "Create saved search" and "Delete saved search?" dialogs. */
export class SavedSearchesPanel {
  readonly openButton: Locator;
  readonly saveSearchButton: Locator;
  readonly filterInput: Locator;
  readonly dialog: Locator;
  readonly nameInput: Locator;
  readonly submitButton: Locator;
  readonly shareCheckbox: Locator;
  readonly saveToTree: Locator;

  constructor(readonly page: Page) {
    this.openButton = page.locator('#button-search');
    // Icon-only button in the search toolbar without an accessible name; its tooltip is "Save this search"
    this.saveSearchButton = page.locator('.searchFilters__iconBtn').nth(1);
    this.filterInput = page.getByRole('textbox', { name: 'Search in saved searches' });
    // Pics.io dialogs are not role="dialog", the shared .simpleDialogBox container is the stable hook
    this.dialog = page.locator('.simpleDialogBox');
    this.nameInput = page.getByTestId('saveSearchDialogNameInput');
    this.submitButton = this.dialog.getByRole('button', { name: 'Ok' });
    this.shareCheckbox = page.getByTestId('saveSearchShare');
    this.saveToTree = page.getByTestId('saveSearchTree');
  }

  async open() {
    // The app remembers the last opened panel, and clicking an already active tab collapses it
    await expect(this.openButton).toBeVisible();
    if (!(await this.openButton.evaluate((el) => el.classList.contains('active')))) await this.openButton.click();
    await expect(this.section('Personal Saved Searches')).toBeVisible();
  }

  section(name: SavedSearchSection): Locator {
    return this.page.getByRole('treeitem', { name: new RegExp(`^${name}`) });
  }

  /**
   * A saved search inside one section. Scoping by section matters: a favourite search is rendered
   * twice (in Favorites and in its own section) with the same data-id.
   */
  item(name: string, section: SavedSearchSection = 'Personal Saved Searches'): Locator {
    return this.section(section).getByRole('treeitem', { name, exact: true });
  }

  /** Same item located by id, survives renaming (the accessible name changes while editing). */
  itemById(id: string, section: SavedSearchSection = 'Personal Saved Searches'): Locator {
    return this.section(section).locator(`li[role="treeitem"][data-id="${id}"]`);
  }

  /** Opens "Create saved search", picks personal/team and types the name, without submitting. */
  async fillCreateDialog(name: string, { shared = false } = {}) {
    await this.saveSearchButton.click();
    await expect(this.dialog.getByText('Create saved search')).toBeVisible();
    await this.setShared(shared);
    await this.nameInput.fill(name);
  }

  /** Fills and submits "Create saved search" as a personal (not shared) search. Returns the POST response. */
  async create(name: string, { shared = false, responseTimeout = 15_000 } = {}): Promise<Response> {
    await this.fillCreateDialog(name, { shared });
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().endsWith('/savedSearches') && r.request().method() === 'POST',
        { timeout: responseTimeout },
      ),
      this.submitButton.click(),
    ]);
    return response;
  }

  async setShared(shared: boolean) {
    const isChecked = (await this.shareCheckbox.getAttribute('class'))?.includes('UICheckbox--checked');
    if (isChecked !== shared) await this.shareCheckbox.click();
  }

  /** Clicks a saved search to apply it and waits for the asset search it triggers. */
  async apply(item: Locator): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().endsWith('/images/search') && r.request().method() === 'POST'),
      item.click(),
    ]);
    return response;
  }

  async rename(item: Locator, newName: string): Promise<Response> {
    // Action icons appear only on hover
    await item.hover();
    await item.getByTestId('savedSearchRename').click();
    await item.getByRole('textbox').fill(newName);
    const [response] = await Promise.all([
      this.page.waitForResponse((r) => r.url().endsWith('/rename') && r.request().method() === 'PUT'),
      item.getByRole('textbox').press('Enter'),
    ]);
    return response;
  }

  async clickDelete(item: Locator) {
    await item.hover();
    await item.getByTestId('savedSearchDelete').click();
    await expect(this.dialog.getByText('Delete saved search?')).toBeVisible();
  }
}
