export default async (s) => {
  await s.page.goto('http://127.0.0.1:4409/', { waitUntil: 'networkidle' });
  const text = await s.page.locator('body').innerText();
  const shot = await s.snap('title');
  const storage = await s.page.evaluate(() => ({ ...localStorage }));
  s.log('fresh-title', { text, storage, shot, errors: s.errors, failedRequests: s.failedRequests });
  return { text, storageKeys: Object.keys(storage), shot, errors: s.errors };
};
