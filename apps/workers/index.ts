/**
 * Workers entry point — starts all BullMQ workers
 * Deployed to Railway as a separate service
 * Phase 2 (Week 9): call-processor, dispatcher
 */
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

log.info('Workers starting — Phase 2 workers will be wired here');

// Workers registered here as each phase builds them:
// import './call-processor';
// import './dispatcher';
// import './email-sender';
// import './sms-sender';

process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down workers');
  process.exit(0);
});
