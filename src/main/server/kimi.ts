import { net, BrowserWindow, session } from 'electron';

export async function login() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL('https://kimi.moonshot.cn/');

  return new Promise<{ cookies: string }>((resolve, reject) => {
    let manuallyClosed = false;
    let initialGuestCookieValue = '';

    const checkCookies = setInterval(async () => {
      try {
        const cookies = await session.defaultSession.cookies.get({
          url: 'https://kimi.moonshot.cn',
        });
        const authCookie = cookies.find((c) => c.name === 'kimi-auth');

        // Check www.kimi.com as well
        const cookiesCom = await session.defaultSession.cookies.get({
          url: 'https://www.kimi.com',
        });
        const authCookieCom = cookiesCom.find((c) => c.name === 'kimi-auth');

        const targetCookie = authCookie || authCookieCom;

        if (targetCookie) {
          const cookieString = (authCookie ? cookies : cookiesCom)
            .map((c) => `${c.name}=${c.value}`)
            .join('; ');

          // Helper to finish login
          const finishLogin = () => {
            console.log('[Kimi] Login success.');
            manuallyClosed = true;
            clearInterval(checkCookies);
            win.destroy();
            resolve({ cookies: cookieString });
          };

          const currentCookieValue = targetCookie.value;

          // 1. Check Profile
          const profile = await getProfile(cookieString);
          console.log('[Kimi] Checked profile:', profile);

          if (profile && profile.name !== '虚拟用户') {
            console.log('[Kimi] Valid profile found (Name != Guest).');
            finishLogin();
            return;
          }

          // 2. Check Cookie Change (If we started with a Guest Cookie, and it changed, we assume login)
          if (initialGuestCookieValue && currentCookieValue !== initialGuestCookieValue) {
            console.log('[Kimi] Auth cookie changed (Guest -> User), assuming success.');
            finishLogin();
            return;
          }

          // 3. Still Guest
          if (profile && profile.name === '虚拟用户') {
            console.log('[Kimi] Guest profile detected.');
            if (!initialGuestCookieValue) {
              initialGuestCookieValue = currentCookieValue;
              console.log(
                '[Kimi] Recorded initial guest cookie:',
                initialGuestCookieValue.substring(0, 10) + '...',
              );
            }
          }
        }
      } catch (error) {
        if (!manuallyClosed) {
          console.log('[Kimi] Error checking cookies (retrying):', error);
        }
      }
    }, 1000);

    win.on('closed', () => {
      // If the user closes the window manually, use whatever cookies we captured last
      // preventing the "Error: Login window closed" rejection.
      clearInterval(checkCookies);

      if (manuallyClosed) return; // Already resolved via auto-detection

      console.log('[Kimi] Window closed manually. Checking if we have any cookies...');

      // We need to fetch the cookies one last time or use a cached variable.
      // Since we can't fetch from a destroyed window's session easily if it's gone,
      // we rely on the fact that the session persists in the partition.

      session.defaultSession.cookies
        .get({ url: 'https://kimi.moonshot.cn' })
        .then((cookies) => {
          const authCookie = cookies.find((c) => c.name === 'kimi-auth');
          if (authCookie) {
            const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
            console.log('[Kimi] resolving with last known cookies from manual close.');
            resolve({ cookies: cookieString });
          } else {
            // Try www.kimi.com
            session.defaultSession.cookies
              .get({ url: 'https://www.kimi.com' })
              .then((cookiesCom) => {
                const authCookieCom = cookiesCom.find((c) => c.name === 'kimi-auth');
                if (authCookieCom) {
                  const cookieString = cookiesCom.map((c) => `${c.name}=${c.value}`).join('; ');
                  resolve({ cookies: cookieString });
                } else {
                  reject(new Error('Window closed but no Kimi credentials found.'));
                }
              });
          }
        })
        .catch((err) => {
          // Fallback: if we can't get cookies (e.g. session cleared?), try best effort or reject
          reject(new Error('Window closed and failed to retrieve final cookies: ' + err.message));
        });
    });
  });
}

export async function getProfile(cookies: string) {
  // Extract token from cookies for Authorization header
  const match = cookies.match(/kimi-auth=([^;]+)/);
  const token = match ? match[1] : '';

  // Determine base URL based on where we found the cookie or default
  // The log uses www.kimi.com, but let's try to infer or fallback.
  // We'll try www.kimi.com as per the log.
  const baseUrl = 'https://www.kimi.com';

  return new Promise<{ name: string; avatar: string; email: string } | null>((resolve) => {
    const request = net.request({
      method: 'GET',
      url: `${baseUrl}/api/user`,
    });

    request.setHeader('Cookie', cookies);
    request.setHeader('Authorization', `Bearer ${token}`);
    request.setHeader(
      'User-Agent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => (data += chunk.toString()));
      response.on('end', () => {
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            // Kimi API might return { name: ... } or { user: { name: ... } }
            const name = json.name || json.user?.name || 'Kimi User';
            const avatar = json.avatar || json.user?.avatar || '';
            const email = json.email || json.user?.email || ''; // Often empty for Kimi

            resolve({
              name,
              avatar,
              email,
            });
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    request.on('error', () => resolve(null));
    request.end();
  });
}

export async function sendMessage() {
  // Placeholder
  throw new Error('Not implemented');
}
