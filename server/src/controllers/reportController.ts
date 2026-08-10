import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

const USER_ROLES_EXCLUDED_FROM_AWARDS = ['SUPER_ADMIN', 'ADMIN', 'HR'];

const getRatingTier = (score: number): string => {
  if (score >= 90) return 'GOLD';
  if (score >= 75) return 'SILVER';
  if (score >= 60) return 'BRONZE';
  return 'NEEDS_IMPROVEMENT';
};

export const calculateEmployeeRatingWeighted = async (
  employeeId: string,
  periodType: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' = 'MONTHLY'
): Promise<{
  attendanceScore: number;
  taskScore: number;
  deadlineAccuracy: number;
  leaveBalanceScore: number;
  behaviorBonus: number;
  overallScore: number;
  tier: string;
  achievements: string[];
}> => {
  try {
    const now = new Date();
    let startDate: Date;

    switch (periodType) {
      case 'YEARLY':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'QUARTERLY':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const achievements: string[] = [];

    // 1. Attendance Score (max 35 points)
    const attendances = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: startDate } },
    });

    let attendanceScore = 25;
    if (attendances.length > 0) {
      const workingDays = attendances.length;
      const presentOrWfh = attendances.filter(
        (a) => a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME' || a.status === 'REMOTE'
      ).length;
      const lateOrHalf = attendances.filter(
        (a) => a.status === 'LATE' || a.status === 'HALF_DAY'
      ).length;
      const absent = attendances.filter((a) => a.status === 'ABSENT' || a.status === 'ON_LEAVE').length;

      const presentRatio = workingDays > 0 ? presentOrWfh / workingDays : 0;
      attendanceScore = Math.min(35, presentRatio * 35 - absent * 3 - lateOrHalf * 1.5);
      attendanceScore = Math.max(0, attendanceScore);

      if (presentRatio >= 0.98) achievements.push('Perfect Attendance');
      else if (presentRatio >= 0.95) achievements.push('Excellent Attendance');
    }

    // 2. Task Score (max 40 points)
    const tasks = await prisma.task.findMany({
      where: {
        employeeId,
        OR: [{ createdAt: { gte: startDate } }, { status: 'COMPLETED', updatedAt: { gte: startDate } }],
      },
    });

    let taskScore = 28;
    if (tasks.length > 0) {
      const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
      const total = tasks.length;
      const completionRatio = completed / total;

      let priorityBonus = 0;
      const criticalCompleted = tasks.filter(
        (t) => (t.priority === 'HIGH' || t.priority === 'CRITICAL') && t.status === 'COMPLETED'
      ).length;
      priorityBonus = Math.min(8, criticalCompleted * 1);

      taskScore = Math.min(40, completionRatio * 32 + priorityBonus);
      taskScore = Math.max(0, taskScore);

      if (completionRatio >= 0.95) achievements.push('Task Master');
      if (criticalCompleted >= 5) achievements.push('High Performer');
    }

    // 3. Deadline Accuracy (max 10 points)
    let deadlineAccuracy = 7;
    if (tasks.length > 0) {
      const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');
      if (completedTasks.length > 0) {
        const onTime = completedTasks.filter(
          (t) => !t.updatedAt || new Date(t.updatedAt) <= new Date(t.dueDate)
        ).length;
        const onTimeRatio = onTime / completedTasks.length;
        deadlineAccuracy = Math.min(10, onTimeRatio * 10);
        if (onTimeRatio >= 0.95) achievements.push('Punctual Professional');
      }
    }

    // 4. Leave Balance Score (max 10 points)
    const approvedLeaves = await prisma.leave.findMany({
      where: {
        employeeId,
        status: 'HR_APPROVED',
        startDate: { gte: startDate },
      },
    });

    let leaveBalanceScore = 10;
    let unpaidLeaveDays = 0;
    let totalLeaveDays = 0;

    approvedLeaves.forEach((l) => {
      const days = l.isHalfDay ? 0.5 : Math.ceil(
        (new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 3600 * 24)
      ) + 1;
      totalLeaveDays += days;
      if (l.leaveType === 'LOSS_OF_PAY' || l.leaveType === 'EMERGENCY') {
        unpaidLeaveDays += days;
      }
    });

    leaveBalanceScore = Math.max(0, 10 - unpaidLeaveDays * 1.5 - (totalLeaveDays - unpaidLeaveDays) * 0.2);

    // 5. Behavior / Manual Bonus (max 5 points)
    let behaviorBonus = 2.5;

    const ratingRecords = await prisma.employeeRating.findMany({
      where: { employeeId, createdAt: { gte: startDate } },
    });

    if (ratingRecords.length > 0) {
      const latest = ratingRecords[ratingRecords.length - 1];
      if (latest.managerFeedback != null) {
        behaviorBonus += (latest.managerFeedback / 10) * 2;
      }
      if (latest.peerFeedback != null) {
        behaviorBonus += (latest.peerFeedback / 10) * 1.5;
      }
    }
    behaviorBonus = Math.min(5, behaviorBonus);

    if (achievements.length >= 3) achievements.push('All-Rounder');

    const overallScore = parseFloat(
      (attendanceScore + taskScore + deadlineAccuracy + leaveBalanceScore + behaviorBonus).toFixed(2)
    );

    return {
      attendanceScore: parseFloat(attendanceScore.toFixed(2)),
      taskScore: parseFloat(taskScore.toFixed(2)),
      deadlineAccuracy: parseFloat(deadlineAccuracy.toFixed(2)),
      leaveBalanceScore: parseFloat(leaveBalanceScore.toFixed(2)),
      behaviorBonus: parseFloat(behaviorBonus.toFixed(2)),
      overallScore,
      tier: getRatingTier(overallScore),
      achievements,
    };
  } catch (error) {
    console.error(`Failed to calculate weighted rating for ${employeeId}:`, error);
    return {
      attendanceScore: 25,
      taskScore: 28,
      deadlineAccuracy: 7,
      leaveBalanceScore: 8,
      behaviorBonus: 2.5,
      overallScore: 70.5,
      tier: 'BRONZE',
      achievements: [],
    };
  }
};

