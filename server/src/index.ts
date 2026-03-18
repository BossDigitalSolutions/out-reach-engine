import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import leadsRoutes from './routes/leads';
import scraperRoutes from './routes/scraper';
import emailsRoutes from './routes/emails';
import templatesRoutes from './routes/templates';
import demosRoutes from './routes/demos';
import analyticsRoutes from './routes/analytics';
import settingsRoutes from './routes/settings';
import revenueRoutes from './routes/revenue';
import whatsAppRoutes from './routes/whatsapp';
import ghlRoutes from './routes/ghl';
import { startScheduler } from './services/scheduler';

dotenv.config();

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/emails', emailsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/demos', demosRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/whatsapp', whatsAppRoutes);
app.use('/api/ghl', ghlRoutes);

// Unsubscribe route (public)
app.get('/unsubscribe/:token', async (req, res) => {
  try {
    const email = await prisma.email.findUnique({
      where: { unsubscribeToken: req.params.token },
      include: { lead: true },
    });
    if (!email) {
      return res.status(404).send('<h1>Invalid unsubscribe link</h1>');
    }
    await prisma.lead.update({
      where: { id: email.leadId },
      data: { unsubscribed: true },
    });
    res.send(
      '<h1>You have been unsubscribed.</h1><p>You will no longer receive emails from us.</p>'
    );
  } catch (err) {
    res.status(500).send('<h1>Something went wrong. Please try again.</h1>');
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function main() {
  await prisma.$connect();
  console.log('Database connected');
  startScheduler();
  app.listen(PORT, () => {
    console.log(`OutreachEngine server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
