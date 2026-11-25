import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return {};
  }
}

const firebaseConfig = loadFirebaseConfig();
const isValidProject =
  Boolean(firebaseConfig.projectId) &&
  firebaseConfig.projectId !== 'remixed-project-id';

const adminApp = isValidProject
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId: firebaseConfig.projectId })
  : null;

const adminAuth = adminApp ? getAuth(adminApp) : null;

interface AuthUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  isBootstrapAdmin: boolean;
}

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

const BOOTSTRAP_ADMIN_EMAIL = 'abdullahjavaid0307@gmail.com';

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!adminAuth) {
    res.status(503).json({ error: 'Authentication service not configured.' });
    return;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Bearer authorization token.' });
    return;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken || idToken.length > 4096) {
    res.status(401).json({ error: 'Invalid authorization token format.' });
    return;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email || decoded.email_verified !== true) {
      res.status(403).json({ error: 'Verified email account required.' });
      return;
    }
    req.authUser = {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: Boolean(decoded.email_verified),
      isBootstrapAdmin: decoded.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
  }
}

function sanitizeString(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  if (email.length < 3 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getUpcomingSlots() {
  const now = new Date();
  const formatDay = (offsetDays: number, fallbackLabel: string) => {
    const date = new Date(now);
    date.setDate(now.getDate() + offsetDays);
    const weekday =
      offsetDays === 1
        ? 'Tomorrow'
        : date.toLocaleDateString('en-US', { weekday: 'long' });
    const shortDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return {
      id: `day_${offsetDays}`,
      label: weekday || fallbackLabel,
      dateText: shortDate,
      fullLabel: `${weekday || fallbackLabel} (${shortDate})`,
    };
  };

  return {
    timezone: 'EST',
    dates: [
      formatDay(1, 'Tomorrow'),
      formatDay(2, 'Thursday'),
      formatDay(3, 'Friday'),
    ],
    timeSlots: ['10:00 AM', '01:30 PM', '04:00 PM'],
  };
}

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'acme-growth-platform' });
  });

  app.get('/api/slots', (_req: Request, res: Response) => {
    res.json(getUpcomingSlots());
  });

  app.get(
    '/api/me',
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      res.json({
        authenticated: true,
        user: req.authUser,
      });
    },
  );

  app.post(
    '/api/bookings/validate',
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const contactName = sanitizeString(body.contactName, 100);
      const workEmail = sanitizeString(body.workEmail, 254).toLowerCase();
      const companyName = sanitizeString(body.companyName, 120);
      const dateLabel = sanitizeString(body.dateLabel, 40);
      const timeSlot = sanitizeString(body.timeSlot, 20);

      if (contactName.length < 1) {
        res.status(400).json({ error: 'Contact name is required.' });
        return;
      }
      if (!isValidEmail(workEmail)) {
        res.status(400).json({ error: 'Please enter a valid work email.' });
        return;
      }
      if (companyName.length < 1) {
        res.status(400).json({ error: 'Company name is required.' });
        return;
      }
      if (dateLabel.length < 1 || timeSlot.length < 1) {
        res.status(400).json({ error: 'Please select a date and time slot.' });
        return;
      }

      const validTimes = new Set(['10:00 AM', '01:30 PM', '04:00 PM']);
      if (!validTimes.has(timeSlot)) {
        res.status(400).json({ error: 'Selected time slot is unavailable.' });
        return;
      }

      const codeSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      const confirmationCode = `ACME-${codeSuffix}`;

      res.json({
        valid: true,
        booking: {
          userId: req.authUser!.uid,
          userEmail: req.authUser!.email,
          contactName,
          workEmail,
          companyName,
          dateLabel,
          timeSlot,
          status: 'pending',
          confirmationCode,
          notes: '',
        },
      });
    },
  );

  app.post(
    '/api/audit/calculate',
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const companyName = sanitizeString(body.companyName, 120);
      const city = sanitizeString(body.city, 100);

      const monthlyCalls = Number(body.monthlyCalls);
      const avgTicketValue = Number(body.avgTicketValue);
      const monthlyAdSpend = Number(body.monthlyAdSpend);
      const currentReviews = Number(body.currentReviews);

      if (companyName.length < 1 || city.length < 1) {
        res.status(400).json({ error: 'Company name and city are required.' });
        return;
      }
      if (
        !Number.isFinite(monthlyCalls) ||
        monthlyCalls < 0 ||
        monthlyCalls > 100000
      ) {
        res.status(400).json({ error: 'Invalid monthly inbound calls value.' });
        return;
      }
      if (
        !Number.isFinite(avgTicketValue) ||
        avgTicketValue < 50 ||
        avgTicketValue > 1000000
      ) {
        res
          .status(400)
          .json({ error: 'Average ticket value must be at least $50.' });
        return;
      }
      if (
        !Number.isFinite(monthlyAdSpend) ||
        monthlyAdSpend < 0 ||
        monthlyAdSpend > 1000000
      ) {
        res.status(400).json({ error: 'Invalid monthly ad spend value.' });
        return;
      }
      if (
        !Number.isFinite(currentReviews) ||
        currentReviews < 0 ||
        currentReviews > 100000
      ) {
        res.status(400).json({ error: 'Invalid review count.' });
        return;
      }

      // Deterministic B2B local growth benchmark model
      const reviewBenchmark = 160;
      const reviewGapRatio = Math.max(
        0.15,
        Math.min(1, (reviewBenchmark - currentReviews) / reviewBenchmark),
      );
      const baseCallLiftPct = Math.round(
        65 + reviewGapRatio * 85 + (monthlyAdSpend > 2500 ? 18 : 8),
      );
      const projectedCallsLiftPct = Math.min(240, baseCallLiftPct);

      const effectiveBaseCalls = Math.max(8, monthlyCalls);
      const incrementalCalls = Math.round(
        effectiveBaseCalls * (projectedCallsLiftPct / 100),
      );
      const closeRate = 0.24;
      const projectedExtraRevenue = Math.round(
        incrementalCalls * closeRate * avgTicketValue,
      );

      const rawVisibility = Math.round(
        Math.min(
          94,
          Math.max(
            22,
            28 +
              Math.min(40, currentReviews * 0.28) +
              Math.min(26, monthlyCalls * 0.4),
          ),
        ),
      );

      const recommendations: string[] = [];
      if (currentReviews < 100) {
        recommendations.push(
          `Deploy post-job SMS review sequences in ${city} to cross 100+ verified Google reviews within 60 days.`,
        );
      } else {
        recommendations.push(
          `Automate review velocity & keyword-rich response templates to defend Top 3 Map Pack rankings in ${city}.`,
        );
      }

      if (monthlyAdSpend > 1500) {
        recommendations.push(
          `Reallocate wasted ad clicks from broad match terms into geo-fenced ${city} landing pages with instant quote calculators.`,
        );
      } else {
        recommendations.push(
          `Launch high-intent Local Service Pages targeting core neighborhoods around ${city} to capture zero-ad-spend organic leads.`,
        );
      }

      recommendations.push(
        `Activate 60-second missed-call text-back & 2-way SMS nurturing to convert after-hours inquiries for ${companyName}.`,
      );

      res.json({
        audit: {
          userId: req.authUser!.uid,
          companyName,
          city,
          monthlyCalls,
          avgTicketValue,
          monthlyAdSpend,
          currentReviews,
          projectedExtraRevenue,
          projectedCallsLiftPct,
          visibilityScore: rawVisibility,
          recommendations,
          status: 'submitted',
          adminNotes: '',
        },
      });
    },
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

createApp().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
