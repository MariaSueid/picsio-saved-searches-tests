import { expect, type Locator, type Page, type Response } from '@playwright/test';

/** Asset search page (/search): search bar, filters toolbar, results counter. */
export class SearchPage {
  readonly searchInput: Locator;
  readonly resultsCounter: Locator;
  readonly saveSearchButton: Locator;

  constructor(readonly page: Page) {
    this.searchInput = page.getByRole('textbox', { name: 'Search all collections' });
    this.resultsCounter = page.locator('.searchHeader-counter');
    // Icon-only button without an accessible name; its tooltip is "Save this search"
    this.saveSearchButton = page.locator('.searchFilters__iconBtn').nth(1);
  }

  /** Waits for the next asset search request the UI sends (POST /images/search). */
  waitForSearchResponse(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.url().endsWith('/images/search') && r.request().method() === 'POST',
    );
  }

  /** Opens /search with the given query params and returns the ids of the found assets. */
  async open(params: Record<string, string> = {}): Promise<string[]> {
    const query = new URLSearchParams(params).toString();
    const [response] = await Promise.all([
      this.waitForSearchResponse(),
      this.page.goto(`/search${query ? `?${query}` : ''}`),
    ]);
    return assetIds(response);
  }

  /** Reloads and waits for the initial search, so it can't be mistaken for the next one. */
  async reload() {
    await Promise.all([this.waitForSearchResponse(), this.page.reload()]);
  }

  async expectResultsCount(count: number) {
    await expect(this.resultsCounter).toHaveText(new RegExp(`^\\s*${count}\\s+assets?\\s*$`));
  }
}

/** Sorted asset ids from a POST /images/search response, so two searches can be compared. */
export async function assetIds(response: Response): Promise<string[]> {
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { images: { _id: string }[] };
  return body.images.map((image) => image._id).sort();
}
