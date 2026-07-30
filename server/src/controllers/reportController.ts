import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';

export const calculateEmployeeRating = async (employeeId: string): Promise<number> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Attendance Metrics (max 2.0 stars)
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: thirtyDaysAgo },
      },
    });

    let attendanceScore = 1.6; // Default score
    if (attendances.length > 0) {
      let points = 0;
      attendances.forEach((a) => {
        if (a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME') {
          points += 1.0;
        } else if (a.status === 'LATE' || a.status === 'HALF_DAY') {
          points += 0.8;
        }
      });
      // Normalize to 20 working days base
      const ratio = points / Math.max(attendances.length, 20);
      attendanceScore = Math.min(2.0, ratio * 2.0);
    }

    // 2. Task Performance Metrics (max 2.0 stars)
    const tasks = await prisma.task.findMany({
      where: { employeeId },
    });

    let taskScore = 1.6; // Default score
    if (tasks.length > 0) {
      const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
      const overdueCount = tasks.filter((t) => t.status === 'OVERDUE' || (t.status !== 'COMPLETED' && t.dueDate < new Date())).length;
      const ratio = completedCount / tasks.length;
      taskScore = ratio * 2.0 - overdueCount * 0.25;
      taskScore = Math.max(0.0, Math.min(2.0, taskScore));
    }

    // 3. Leave Metrics (max 1.0 star)
    const approvedLeaves = await prisma.leave.findMany({
      where: {
        employeeId,
        status: 'HR_APPROVED',
        startDate: { gte: thirtyDaysAgo },
      },
    });

    let leavePoints = 1.0;
    approvedLeaves.forEach((l) => {
      const duration = Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
      if (l.leaveType === 'LOSS_OF_PAY') {
        leavePoints -= duration * 0.25;
      } else {
        leavePoints -= duration * 0.05;
      }
    });
    const leaveScore = Math.max(0.0, leavePoints);

    return parseFloat((attendanceScore + taskScore + leaveScore).toFixed(2));
  } catch (error) {
    console.error(`Failed to calculate rating for ${employeeId}:`, error);
    return 3.5; // fallback default
  }
};

