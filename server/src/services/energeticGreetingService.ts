import { prisma } from '../config/db';
import { socketService } from './socketService';
import { WebPushService } from './webPushService';

export interface EnergeticGreetingPayload {
  slot: 'MORNING' | 'AFTERNOON' | 'EVENING';
  title: string;
  body: string;
  emoji: string;
  vibe: string;
  url: string;
}

// In-memory tracker so each slot is triggered once per day
const sentGreetingsToday = new Set<string>();

/**
 * Returns Indian Standard Time (IST, UTC+5:30) date components
 */
function getISTDateComponents() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istTime = new Date(utc + 3600000 * 5.5);

  const year = istTime.getFullYear();
  const month = String(istTime.getMonth() + 1).padStart(2, '0');
  const day = String(istTime.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  const dayOfWeek = istTime.getDay(); // 0 is Sunday

  return { dateStr, hours, minutes, dayOfWeek, istTime };
}

export function getGreetingPayload(slot: 'MORNING' | 'AFTERNOON' | 'EVENING', firstName?: string): EnergeticGreetingPayload {
  const nameGreeting = firstName ? `, ${firstName}` : ', OneBridge Champion';

  switch (slot) {
    case 'MORNING':
      return {
        slot: 'MORNING',
        title: `☀️ Good Morning${nameGreeting}!`,
        body: `Rise, shine & conquer! Bring unstoppable energy today. Keep your focus sharp, stay motivated, and make today count! Don't forget your morning smart attendance check-in.`,
        emoji: '☀️',
        vibe: 'Morning Inspiration & Unstoppable Momentum',
        url: '/attendance',
      };
    case 'AFTERNOON':
      return {
        slot: 'AFTERNOON',
        title: `⚡ Good Afternoon${nameGreeting}!`,
        body: `Halfway through and crushing it! Take a deep breath, stay hydrated, keep that vibrant momentum surging, and power through your afternoon goals with confidence!`,
        emoji: '⚡',
        vibe: 'Midday Energy Surge & Focus',
        url: '/tasks',
      };
    case 'EVENING':
      return {
        slot: 'EVENING',
        title: `🌟 Good Evening${nameGreeting}!`,
        body: `Incredible hustle and dedication today! Wrap up your tasks, celebrate your wins, confirm your shift check-out, and enjoy a well-deserved, relaxing evening!`,
        emoji: '🌙',
        vibe: 'Evening Victory & Restful Recharge',
        url: '/attendance',
      };
  }
}

/**
 * Dispatches an energetic greeting across push notifications and WebSockets
 */
export async function dispatchEnergeticGreeting(slot: 'MORNING' | 'AFTERNOON' | 'EVENING') {
  try {
    const defaultPayload = getGreetingPayload(slot);
    console.log(`[EnergeticGreeting] Dispatching ${slot} greeting: "${defaultPayload.title}"`);

    // 1. Broadcast via WebSocket to all currently connected web clients
    socketService.broadcast('ENERGETIC_GREETING', {
      ...defaultPayload,
      timestamp: new Date().toISOString(),
    });

    // 2. Query all distinct employees who have active push subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      select: { employeeId: true },
    });

    const uniqueEmpIds = Array.from(new Set(subscriptions.map((s) => s.employeeId)));

    // Fetch employee first names for personalized push notifications
    const employees = await prisma.employee.findMany({
      where: { employeeId: { in: uniqueEmpIds } },
      select: { employeeId: true, firstName: true },
    });

    const empNameMap = new Map(employees.map((e) => [e.employeeId, e.firstName]));

    let totalSent = 0;
    for (const empId of uniqueEmpIds) {
      const fName = empNameMap.get(empId);
      const personalPayload = getGreetingPayload(slot, fName);

      const result = await WebPushService.sendPushToEmployee(empId, {
        title: personalPayload.title,
        body: personalPayload.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        url: personalPayload.url,
        tag: `greeting-${slot.toLowerCase()}`,
        type: 'GENERAL',
        actions: [
          { action: 'open', title: slot === 'EVENING' ? 'Check Out' : 'Open HRMS' },
          { action: 'close', title: 'Dismiss' },
        ],
      });
      totalSent += result.sent;
    }

    console.log(`[EnergeticGreeting] Sent ${slot} greeting to ${totalSent} devices across ${uniqueEmpIds.length} employees.`);
    return { success: true, slot, sentCount: totalSent, employeeCount: uniqueEmpIds.length };
  } catch (error: any) {
    console.error(`[EnergeticGreeting] Error dispatching ${slot} greeting:`, error?.message || error);
    return { success: false, error: error?.message || error };
  }
}

/**
 * Called by the scheduler every minute to check if it's time for Morning, Afternoon, or Evening greetings
 */
export async function checkAndSendScheduledGreetings() {
  const { dateStr, hours, minutes, dayOfWeek } = getISTDateComponents();

  // Skip Sundays for routine corporate greetings
  if (dayOfWeek === 0) return;

  // 1. Early Morning Greeting: 09:00 AM IST (09:00 - 09:05)
  if (hours === 9 && minutes >= 0 && minutes <= 5) {
    const key = `${dateStr}:MORNING`;
    if (!sentGreetingsToday.has(key)) {
      sentGreetingsToday.add(key);
      await dispatchEnergeticGreeting('MORNING');
    }
  }

  // 2. Good Afternoon Greeting: 13:30 (1:30 PM) IST (13:30 - 13:35)
  if (hours === 13 && minutes >= 30 && minutes <= 35) {
    const key = `${dateStr}:AFTERNOON`;
    if (!sentGreetingsToday.has(key)) {
      sentGreetingsToday.add(key);
      await dispatchEnergeticGreeting('AFTERNOON');
    }
  }

  // 3. Good Evening Greeting: 18:30 (6:30 PM) IST (18:30 - 18:35)
  if (hours === 18 && minutes >= 30 && minutes <= 35) {
    const key = `${dateStr}:EVENING`;
    if (!sentGreetingsToday.has(key)) {
      sentGreetingsToday.add(key);
      await dispatchEnergeticGreeting('EVENING');
    }
  }
}