export const getHRDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const period = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // 1. Basic counters
    const [totalEmployees, todayAttendance, pendingLeaves, pendingTasks] = await Promise.all([
      prisma.employee.count(),
      prisma.attendance.findMany({ where: { date: today } }),
      prisma.leave.count({ where: { status: { in: ['PENDING', 'MANAGER_APPROVED'] } } }),
      prisma.task.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS', 'REVIEW'] } } }),
    ]);

    const presentCount = todayAttendance.filter((a) => a.status === 'PRESENT').length;
    const lateCount = todayAttendance.filter((a) => a.status === 'LATE').length;
    const wfhCount = todayAttendance.filter((a) => a.status === 'WORK_FROM_HOME').length;
    const remoteCount = todayAttendance.filter((a) => a.status === 'REMOTE').length;
    const halfDayCount = todayAttendance.filter((a) => a.status === 'HALF_DAY').length;
    const onLeaveCount = todayAttendance.filter((a) => a.status === 'ON_LEAVE').length;
    const totalPresent = presentCount + lateCount + wfhCount + remoteCount + halfDayCount;
    const absentCount = Math.max(0, totalEmployees - totalPresent - onLeaveCount);
    const attendancePercentage = totalEmployees > 0 ? parseFloat(((totalPresent / totalEmployees) * 100).toFixed(1)) : 0;

    // Payroll Budget
    const totalPayrollPaid = await prisma.payroll.aggregate({
      where: { month: currentMonth },
      _sum: { netSalary: true },
    });

    // Recent activity logs
    const recentLogs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    // Department Data
    const employees = await prisma.employee.findMany({
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
        profileImageUrl: true,
      },
    });

    const deptMap: Record<string, number> = {};
    employees.forEach((e) => {
      deptMap[e.department] = (deptMap[e.department] || 0) + 1;
    });
    const departmentData = Object.entries(deptMap).map(([name, value]) => ({ name, value }));

    // Task Data
    const tasks = await prisma.task.findMany({ select: { priority: true, status: true } });
    const priorityMap = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    const taskStatusMap = { PENDING: 0, IN_PROGRESS: 0, REVIEW: 0, COMPLETED: 0, REJECTED: 0, OVERDUE: 0 };
    tasks.forEach((t) => {
      if (t.priority in priorityMap) priorityMap[t.priority as keyof typeof priorityMap]++;
      if (t.status in taskStatusMap) taskStatusMap[t.status as keyof typeof taskStatusMap]++;
    });

    // --- Employees with Weighted Ratings and Best Employee ---
    const employeesWithRatings = await Promise.all(
      employees.map(async (emp) => {
        const rating = await calculateEmployeeRatingWeighted(emp.employeeId, 'MONTHLY');
        return {
          ...emp,
          rating: rating.overallScore,
          tier: rating.tier,
          attendanceScore: rating.attendanceScore,
          taskScore: rating.taskScore,
          deadlineAccuracy: rating.deadlineAccuracy,
          leaveBalanceScore: rating.leaveBalanceScore,
          behaviorBonus: rating.behaviorBonus,
          achievements: rating.achievements,
        };
      })
    );

    // Filter out Admin roles for best employee selection
    const roleCheckPromises = employeesWithRatings.map(async (emp) => {
      const user = await prisma.user.findUnique({ where: { employeeId: emp.employeeId } });
      const isExcluded = user && USER_ROLES_EXCLUDED_FROM_AWARDS.includes(user.role);
      return { emp, isExcluded: !!isExcluded };
    });

    const roleResults = await Promise.all(roleCheckPromises);
    const eligibleEmployees = roleResults.filter((r) => !r.isExcluded).map((r) => r.emp);
    eligibleEmployees.sort((a, b) => b.rating - a.rating);

    eligibleEmployees.forEach((emp, idx) => {
      (emp as any).rank = idx + 1;
    });

    const bestEmployee = eligibleEmployees.length > 0 ? eligibleEmployees[0] : null;

    // --- Today's Tasks Summary ---
    const todayTasksAssigned = await prisma.task.findMany({
      where: { createdAt: { gte: today } },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    const todayTasksCompleted = await prisma.task.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: today } },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    const totalTasksAssignedToday = todayTasksAssigned.length;
    const totalTasksCompletedToday = todayTasksCompleted.length;
    const remainingTasksToday = Math.max(0, totalTasksAssignedToday - totalTasksCompletedToday);

    // --- Daily Progress Trends (last 7 days) ---
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTasks = await prisma.task.findMany({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
      });
      const dayCompleted = dayTasks.filter((t) => t.status === 'COMPLETED').length;
      const completionPct = dayTasks.length > 0 ? Math.round((dayCompleted / dayTasks.length) * 100) : 0;

      last7Days.push({
        day: day.toLocaleDateString('en-US', { weekday: 'short' }),
        assigned: dayTasks.length,
        completed: dayCompleted,
        completionPct,
      });
    }

    // Weekly trend comparison
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - 6);
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 13);

    const [thisWeekTasks, lastWeekTasks] = await Promise.all([
      prisma.task.findMany({ where: { createdAt: { gte: thisWeekStart, lte: today } } }),
      prisma.task.findMany({ where: { createdAt: { gte: lastWeekStart, lt: thisWeekStart } } }),
    ]);

    const thisWeekCompletion = thisWeekTasks.length > 0
      ? Math.round((thisWeekTasks.filter((t) => t.status === 'COMPLETED').length / thisWeekTasks.length) * 100)
      : 0;
    const lastWeekCompletion = lastWeekTasks.length > 0
      ? Math.round((lastWeekTasks.filter((t) => t.status === 'COMPLETED').length / lastWeekTasks.length) * 100)
      : 0;
    const weeklyTrend = thisWeekCompletion - lastWeekCompletion;

    // Monthly trend (last 6 months)
    const monthlyTrend = [];
    for (let i = 5; i >= 0; i--) {
      const mDate = new Date(currentYear, currentMonth - 1 - i, 1);
      const mStart = new Date(mDate);
      const mEnd = new Date(currentYear, currentMonth - i, 0, 23, 59, 59, 999);
      const mTasks = await prisma.task.findMany({ where: { createdAt: { gte: mStart, lte: mEnd } } });
      const mCompleted = mTasks.filter((t) => t.status === 'COMPLETED').length;
      monthlyTrend.push({
        month: mDate.toLocaleDateString('en-US', { month: 'short' }),
        completionPct: mTasks.length > 0 ? Math.round((mCompleted / mTasks.length) * 100) : 0,
        total: mTasks.length,
      });
    }

    // --- Employee Productivity Stats ---
    let topPerformerToday = null;
    let mostActiveEmployee = null;
    let fastestTaskCompletion = null;

    if (todayTasksCompleted.length > 0) {
      const compByEmployee: Record<string, number> = {};
      todayTasksCompleted.forEach((t) => {
        compByEmployee[t.employeeId] = (compByEmployee[t.employeeId] || 0) + 1;
      });
      const topEmpId = Object.entries(compByEmployee).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (topEmpId) {
        const e = employees.find((x) => x.employeeId === topEmpId);
        if (e) topPerformerToday = { ...e, completed: compByEmployee[topEmpId] };
      }
    }

    // Most active (most attendance check-ins this week)
    const thisWeekAttendance = await prisma.attendance.findMany({
      where: { date: { gte: thisWeekStart } },
      select: { employeeId: true, status: true },
    });
    const activeCount: Record<string, number> = {};
    thisWeekAttendance.forEach((a) => {
      if (a.status !== 'ABSENT') {
        activeCount[a.employeeId] = (activeCount[a.employeeId] || 0) + 1;
      }
    });
    const mostActiveId = Object.entries(activeCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (mostActiveId) {
      const e = employees.find((x) => x.employeeId === mostActiveId);
      if (e) mostActiveEmployee = { ...e, daysActive: activeCount[mostActiveId] };
    }

    // Fastest task completion (avg time from create to complete)
    const completedTasksWithTimes = await prisma.task.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: thisWeekStart } },
      select: { employeeId: true, createdAt: true, updatedAt: true, title: true },
    });
    if (completedTasksWithTimes.length > 0) {
      const avgByEmp: Record<string, { total: number; count: number }> = {};
      completedTasksWithTimes.forEach((t) => {
        const hours = (new Date(t.updatedAt!).getTime() - new Date(t.createdAt).getTime()) / (1000 * 3600);
        if (!avgByEmp[t.employeeId]) avgByEmp[t.employeeId] = { total: 0, count: 0 };
        avgByEmp[t.employeeId].total += hours;
        avgByEmp[t.employeeId].count += 1;
      });
      const fastest = Object.entries(avgByEmp)
        .map(([id, d]) => ({ id, avg: d.total / d.count }))
        .sort((a, b) => a.avg - b.avg)[0];
      if (fastest) {
        const e = employees.find((x) => x.employeeId === fastest.id);
        if (e) fastestTaskCompletion = { ...e, avgHours: parseFloat(fastest.avg.toFixed(1)) };
      }
    }

    // --- Attendance Trend (Last 30 days) ---
    const attendanceTrend = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dStart = new Date(d);
      dStart.setHours(0, 0, 0, 0);
      const dayAttendance = await prisma.attendance.findMany({
        where: { date: dStart },
        select: { status: true },
      });
      attendanceTrend.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        present: dayAttendance.filter((a) => a.status === 'PRESENT').length,
        late: dayAttendance.filter((a) => a.status === 'LATE').length,
        wfh: dayAttendance.filter((a) => a.status === 'WORK_FROM_HOME' || a.status === 'REMOTE').length,
        absent: dayAttendance.filter((a) => a.status === 'ABSENT').length,
        onLeave: dayAttendance.filter((a) => a.status === 'ON_LEAVE' || a.status === 'HOLIDAY').length,
      });
    }

    // --- Task Completion Trend (Last 12 weeks) ---
    const taskTrend = [];
    for (let i = 11; i >= 0; i--) {
      const wStart = new Date(today);
      wStart.setDate(wStart.getDate() - (i * 7 + 6));
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      const wTasks = await prisma.task.findMany({
        where: { createdAt: { gte: wStart, lte: wEnd } },
        select: { status: true },
      });
      taskTrend.push({
        week: `W${12 - i}`,
        assigned: wTasks.length,
        completed: wTasks.filter((t) => t.status === 'COMPLETED').length,
        inProgress: wTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      });
    }

    // --- Department Performance ---
    const departmentPerformance = await Promise.all(
      Object.keys(deptMap).map(async (dept) => {
        const deptEmps = employees.filter((e) => e.department === dept).map((e) => e.employeeId);
        const deptTasks = await prisma.task.findMany({
          where: { employeeId: { in: deptEmps } },
          select: { status: true, progress: true },
        });
        const completed = deptTasks.filter((t) => t.status === 'COMPLETED').length;
        const avgProgress = deptTasks.length > 0
          ? Math.round(deptTasks.reduce((s, t) => s + t.progress, 0) / deptTasks.length)
          : 0;
        return {
          name: dept,
          headcount: deptEmps.length,
          completionRate: deptTasks.length > 0 ? Math.round((completed / deptTasks.length) * 100) : 0,
          avgProgress,
          totalTasks: deptTasks.length,
        };
      })
    );

    // --- Leave Distribution ---
    const leaveTypeDistribution = await (async () => {
      const types = ['CASUAL', 'SICK', 'EARNED', 'MATERNITY', 'PATERNITY', 'LOSS_OF_PAY', 'MEDICAL', 'EMERGENCY', 'COMP_OFF'];
      const result: { name: string; value: number }[] = [];
      for (const t of types) {
        const count = await prisma.leave.count({ where: { leaveType: t as any, status: { not: 'REJECTED' } } });
        if (count > 0) result.push({ name: t.replace(/_/g, ' '), value: count });
      }
      return result;
    })();

    // --- Monthly Hiring (Last 12 months) ---
    const monthlyHiring = [];
    for (let i = 11; i >= 0; i--) {
      const mStart = new Date(currentYear, currentMonth - 1 - i, 1);
      const mEnd = new Date(currentYear, currentMonth - i, 0, 23, 59, 59, 999);
      const count = await prisma.employee.count({ where: { createdAt: { gte: mStart, lte: mEnd } } });
      monthlyHiring.push({
        month: mStart.toLocaleDateString('en-US', { month: 'short' }),
        hires: count,
      });
    }

    // --- Employee Growth (Cumulative) ---
    const employeeGrowth: { month: string; total: number }[] = [];
    let cumulative = totalEmployees;
    const pastMonths: { month: string; hires: number }[] = [...monthlyHiring].reverse();
    for (let i = 0; i < pastMonths.length; i++) {
      employeeGrowth.unshift({ month: pastMonths[i].month, total: cumulative });
      cumulative -= pastMonths[i].hires;
    }

    // --- Payroll Summary (Last 6 months) ---
    const payrollSummary: { month: string; salary: number; bonus: number; deductions: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const mDate = new Date(currentYear, currentMonth - 1 - i, 1);
      const m = mDate.getMonth() + 1;
      const yr = mDate.getFullYear();
      const mPayrolls = await prisma.payroll.findMany({ where: { month: m, financialYear: yr.toString() } });
      const sum = (arr: Float32Array | any, field: string) =>
        arr.reduce((s: number, p: any) => s + (p[field] || 0), 0);
      payrollSummary.push({
        month: mDate.toLocaleDateString('en-US', { month: 'short' }),
        salary: Math.round(sum(mPayrolls, 'basic') + sum(mPayrolls, 'hra') + sum(mPayrolls, 'da') + sum(mPayrolls, 'allowance')),
        bonus: Math.round(sum(mPayrolls, 'bonus')),
        deductions: Math.round(sum(mPayrolls, 'pf') + sum(mPayrolls, 'esi') + sum(mPayrolls, 'professionalTax') + sum(mPayrolls, 'incomeTax')),
        net: Math.round(sum(mPayrolls, 'netSalary')),
      });
    }

    // --- Finance Overview ---
    const monthPayroll = payrollSummary[payrollSummary.length - 1]?.net || 0;
    // Seed with mock real-world data for demo
    const monthlyRevenue = monthPayroll * 3.2 + 500000;
    const officeExpenses = 150000;
    const monthlyExpenses = monthPayroll + officeExpenses + 75000;
    const profit = monthlyRevenue - monthlyExpenses;
    const pendingSalary = totalPayrollPaid._sum.netSalary ? Math.max(0, monthPayroll - totalPayrollPaid._sum.netSalary) : monthPayroll;
    const netIncome = profit * 0.7;

    const financeOverview = {
      monthlyRevenue: Math.round(monthlyRevenue),
      monthlyExpenses: Math.round(monthlyExpenses),
      profit: Math.round(profit),
      pendingSalary: Math.round(pendingSalary),
      officeExpenses: Math.round(officeExpenses),
      netIncome: Math.round(netIncome),
      revenueVsExpenses: (() => {
        const result = [];
        for (let i = 5; i >= 0; i--) {
          const m = new Date(currentYear, currentMonth - 1 - i, 1);
          const p = payrollSummary[payrollSummary.length - 1 - i]?.net || 0;
          const rev = p * 3.2 + 500000;
          const exp = p + 225000;
          result.push({
            month: m.toLocaleDateString('en-US', { month: 'short' }),
            revenue: Math.round(rev),
            expenses: Math.round(exp),
            profit: Math.round(rev - exp),
          });
        }
        return result;
      })(),
      expenseBreakdown: [
        { name: 'Salaries', value: Math.round(monthPayroll) },
        { name: 'Office Rent', value: 80000 },
        { name: 'Utilities', value: 30000 },
        { name: 'Software', value: 25000 },
        { name: 'Marketing', value: 20000 },
        { name: 'Other', value: 70000 },
      ],
    };

    res.status(200).json({
      status: 'success',
      data: {
        counters: {
          totalEmployees,
          present: totalPresent,
          absent: absentCount,
          late: lateCount,
          wfh: wfhCount,
          remote: remoteCount,
          halfDay: halfDayCount,
          onLeave: onLeaveCount,
          attendancePercentage,
          pendingLeaves,
          pendingTasks,
          payrollBudget: totalPayrollPaid._sum.netSalary || 0,
        },
        todayTasks: {
          totalAssigned: totalTasksAssignedToday,
          totalCompleted: totalTasksCompletedToday,
          remaining: remainingTasksToday,
          assignedList: todayTasksAssigned,
          completedList: todayTasksCompleted,
        },
        dailyProgress: {
          last7Days,
          weeklyTrend,
          monthlyTrend,
        },
        employeeProductivity: {
          topPerformerToday,
          mostActiveEmployee,
          fastestTaskCompletion,
        },
        bestEmployee,
        leaderboard: eligibleEmployees.slice(0, 10),
        charts: {
          departmentData,
          priorityData: Object.entries(priorityMap).map(([name, value]) => ({ name, value })),
          taskStatusData: Object.entries(taskStatusMap).map(([name, value]) => ({ name, value })),
          attendanceTrend,
          taskTrend,
          departmentPerformance,
          leaveTypeDistribution,
          monthlyHiring,
          employeeGrowth,
          payrollSummary,
        },
        financeOverview,
        recentActivity: recentLogs,
        employeesList: employeesWithRatings,
        period,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Today's attendance
    const todayAttendance = await prisma.attendance.findFirst({
      where: { employeeId, date: today },
    });

    // Tasks
    const employeeTasks = await prisma.task.findMany({
      where: { employeeId },
      select: { status: true, priority: true, progress: true, dueDate: true, title: true, createdAt: true, updatedAt: true },
    });

    const taskCounters = {
      pending: employeeTasks.filter((t) => t.status === 'PENDING').length,
      inProgress: employeeTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      review: employeeTasks.filter((t) => t.status === 'REVIEW').length,
      completed: employeeTasks.filter((t) => t.status === 'COMPLETED').length,
      overdue: employeeTasks.filter((t) => t.status === 'OVERDUE').length,
      critical: employeeTasks.filter((t) => t.priority === 'CRITICAL' && t.status !== 'COMPLETED').length,
      high: employeeTasks.filter((t) => t.priority === 'HIGH' && t.status !== 'COMPLETED').length,
      total: employeeTasks.length,
    };

    // Today's tasks
    const todayAssigned = employeeTasks.filter((t) => {
      const c = new Date(t.createdAt);
      return c >= today;
    });
    const todayCompleted = employeeTasks.filter((t) => {
      if (!t.updatedAt) return false;
      const u = new Date(t.updatedAt);
      return t.status === 'COMPLETED' && u >= today;
    });

    // Completion percentage
    const completionPct = employeeTasks.length > 0
      ? Math.round((taskCounters.completed / employeeTasks.length) * 100)
      : 0;

    // Upcoming deadlines (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingDeadlines = employeeTasks
      .filter((t) => t.status !== 'COMPLETED' && new Date(t.dueDate) >= today && new Date(t.dueDate) <= nextWeek)
      .map((t) => ({
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        progress: t.progress,
      }))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);

    // Overdue tasks
    const overdueTasks = employeeTasks
      .filter((t) => t.status !== 'COMPLETED' && new Date(t.dueDate) < today)
      .map((t) => ({ title: t.title, dueDate: t.dueDate, priority: t.priority, progress: t.progress }));

    // Leave balances
    const approvedLeaves = await prisma.leave.findMany({
      where: { employeeId, status: 'HR_APPROVED' },
    });

    const leaveLimits: Record<string, number> = {
      CASUAL: 12,
      SICK: 10,
      EARNED: 15,
      MATERNITY: 26,
      PATERNITY: 15,
      MEDICAL: 7,
      COMP_OFF: 5,
      EMERGENCY: 5,
      HALF_DAY: 6,
      LOSS_OF_PAY: 999,
    };

    const leaveBalances: Record<string, any> = {};
    for (const [type, limit] of Object.entries(leaveLimits)) {
      const approved = approvedLeaves.filter((l) => l.leaveType === type);
      let daysUsed = 0;
      approved.forEach((l) => {
        daysUsed += l.isHalfDay ? 0.5 : (Math.ceil((new Date(l.endDate).getTime() - new Date(l.startDate).getTime()) / (1000 * 3600 * 24)) + 1);
      });
      leaveBalances[type] = {
        limit,
        used: Math.round(daysUsed * 10) / 10,
        available: Math.max(0, Math.round((limit - daysUsed) * 10) / 10),
      };
    }

    // Recent salary slips
    const recentSalaries = await prisma.payroll.findMany({
      where: { employeeId },
      orderBy: [{ financialYear: 'desc' }, { month: 'desc' }],
      take: 5,
    });

    // Recent notifications
    const notifications = await prisma.notification.findMany({
      where: { employeeId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Weighted rating for this employee
    const rating = await calculateEmployeeRatingWeighted(employeeId, 'MONTHLY');

    // Timeline events
    const timelineEvents = await prisma.employeeTimeline.findMany({
      where: { employeeId },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // Task trend (last 6 weeks)
    const taskTrend = [];
    for (let i = 5; i >= 0; i--) {
      const wStart = new Date(today);
      wStart.setDate(wStart.getDate() - (i * 7 + 6));
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);
      const wTasks = employeeTasks.filter((t) => {
        const c = new Date(t.createdAt);
        return c >= wStart && c <= wEnd;
      });
      taskTrend.push({
        week: `W${6 - i}`,
        assigned: wTasks.length,
        completed: wTasks.filter((t) => t.status === 'COMPLETED').length,
      });
    }

    // Daily progress (last 7 days)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      const dayAtt = await prisma.attendance.findFirst({
        where: { employeeId, date: dayStart },
        select: { status: true, lateMinutes: true, overtimeMinutes: true },
      });
      const dayCreated = employeeTasks.filter((t) => {
        const c = new Date(t.createdAt);
        return c >= dayStart && c <= dayEnd;
      }).length;
      const dayCompleted = employeeTasks.filter((t) => {
        if (!t.updatedAt) return false;
        const u = new Date(t.updatedAt);
        return t.status === 'COMPLETED' && u >= dayStart && u <= dayEnd;
      }).length;
      last7Days.push({
        day: day.toLocaleDateString('en-US', { weekday: 'short' }),
        attendance: dayAtt?.status || 'ABSENT',
        assigned: dayCreated,
        completed: dayCompleted,
        lateMinutes: dayAtt?.lateMinutes || 0,
        overtimeMinutes: dayAtt?.overtimeMinutes || 0,
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        todayAttendance,
        tasks: taskCounters,
        todayTasks: {
          assigned: todayAssigned,
          completed: todayCompleted,
          assignedCount: todayAssigned.length,
          completedCount: todayCompleted.length,
          remaining: Math.max(0, todayAssigned.length - todayCompleted.length),
        },
        productivity: {
          completionPct,
          upcomingDeadlines,
          overdueTasks,
        },
        leaveBalances,
        salaries: recentSalaries,
        notifications,
        rating,
        timelineEvents,
        charts: {
          taskTrend,
          last7Days,
        },
        period: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const globalSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      return next(new AppError('Search query is required', 400));
    }

    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { employeeId: { contains: query, mode: 'insensitive' } },
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { department: { contains: query, mode: 'insensitive' } },
          { designation: { contains: query, mode: 'insensitive' } },
          { skills: { hasSome: [query] } },
        ],
      },
      take: 15,
    });

    res.status(200).json({
      status: 'success',
      results: employees.length,
      data: { employees },
    });
  } catch (error) {
    next(error);
  }
};
