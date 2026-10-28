import { test as base, expect } from '@playwright/test';
import { SavedSearchesPanel } from '../pages/SavedSearchesPanel';
import { SearchPage } from '../pages/SearchPage';

/** Search used across the suite: text "guide" + Type filter "PDF documents" (see README, test data). */
export const GUIDE_PDF_SEARCH = { text: 'guide', type: 'pdf', typeOperator: 'equals' } as const;

/** Thin wrapper over the Pics.io REST endpoints the UI itself calls, used for test setup and cleanup. */
class SavedSearchesApi {
  private readonly createdIds = new Set<string>();

  constructor(private readonly request: import('@playwright/test').APIRequestContext) {}

  /** Creates a personal saved search directly through the API (fast setup for tests not about creation). */
  async create(name: string, data: Record<string, unknown> = { ...GUIDE_PDF_SEARCH }): Promise<string> {
    const response = await this.request.post('/savedSearches', { data: { name, data, shared: false } });
    expect(response.status(), await response.text()).toBe(201);
    const { _id } = (await response.json()) as { _id: string };
    this.track(_id);
    return _id;
  }

  /** Registers a saved search created through the UI so it is removed after the test. */
  track(id: string) {
    this.createdIds.add(id);
  }

  async cleanup() {
    for (const id of this.createdIds) {
      // 404 is fine: the test may have deleted it already
      const response = await this.request.delete(`/savedSearches/${id}`);
      expect([200, 404]).toContain(response.status());
    }
  }
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
  savedSearchesApi: async ({ page }, use) => {
    // page.request shares cookies with the logged-in browser context
    const api = new SavedSearchesApi(page.request);
    await use(api);
    await api.cleanup();
  },
  uniqueName: async ({}, use, testInfo) => {
    await use((label) => `autotest-${label}-${Date.now().toString(36)}-${testInfo.workerIndex}`);
  },
});

export { expect };