export const getHRDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Total Employees
    const totalEmployees = await prisma.employee.count();

    // 2. Today's Attendance Stats
    const todayAttendance = await prisma.attendance.findMany({
      where: { date: today },
    });

    const presentCount = todayAttendance.filter((a) => a.status === 'PRESENT').length;
    const lateCount = todayAttendance.filter((a) => a.status === 'LATE').length;
    const wfhCount = todayAttendance.filter((a) => a.status === 'WORK_FROM_HOME').length;
    const totalPresent = presentCount + lateCount + wfhCount;
    const absentCount = totalEmployees - totalPresent;

    // 3. Pending leaves
    const pendingLeaves = await prisma.leave.count({
      where: { status: { in: ['PENDING', 'MANAGER_APPROVED'] } },
    });

    // 4. Pending Tasks
    const pendingTasks = await prisma.task.count({
      where: { status: { in: ['PENDING', 'IN_PROGRESS', 'REVIEW'] } },
    });

    // 5. Total Payroll Budget (last generated month)
    const currentMonth = new Date().getMonth() + 1;
    const totalPayrollPaid = await prisma.payroll.aggregate({
      where: { month: currentMonth },
      _sum: { netSalary: true },
    });

    // 6. Recent notifications/activity logs
    const recentLogs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // 7. Department Distribution Chart Data
    const employees = await prisma.employee.findMany({
      select: { department: true, employeeId: true, firstName: true, lastName: true, designation: true, profileImageUrl: true },
    });

    const deptMap: Record<string, number> = {};
    employees.forEach((e) => {
      deptMap[e.department] = (deptMap[e.department] || 0) + 1;
    });
    const departmentData = Object.entries(deptMap).map(([name, value]) => ({
      name,
      value,
    }));

    // 8. Task Priority Distribution
    const tasks = await prisma.task.findMany({
      select: { priority: true, status: true },
    });

    const priorityMap = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    tasks.forEach((t) => {
      if (t.priority in priorityMap) {
        priorityMap[t.priority as keyof typeof priorityMap]++;
      }
    });

    const taskStatusMap = { PENDING: 0, IN_PROGRESS: 0, REVIEW: 0, COMPLETED: 0, REJECTED: 0, OVERDUE: 0 };
    tasks.forEach((t) => {
      if (t.status in taskStatusMap) {
        taskStatusMap[t.status as keyof typeof taskStatusMap]++;
      }
    });

    // --- EXTENDED: Calculate Ratings for Onboarded Staff & Choose Best Employee ---
    const employeesWithRatings = await Promise.all(
      employees.map(async (emp) => {
        const rating = await calculateEmployeeRating(emp.employeeId);
        return {
          employeeId: emp.employeeId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          department: emp.department,
          designation: emp.designation,
          profileImageUrl: emp.profileImageUrl,
          rating,
        };
      })
    );

    let bestEmployee = null;
    let highestRating = -1;
    employeesWithRatings.forEach((emp) => {
      if (emp.rating > highestRating) {
        highestRating = emp.rating;
        bestEmployee = emp;
      }
    });

    // --- EXTENDED: Tasks Assigned Today and Completed Today ---
    const todayTasksAssigned = await prisma.task.findMany({
      where: {
        createdAt: { gte: today },
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    const todayTasksCompleted = await prisma.task.findMany({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: today },
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        counters: {
          totalEmployees,
          present: totalPresent,
          absent: absentCount,
          late: lateCount,
          wfh: wfhCount,
          pendingLeaves,
          pendingTasks,
          payrollBudget: totalPayrollPaid._sum.netSalary || 0,
        },
        charts: {
          departmentData,
          priorityData: Object.entries(priorityMap).map(([name, value]) => ({ name, value })),
          taskStatusData: Object.entries(taskStatusMap).map(([name, value]) => ({ name, value })),
        },
        recentActivity: recentLogs,
        employeesList: employeesWithRatings,
        bestEmployee,
        todayTasksAssigned,
        todayTasksCompleted,
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

    // 1. Today's check-in record
    const todayAttendance = await prisma.attendance.findFirst({
      where: { employeeId, date: today },
    });

    // 2. Tasks counters
    const employeeTasks = await prisma.task.findMany({
      where: { employeeId },
      select: { status: true },
    });

    const taskCounters = {
      pending: employeeTasks.filter((t) => t.status === 'PENDING').length,
      inProgress: employeeTasks.filter((t) => t.status === 'IN_PROGRESS').length,
      review: employeeTasks.filter((t) => t.status === 'REVIEW').length,
      completed: employeeTasks.filter((t) => t.status === 'COMPLETED').length,
      overdue: employeeTasks.filter((t) => t.status === 'OVERDUE').length,
      total: employeeTasks.length,
    };

    // 3. Leave Balances (standard allowed minus used)
    const approvedLeaves = await prisma.leave.findMany({
      where: { employeeId, status: 'HR_APPROVED' },
    });

    const leaveLimits = { CASUAL: 12, SICK: 10, EARNED: 15 };
    const leaveBalances: Record<string, any> = {};

    for (const [type, limit] of Object.entries(leaveLimits)) {
      const approved = approvedLeaves.filter((l) => l.leaveType === type);
      let daysUsed = 0;
      approved.forEach((l) => {
        daysUsed += Math.ceil((l.endDate.getTime() - l.startDate.getTime()) / (1000 * 3600 * 24)) + 1;
      });
      leaveBalances[type] = {
        limit,
        used: daysUsed,
        available: limit - daysUsed,
      };
    }

    // 4. Recent salary slips
    const recentSalaries = await prisma.payroll.findMany({
      where: { employeeId },
      orderBy: [{ financialYear: 'desc' }, { month: 'desc' }],
      take: 5,
    });

    // 5. Recent notifications
    const notifications = await prisma.notification.findMany({
      where: { employeeId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    res.status(200).json({
      status: 'success',
      data: {
        todayAttendance,
        tasks: taskCounters,
        leaveBalances,
        salaries: recentSalaries,
        notifications,
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

    // Search employees by ID, Name, Email, Phone, Dept, Designation, Skills
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
      data: {
        employees,
      },
    });
  } catch (error) {
    next(error);
  }
};
