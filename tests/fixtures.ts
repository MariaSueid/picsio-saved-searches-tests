import { test as base, expect, type APIRequestContext, type Page, type Response } from '@playwright/test';
import { SavedSearchesPanel } from '../pages/SavedSearchesPanel';
import { SearchPage } from '../pages/SearchPage';

/** Search used across the suite: text "guide" + Type filter "PDF documents" (see README, test data). */
export const GUIDE_PDF_SEARCH = { text: 'guide', type: 'pdf', typeOperator: 'equals' } as const;

/**
 * Thin wrapper over the Pics.io REST endpoints the UI itself calls, used for test setup and cleanup.
 * Every saved search the page creates is tracked automatically, so cleanup does not depend on
 * the test reaching any particular line.
 */
class SavedSearchesApi {
  private readonly createdIds = new Set<string>();
  private readonly pendingTracks: Promise<void>[] = [];

  constructor(private readonly request: APIRequestContext) {}

  /** Starts tracking every successful POST /savedSearches the page sends (UI-created searches). */
  watch(page: Page) {
    page.on('response', (response) => {
      if (isCreateSavedSearch(response) && response.ok()) this.pendingTracks.push(this.trackFrom(response));
    });
  }

  /** Creates a personal saved search directly through the API (fast setup for tests not about creation). */
  async create(name: string, data: Record<string, unknown> = { ...GUIDE_PDF_SEARCH }): Promise<string> {
    const response = await this.request.post('/savedSearches', { data: { name, data, shared: false } });
    // Track before asserting: if the status changes but the search was created, it must still be removed
    const id = await this.trackFrom(response);
    expect(response.status(), await response.text()).toBe(201);
    return id!;
  }

  private async trackFrom(response: Pick<Response, 'json'>): Promise<string | undefined> {
    const id = await response.json().then((body: { _id?: string }) => body._id, () => undefined);
    if (id) this.createdIds.add(id);
    return id;
  }

  /** Deletes everything first and only then asserts, so one failed delete does not leave the rest behind. */
  async cleanup() {
    await Promise.allSettled(this.pendingTracks);
    const failures: string[] = [];
    for (const id of this.createdIds) {
      // 404 is fine: the test may have deleted it already
      const response = await this.request.delete(`/savedSearches/${id}`);
      if (![200, 404].includes(response.status())) failures.push(`${id}: ${response.status()}`);
    }
    expect(failures, 'saved searches that could not be cleaned up').toEqual([]);
  }
}

export function isCreateSavedSearch(response: Response): boolean {
  return response.url().endsWith('/savedSearches') && response.request().method() === 'POST';
}

type Fixtures = {
  searchPage: SearchPage;
  savedSearches: SavedSearchesPanel;
  savedSearchesApi: SavedSearchesApi;
  /** Unique name per test so parallel or repeated runs never collide. */
  uniqueName: (label: string) => string;
};

export const test = base.extend<Fixtures>({
  searchPage: async ({ page }, use) => use(new SearchPage(page)),
  savedSearches: async ({ page }, use) => use(new SavedSearchesPanel(page)),
  // auto: tracking and cleanup run in every test, even ones that never ask for this fixture
  savedSearchesApi: [
    async ({ page }, use) => {
      // page.request shares cookies with the logged-in browser context
      const api = new SavedSearchesApi(page.request);
      api.watch(page);
      await use(api);
      await api.cleanup();
    },
    { auto: true },
  ],
  uniqueName: async ({}, use, testInfo) => {
    await use((label) => `autotest-${label}-${Date.now().toString(36)}-${testInfo.workerIndex}`);
  },
});

export { expect };
