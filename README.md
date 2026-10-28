# Pics.io Saved Searches: Playwright tests

Automated tests in Playwright and TypeScript for the **Saved searches** feature of [Pics.io](https://pics.io).
This is Part 2 of the assignment: it automates part of the test plan from Part 1, which is in
[docs/TEST_PLAN.md](docs/TEST_PLAN.md).

## What is automated and why

I followed the plan's own prioritisation (sections 3 and 4). I automated the **core** scenarios, the
stable **secondary** ones that are worth re-checking in every regression, and the **known bug** from my
exploration. I chose a small set of reliable tests over many fragile ones.

| # | Test | Plan section | Priority | What it checks |
|---|------|--------------|----------|----------------|
| 1 | **Create** a personal saved search from text + Type filter "PDF documents" | 2.1.1 | Core | `POST /savedSearches` → **201** with `text`, `type=pdf` and `shared:false` in the payload; the search appears in *Personal Saved Searches* and not in *Team Saved Searches*. Picking a sub-group in "Save to" is not covered (see Kept manual) |
| 2 | **Apply** a saved search | 2.1.2 | Core | Starting from an unfiltered library: the same asset ids as the original search, `text`/`type` in the URL, "guide" in the search bar, the "PDF documents" filter chip, and the same results counter |
| 3 | **Persistence** after reload | 2.1.8 | Core | A search created in the UI is still in the list after a page reload |
| 4 | **Rename** | 2.1.3 | Secondary | `PUT /savedSearches/:id/rename` → 200; the new name is shown and the old one is gone; after a reload, applying it returns the same assets |
| 5 | **Delete** with confirmation | 2.1.4, 2.2.3 | Secondary | The "Delete saved search?" dialog shows the name; **Cancel** keeps the search; **Delete** → `DELETE` 200 and the search disappears, also after a reload |
| 6a | **Name > 50 characters**: API contract | 2.6.3, 8 | Bug context | The server answers **400** ("must be ≤ 50 characters") and nothing is created. A regular test: it turns red as soon as this behaviour changes |
| 6b | **Name > 50 characters**: user feedback (known bug) | 2.6.3, 8 | Bug | Expected: the field limits the name to 50 characters **or** a message explains the error. Today neither happens, so it is marked `test.fail()`, see below |

### Kept manual, and why

| Area (plan section) | Why it is not automated |
|---|---|
| UI/UX, icon tooltips (2.2) | These need a person to judge them. An automated check of tooltip text adds maintenance cost and catches little. |
| Favourites, move between folders and sub-groups in "Save to", search within saved searches (2.1.5–7) | Lower priority (section 3). They are easy to add on top of the existing page object if regression needs them. |
| Security: another user's searches, ID swapping (2.5) | Needs a second account and team setup. Sharing and permissions are out of scope (section 1). |
| Performance (2.4) | A free trial with 6 assets gives numbers that mean nothing. This needs a large library and a dedicated tool. |
| Cross-browser and mobile (2.7) | The suite runs on **Chromium only**. WebKit does not start on my machine without extra system libraries. Adding a browser is one entry in `projects` in [playwright.config.ts](playwright.config.ts). |
| Offline and slow network (2.3.2–3) | Checked manually. The offline message works (Observations, item 2). |
| Other edge cases: empty name, duplicate name (2.6.1–2) | Low risk, so these stay manual. An empty name simply keeps **Ok** disabled. |

## How the suite is built

```
pages/
  SearchPage.ts           search bar, results counter, waits for POST /images/search
  SavedSearchesPanel.ts   saved-searches tree, Create / Delete dialogs, rename
tests/
  auth.setup.ts           logs in once (or reuses a saved session), writes storageState
  fixtures.ts             page objects, API helper for setup/cleanup, unique test names
  saved-searches.spec.ts  the tests from the table above
scripts/
  save-session.mts        one-time manual login for Google / Microsoft SSO accounts
docs/TEST_PLAN.md         Part 1
```

Design decisions:
- **"Same results" is checked by data, not by pixels.** The tests read asset ids from the
  `POST /images/search` response, which is the same request the UI renders from. They compare the
  original search with the applied saved search as sorted id lists. They also check the visible
  results counter and filter chip.
- **Test isolation.** Only the test that is *about* creation creates a search through the UI. Rename,
  delete and apply set up their data with `POST /savedSearches`, which is the same endpoint the UI
  calls. That way a broken Create dialog fails one test instead of five.
- **Cleanup.** An auto fixture listens to every successful `POST /savedSearches` the page sends and
  records the new id. API-created searches are recorded *before* their status is asserted. Teardown
  deletes them all through the API, even if a test fails halfway or the backend returns an unexpected
  status. Teardown first tries every delete and only then reports failures, so one bad delete does not
  leave the rest behind. Names are unique per run
  (`autotest-<label>-<timestamp>`), so a failed run never clashes with the next one.
- **Personal, not shared.** Test searches are saved with "Share with my team" switched off. They don't
  show up for teammates, and sharing is out of scope.
- **Selectors.** In order of preference: `data-testid` (the app has them for the dialog, the name input,
  share and the row actions), then ARIA roles and names (`treeitem`, `button "Delete"`), then a CSS
  class only where the app gives nothing better. Some examples: icon-only buttons with no accessible
  name, and dialogs that are not `role="dialog"`. Every such case has a comment.
- **Waiting on the network, not on timeouts.** The suite has no `waitForTimeout`. Actions that hit the
  backend wait for their exact request. One real flake I hit: after `reload()` the app starts its own
  library search, and the next "apply" picked up *that* response. `SearchPage.reload()` now waits for
  the initial search first.
- **Known bug: two tests, only one with `test.fail()`.** `test.fail()` treats *any* failure as
  expected, so it wraps only the user-facing assertion (6b). That assertion accepts each realistic
  fix: a `maxlength` on the field, client-side validation, or a server error shown in the UI. Only a
  message that mentions the limit counts, so an unrelated error toast such as "Seems you are offline"
  doesn't. The test also passes when a fix shows a dialog hint and a toast at the same time. Any of
  them makes Playwright report "expected to fail but passed", which reminds you to remove
  `test.fail()`. The server contract (400, nothing created) lives in a separate, regular test (6a).
  If the fix changes that behaviour, 6a turns red instead of hiding the change.
- **Serial run** (`workers: 1`). All tests share one live account and one saved-searches tree.
  The run takes about 1.5 minutes.

## Running locally

Requirements: Node.js 22.18+ (`npm run auth` runs a `.mts` file with type annotations, which Node runs natively only from 22.18) and a Pics.io account (a free trial works).

```bash
npm ci
npx playwright install chromium
```

**Test data.** The account needs at least one **PDF whose text matches "guide"** in the library. The
"apply" test fails with a clear message if there is none.

**Authentication.** Choose one option.

- **Email and Pics.io password.** Copy `.env.example` to `.env` and fill it in:
  ```
  PICSIO_EMAIL=you@example.com
  PICSIO_PASSWORD=...
  ```
  `tests/auth.setup.ts` logs in once per run.

- **Google / Microsoft sign-in (no password stored anywhere).**
  ```bash
  npm run auth
  ```
  A real Chrome window opens. Log in as usual. The script saves **only the `pics.io` cookies** to
  `playwright/.auth/user.json`, which is git-ignored, and deletes the temporary browser profile. Run
  it again when the session expires; the setup step will tell you when that happens.

**Run:**
```bash
npm test               # headless, Chromium
npm run test:headed    # watch it run
npm run report         # open the HTML report (traces, screenshots and video on failure)
```

Expected result: `8 passed`, which is the login setup plus the 7 tests. Test 6b is listed with ✘ because it is an *expected* failure (`test.fail()`).

**CI.** [.github/workflows/playwright.yml](.github/workflows/playwright.yml) runs on manual trigger only
(`workflow_dispatch`). The suite hits a live account, so it needs `PICSIO_EMAIL` / `PICSIO_PASSWORD`
repository secrets. SSO sessions can't be used in CI.

## Where AI helped

I used **Claude Code** (Anthropic's CLI agent) during implementation.

- **Selector strategy.** The UI has many icon-only buttons with no accessible names. Claude Code drove a
  headless browser against the live app and dumped ARIA snapshots, `data-testid` attributes and
  tooltips. That is how I found `savedSearchRename` / `savedSearchDelete` / `saveSearchShare` etc.,
  and noticed that a favourite search is rendered twice with the same `data-id`. Because of this,
  locators are scoped to a tree section.
- **API discovery.** It logged the network traffic for create, rename, delete and favourite, so the
  tests could assert on real endpoints and payloads. It also showed that create returns **201**, not
  200 as I had assumed in the plan, and it reproduced the 400 bug from my exploration.
- **Flake analysis.** It found the cause of the reload/apply race described above and suggested the fix.
- **Auth without sharing my password.** It wrote the one-time SSO session script, including stripping
  Google cookies from the saved state.
- **Scaffolding.** It wrote the first drafts of the page objects and fixtures.

I made the decisions myself: which scenarios to automate, isolation through API setup, `test.fail()` for
the known bug, and Chromium only. I also reviewed every test against the plan.
