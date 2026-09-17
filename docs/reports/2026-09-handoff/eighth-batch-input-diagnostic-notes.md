# Eighth batch input diagnostic

- Goal: distinguish browser-input transport failure from game load by using static HTML with two counters, no framework/assets/storage/network dependencies.
- Refreshed computer-use and browser verification skills. The current CUA contract provides createBrowserTab('iab', url, {visible:true}); native APIs are disabled. Use this documented CUA surface, with no alternate CDP/Playwright or native bypass.
- Isolated loopback origin4406, own static page/server only. Product src/dist and original user storage remain untouched.
- Planned observation: actual click increments mouse counter; Tab/Enter increments keyboard counter; verify DOM text and trusted event display. One bounded reconnect/recovery on connection failure, then stop recurrence. Report exact observed boundary.
- If healthy, notify root and prepare the current production App fixture/server separately. Full manual-journey priorities await coordination.

## Observed (2026-09-15T01:20:42.683Z)

- iab returned Browser is not available: iab. CUA inventory showed only Edge browser1. Opened one fresh Edge tab1908172962.
- Actual mouse click incremented0→1 and displayed trusted=true/detail1. Actual Tab→Enter incremented the second counter0→1 and displayed trusted=true/detail0. DOM and AX reflected both changes. No reconnect or input transport timeout was needed on this diagnostic.
- Screenshot and structured DOM evidence saved. Recent warn/error(limit12) returned[]. Do not infer the game causes transport problems solely from this short successful control.
- Own diagnostic server68653 stopped; port4406 closed=true. No viewport change or storage access.
- Prepared work/eighth-batch-app-server.mjs, not started: new4407 origin reads unmodified production dist and offers /__input-diagnostic control page. Full journey priorities and any seed fixture await root coordination.
