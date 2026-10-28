# Test plan: Saved searches in Pics.io (Part 1)

## 1. Overview

**Feature under test:** Saved searches. A user can save a combination of search text and filters
and reuse it in one click, instead of setting up the same filters again and again.

**Why I chose it:** Saved searches are a real time-saver for teams working with large asset
libraries, so a bug here directly affects daily work. The feature also has clear, verifiable
expected results (the same search must always return the same assets), which makes it a good
candidate for both manual and automated testing.

**In scope:** Creating, applying, renaming, deleting, adding to favourites, organising in folders,
and searching within saved searches.

**Out of scope:**
- Team management and sharing permissions ("Share with my team"), as these areas are protected on the backend
- Authentication flows
- AI Visual Search
- Asset upload and processing (used only to prepare test data)
- Native mobile apps

**Test environment:**
- OS: Ubuntu 22.04.5 LTS
- Browser: Google Chrome, screen resolution 1920x1080
- Network: Wi-Fi, no throttling
- Account: free trial, owner role
- Test data: 6 assets (JPG, PDF, MP4), including PDFs uploaded by me

## 2. Testing aspects

### 2.1 Functional
1. Create a saved search from a text query and filters: it appears in the selected folder.
2. Apply a saved search: it returns the same assets and filters as the original search.
3. Rename a saved search: the new name is displayed and the results stay the same.
4. Delete a saved search: a confirmation dialog is shown (Cancel / Delete); after confirming, the search disappears from the list.
5. Add to favourites: a confirmation message is shown, and the search appears in favourites.
6. Move a saved search between folders: it appears in the new folder and is removed from the old one.
7. Search within saved searches: the list is filtered by saved search name.
8. Reload the page: all saved searches, names, and folders persist.

### 2.2 UI and UX
1. "Create saved search" modal
2. Icon tooltips (all icons used for creating, updating, moving, deleting, adding to favourites)
3. "Delete saved search?" modal

### 2.3 API and networking
1. Check requests in DevTools (Network) when I create, apply, rename and delete a saved search: correct method, status code 200, correct data in payload and response.
2. Slow network (throttling in DevTools): saved search still works, loading state is shown.
3. No internet while saving: user sees an error message "Seems you are offline. Please check your internet connection."

### 2.4 Performance
1. Time to apply a saved search (results are shown in a few seconds).
2. Time to load the saved searches list when there are many saved searches.
3. Apply a saved search in a library with many assets.

### 2.5 Security
1. Another logged-in user cannot see saved searches of my user.
2. Change the saved search ID in the URL to an ID of another user: no access to their saved search.

### 2.6 Edge cases
1. Add a saved search with an empty name
2. Add the same name twice for a saved search
3. Add a very long name (see Observations)

### 2.7 Cross-browser and cross-device
1. Main scenarios in Chrome, Firefox, Safari and Edge.
2. Mobile-adapted layout (narrow browser window): saved searches can be created and applied.

## 3. Prioritisation

**Approach:** Risk-based: I start with scenarios that users do most often and that break their work if they fail.

**Core scenarios (high priority):**
1. Create a saved search
2. Apply a saved search and get the same results
3. Saved searches persist after page reload

**Secondary scenarios (medium/low priority):**
1. Rename, delete, move between folders
2. Add to favourites, search within saved searches
3. Tooltips and other UI details

## 4. Automation

**Worth automating:** Stable, frequently repeated scenarios, e.g. create → apply → rename → delete.
They are checked in every regression, so automation saves time.

**Better to keep manual:** UX checks, tooltips, exploratory testing, and new edge cases.

## 5. Tools

- Playwright (TypeScript): automated test cases
- Chrome DevTools: Network, Console, Application, Performance
- Postman / Swagger: API checks
- TestRail: test cases
- Jira: bug reports and other documentation
- AI tools (Claude Code, ChatGPT): creating test cases, writing bug reports, new test ideas

## 6. Metrics and benchmarks

- Response time of save and apply requests
- Time to show search results
- Number of bugs by severity
- Test pass rate
- Stability of automated tests (no flaky tests)

## 7. Communicating results

- Bug reports with priority and severity are created in Jira and assigned to the responsible developers, with a direct message about each new bug.
- Critical bugs are discussed with the team right away.
- All risks are written down and discussed with the team.
- After testing, I share a short test summary: what was tested, found bugs, open risks and my recommendation for the release.

## 8. Observations and questions from exploration

1. **Bug:** the saved search name field has no length limit, but the server accepts only 50 characters.
   When I enter a longer name and click "Ok", the request fails with `400 Bad Request` and the saved
   search is not created, but the user sees no error message. The field should limit the name to
   50 characters or show a validation message. Response:
   ```json
   {
     "msg": "child \"body\" fails because [child \"name\" fails because [\"name\" length must be less than or equal to 50 characters long]]"
   }
   ```
2. **Positive:** when saving without internet, a clear error message is shown: "Seems you are offline. Please check your internet connection".
