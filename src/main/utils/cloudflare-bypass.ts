import { WebContents } from 'electron';

export class CloudflareBypasser {
  private static MAX_RETRIES = 20; // 40 seconds approx
  private static RETRY_DELAY = 2000;

  public async ensureBypass(webContents: WebContents): Promise<boolean> {
    console.log('[CloudflareBypasser] Checking for challenge...');

    for (let i = 0; i < CloudflareBypasser.MAX_RETRIES; i++) {
      const isChallenge = await this.isChallengePage(webContents);

      if (!isChallenge) {
        if (i > 0) {
          console.log('[CloudflareBypasser] Challenge passed!');
        } else {
          console.log('[CloudflareBypasser] No challenge detected.');
        }
        return true;
      }

      console.log(
        `[CloudflareBypasser] Challenge detected. Waiting... (${i + 1}/${CloudflareBypasser.MAX_RETRIES})`,
      );

      // Simulate some basic human-like delay
      await new Promise((resolve) => setTimeout(resolve, CloudflareBypasser.RETRY_DELAY));
    }

    console.error('[CloudflareBypasser] Failed to bypass challenge within timeout.');
    return false;
  }

  private async isChallengePage(webContents: WebContents): Promise<boolean> {
    try {
      const title = webContents.getTitle();
      if (title.includes('Just a moment') || title.includes('Human Verification')) {
        return true;
      }

      return await webContents
        .executeJavaScript(
          `
        (() => {
          // Check for common Cloudflare/Turnstile indicators
          if (document.querySelector('iframe[src*="challenges.cloudflare.com"]')) return true;
          if (document.getElementById('challenge-running')) return true;
          if (document.querySelector('#cf-please-wait')) return true;
          // Check text content
          const bodyText = document.body.innerText;
          if (bodyText.includes('Verifying you are human') || bodyText.includes('Checking your browser')) return true;

          return false;
        })()
      `,
        )
        .catch(() => false);
    } catch (error) {
      // If execution fails (e.g. page loading), assume busy/challenge
      return true;
    }
  }
}
