/** Returns catalog of Pro-Cafe companion apps and download QR codes for settings display. */
import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

type AppEntry = {
  id: string;
  name: string;
  tagline: string;
  iosUrl: string | null;
  androidUrl: string | null;
  landingUrl?: string | null;
};

const BASE_URL = 'https://pos.15.207.179.83.nip.io';

const MORE_APPS: AppEntry[] = [
  {
    id: 'pro-cafe-mobile',
    name: 'Pro-Cafe Mobile POS (Android & iOS)',
    tagline: 'Full POS register and operations app for mobile and tablet devices.',
    iosUrl: `${BASE_URL}/pos`,
    androidUrl: `${BASE_URL}/pos`,
    landingUrl: `${BASE_URL}/pos`,
  },
  {
    id: 'pro-cafe-server',
    name: 'Pro-Cafe Waiter & Server App (Android & iOS)',
    tagline: 'Tableside mobile ordering for floor staff on any smartphone or tablet.',
    iosUrl: `${BASE_URL}/server-standalone`,
    androidUrl: `${BASE_URL}/server-standalone`,
    landingUrl: `${BASE_URL}/server-standalone`,
  },
  {
    id: 'pro-cafe-kds',
    name: 'Pro-Cafe Kitchen Display System (KDS)',
    tagline: 'Live kitchen ticket management for kitchen screens, tablets, and phones.',
    iosUrl: `${BASE_URL}/kds-standalone`,
    androidUrl: `${BASE_URL}/kds-standalone`,
    landingUrl: `${BASE_URL}/kds-standalone`,
  },
  {
    id: 'pro-cafe-order',
    name: 'Pro-Cafe Online Order & Pickup Portal',
    tagline: 'Customer digital menu, contactless online ordering, and loyalty rewards.',
    iosUrl: `${BASE_URL}/order`,
    androidUrl: `${BASE_URL}/order`,
    landingUrl: `${BASE_URL}/order`,
  },
];

const REVFLO_APP: AppEntry = {
  id: 'revflo',
  name: 'Pro-Cafe Mobile (Android / iOS)',
  tagline: 'Access live sales, daily summaries, kitchen tickets, and reports right from your Android or iOS device.',
  iosUrl: `${BASE_URL}/dashboard`,
  androidUrl: `${BASE_URL}/dashboard`,
  landingUrl: BASE_URL,
};

async function toAppResponse(app: AppEntry) {
  const primaryUrl = app.iosUrl || app.androidUrl || app.landingUrl || null;
  let qrDataUrl: string | null = null;
  if (primaryUrl) {
    try {
      qrDataUrl = await QRCode.toDataURL(primaryUrl, { errorCorrectionLevel: 'M', width: 256 });
    } catch (err) {
      console.warn(`[MoreApps] QR generation failed for ${app.id}:`, err);
    }
  }
  return {
    id: app.id,
    name: app.name,
    tagline: app.tagline,
    ios_url: app.iosUrl,
    android_url: app.androidUrl,
    landing_url: app.landingUrl || null,
    qr_data_url: qrDataUrl,
    available: Boolean(primaryUrl),
  };
}

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const apps = await Promise.all(MORE_APPS.map(toAppResponse));
    res.json({ apps });
  } catch (error: any) {
    console.error('[API] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

// GET /api/more-apps/revflo — backs the consolidated Pro-Cafe Mobile card in
// Settings → Mobile Access.
router.get('/revflo', asyncHandler(async (_req: Request, res: Response) => {
  try {
    res.json({ app: await toAppResponse(REVFLO_APP) });
  } catch (error: any) {
    console.error('[API] Internal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}));

export const moreAppsRoutes = router;
