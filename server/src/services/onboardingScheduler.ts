import { runScheduledEmployeeCreation } from '../controllers/onboardingController';

let interval: NodeJS.Timeout | null = null;

/**
 * One-Day Delay Automation.
 *
 * When ONBOARDING_CREDENTIAL_DELAY_HOURS > 0, joined candidates have their
 * employee account + credentials + welcome email created automatically after
 * the configured delay has passed since they joined.
 */
export const startOnboardingScheduler = (): void => {
  if (interval) return;

  const delayHours = parseFloat(process.env.ONBOARDING_CREDENTIAL_DELAY_HOURS || '0') || 0;
  if (delayHours <= 0) {
    console.log('Onboarding scheduler disabled (ONBOARDING_CREDENTIAL_DELAY_HOURS = 0). Account creation is immediate on Mark Joined.');
    return;
  }

  // Poll often enough to stay accurate but not hammer the DB.
  const checkMinutes = Math.max(1, Math.min(delayHours * 60, 360));
  interval = setInterval(async () => {
    try {
      const result = await runScheduledEmployeeCreation();
      if (result.processed > 0) {
        console.log(`Onboarding scheduler: created ${result.processed}/${result.pending} employee account(s).`);
      }
    } catch (error) {
      console.error('Onboarding scheduler tick failed:', error);
    }
  }, checkMinutes * 60 * 1000);

  // Run once shortly after boot in case the server restarted after the delay already elapsed.
  setTimeout(() => {
    runScheduledEmployeeCreation()
      .then((r) => {
        if (r.processed > 0) console.log(`Onboarding scheduler: caught up ${r.processed} pending employee account(s).`);
      })
      .catch(() => {});
  }, 5000);

  console.log(`Onboarding scheduler started (delay ${delayHours}h, checks every ${checkMinutes} min).`);
};
