import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { logActivity } from '../middleware/auditLogger';
import { socketService } from '../services/socketService';
import {
  goalCreateSchema,
  goalUpdateSchema,
  goalCheckInSchema,
  goalCommentSchema,
  goalAiAssistSchema,
  goalTemplateSchema,
} from '../models/validators';

const db = prisma as any;

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

const GOAL_TYPES = [
  'COMPANY', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL', 'LEARNING', 'INNOVATION',
  'REVENUE', 'CUSTOMER_SUCCESS', 'QUALITY', 'PROJECT', 'LEADERSHIP', 'STRETCH',
];

const currentQuarterLabel = (): string => {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
};

const uid = (prefix: string = 'id'): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const computeProgress = (keyResults: any[]): number => {
  if (!keyResults || keyResults.length === 0) return 0;
  const sum = keyResults.reduce((acc: number, kr: any) => acc + (Number(kr.progress) || 0), 0);
  return Math.round(sum / keyResults.length);
};

const statusFromProgress = (progress: number): string => {
  if (progress <= 0) return 'NOT_STARTED';
  if (progress >= 100) return 'COMPLETED';
  return 'ON_TRACK';
};

const toKRWithProgress = (krs: any[]): any[] =>
  (krs || []).map((kr: any) => ({
    ...kr,
    id: kr.id || uid('kr'),
    progress: kr.progress !== undefined && kr.progress !== null
      ? Math.max(0, Math.min(100, Math.round(kr.progress)))
      : kr.target > 0
        ? Math.max(0, Math.min(100, Math.round(((kr.current || 0) / kr.target) * 100)))
        : 0,
  }));

const pushActivity = (
  activities: any[],
  actorId: string,
  actorName: string,
  type: string,
  message: string,
  metadata?: any
): any[] => [
  ...(activities || []),
  {
    id: uid('act'),
    actorId,
    actorName,
    type,
    message,
    metadata: metadata || {},
    timestamp: new Date(),
  },
];

const getActorName = async (employeeId?: string | null, fallback: string = 'System'): Promise<string> => {
  if (!employeeId) return fallback;
  try {
    const emp = await prisma.employee.findUnique({
      where: { employeeId },
      select: { firstName: true, lastName: true },
    });
    return emp ? `${emp.firstName} ${emp.lastName}` : fallback;
  } catch {
    return fallback;
  }
};

const isPrivileged = (role?: string): boolean =>
  ['SUPER_ADMIN', 'HR', 'TEAM_LEAD'].includes(role || '');

const notify = async (employeeId: string, title: string, message: string) => {
  try {
    await prisma.notification.create({ data: { employeeId, title, message } });
    socketService.sendNotification(employeeId, 'notification', { title, message });
  } catch (err) {
    console.error('[GOALS] notification failed:', (err as any)?.message || err);
  }
};

const goalInclude = {
  owner: {
    select: {
      firstName: true,
      lastName: true,
      department: true,
      designation: true,
      profileImageUrl: true,
      employeeId: true,
    },
  },
  assignedBy: {
    select: { firstName: true, lastName: true, designation: true },
  },
};

const decorate = (goal: any): any => {
  if (!goal) return goal;
  const keyResults = toKRWithProgress(goal.keyResults || []);
  let progress = goal.progress;
  if (keyResults.length > 0 && goal.status !== 'COMPLETED') {
    progress = computeProgress(keyResults);
  } else if (goal.status === 'COMPLETED') {
    progress = 100;
  }
  return { ...goal, keyResults, progress };
};

const daysBetween = (a: Date, b: Date): number =>
  Math.max(1, Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));

const scopeWhere = async (employeeId: string, role: string): Promise<any> => {
  if (role === 'SUPER_ADMIN') return {};
  if (role === 'HR') {
    return { ownerId: { not: { in: ['OBI0001', 'OBI1117'] } } };
  }
  if (role === 'TEAM_LEAD') {
    const lead = await prisma.employee.findUnique({
      where: { employeeId },
      select: { department: true },
    });
    const dept = lead?.department;
    const or: any[] = [{ ownerId: employeeId }, { assignedById: employeeId }, { isCompanyGoal: true }];
    if (dept) {
      or.push({
        department: dept,
        visibility: { in: ['TEAM', 'DEPARTMENT', 'COMPANY'] },
      });
    }
    return { OR: or };
  }
  return {
    OR: [
      { ownerId: employeeId },
      { assignedById: employeeId },
      { managerId: employeeId },
      { contributors: { has: employeeId } },
      { isCompanyGoal: true },
    ],
  };
};

// ═══════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════

export const createGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!actorId) return next(new AppError('Unauthorized', 401));

    const parsed = goalCreateSchema.parse(req.body);
    const actorName = await getActorName(actorId, String(req.user?.email || 'User'));

    const ownerId = parsed.ownerId || actorId;
    if (!isPrivileged(role) && ownerId !== actorId) {
      return next(new AppError('Only managers, HR or admins can assign goals to others', 403));
    }

    const owner = await prisma.employee.findUnique({ where: { employeeId: ownerId } });
    if (!owner) return next(new AppError(`Owner employee ${ownerId} not found`, 404));

    const keyResults = toKRWithProgress(parsed.keyResults || []);
    const progress = computeProgress(keyResults);
    const approval = parsed.approvalStatus || (role === 'EMPLOYEE' ? 'PENDING_APPROVAL' : 'APPROVED');

    const goal = await prisma.goal.create({
      data: {
        title: parsed.title,
        description: parsed.description || '',
        goalType: parsed.goalType || 'INDIVIDUAL',
        ownerId,
        assignedById: actorId,
        managerId: parsed.managerId || null,
        managerName: parsed.managerName || null,
        department: owner.department,
        priority: parsed.priority || 'MEDIUM',
        weight: parsed.weight ?? 1,
        progress,
        status: (parsed.status || (progress > 0 ? statusFromProgress(progress) : 'NOT_STARTED')) as any,
        startDate: parsed.startDate || new Date(),
        endDate: parsed.endDate || null,
        dueDate: parsed.dueDate || parsed.endDate || null,
        businessObjective: parsed.businessObjective || null,
        businessImpact: parsed.businessImpact || null,
        successMetrics: parsed.successMetrics || [],
        kpiName: parsed.kpiName || null,
        kpiCurrent: parsed.kpiCurrent ?? null,
        kpiTarget: parsed.kpiTarget ?? null,
        kpiUnit: parsed.kpiUnit || null,
        departmentKpi: parsed.departmentKpi || null,
        linkedProject: parsed.linkedProject || null,
        linkedKpiIds: [],
        skills: parsed.skills || [],
        contributors: parsed.contributors || [],
        attachments: parsed.attachments || [],
        keyResults,
        checkIns: [],
        comments: [],
        activities: pushActivity(
          [],
          actorId,
          actorName,
          'CREATED',
          `${actorName} created this goal`,
          { approval }
        ),
        dependencies: parsed.dependencies || [],
        parentGoalId: parsed.parentGoalId || null,
        isCompanyGoal: parsed.isCompanyGoal || false,
        visibility: parsed.visibility || 'TEAM',
        approvalStatus: approval,
        points: 50,
        confidence: null,
      },
      include: goalInclude,
    });

    if (ownerId !== actorId) {
      await notify(
        ownerId,
        'New Goal Assigned',
        `"${parsed.title}" was assigned to you by ${actorName}.`
      );
    }
    if (approval === 'PENDING_APPROVAL' && parsed.managerId && parsed.managerId !== actorId) {
      await notify(
        parsed.managerId,
        'Goal Approval Requested',
        `${actorName} requested approval for goal "${parsed.title}".`
      );
    }

    await logActivity(actorId, 'GOAL_CREATE', `Created goal ${goal.id} | ${parsed.title}`, req);

    res.status(201).json({ status: 'success', data: decorate(goal) });
  } catch (error) {
    next(error);
  }
};

export const getGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const base = await scopeWhere(employeeId, role || 'EMPLOYEE');
    const extra: any = {};

    const { status, type, department, quarter, ownerId, search, priority, risk } = req.query as Record<string, string>;
    if (status && status !== 'ALL') extra.status = status;
    if (type && type !== 'ALL') extra.goalType = type;
    if (department && department !== 'ALL') extra.department = department;
    if (priority && priority !== 'ALL') extra.priority = priority;
    if (ownerId) extra.ownerId = ownerId;
    if (search) {
      extra.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { kpiName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const where = base.OR ? { AND: [base, extra] } : { ...base, ...extra };

    const goals = await prisma.goal.findMany({
      where,
      include: goalInclude,
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    let list = goals.map(decorate);

    if (risk === 'ATTENTION') {
      list = list.filter((g: any) => ['AT_RISK', 'BLOCKED', 'BEHIND'].includes(g.status));
    }

    res.status(200).json({ status: 'success', quarter: currentQuarterLabel(), data: list });
  } catch (error) {
    next(error);
  }
};

export const getMyGoals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const goals = await prisma.goal.findMany({
      where: { ownerId: employeeId },
      include: goalInclude,
      orderBy: [{ dueDate: 'asc' }],
    });

    res.status(200).json({ status: 'success', quarter: currentQuarterLabel(), data: goals.map(decorate) });
  } catch (error) {
    next(error);
  }
};

export const getGoalById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const goal = await prisma.goal.findUnique({ where: { id }, include: goalInclude });
    if (!goal) return next(new AppError('Goal not found', 404));
    res.status(200).json({ status: 'success', data: decorate(goal) });
  } catch (error) {
    next(error);
  }
};

export const updateGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!actorId) return next(new AppError('Unauthorized', 401));

    const parsed = goalUpdateSchema.parse(req.body);
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return next(new AppError('Goal not found', 404));

    const isOwner = goal.ownerId === actorId;
    const isAssigner = goal.assignedById === actorId;
    const privileged = isPrivileged(role);
    const isDeptLead =
      role === 'TEAM_LEAD' &&
      (await prisma.employee.findUnique({ where: { employeeId: actorId }, select: { department: true } }))
        ?.department === goal.department;

    if (!isOwner && !isAssigner && !privileged && !isDeptLead) {
      return next(new AppError('Not authorized to modify this goal', 403));
    }

    const actorName = await getActorName(actorId, String(req.user?.email || 'User'));
    const data: any = {};

    const simpleFields = [
      'title', 'description', 'goalType', 'ownerId', 'managerId', 'managerName',
      'priority', 'weight', 'status', 'startDate', 'endDate', 'dueDate',
      'businessObjective', 'businessImpact', 'successMetrics', 'kpiName', 'kpiCurrent',
      'kpiTarget', 'kpiUnit', 'departmentKpi', 'linkedProject', 'skills',
      'contributors', 'attachments', 'dependencies', 'parentGoalId',
      'isCompanyGoal', 'visibility', 'approvalStatus', 'approvalNote', 'confidence',
    ];
    for (const f of simpleFields) {
      if ((parsed as any)[f] !== undefined) data[f] = (parsed as any)[f];
    }

    if (parsed.keyResults !== undefined) {
      data.keyResults = toKRWithProgress(parsed.keyResults);
      data.progress = computeProgress(data.keyResults);
      if (data.status === undefined && goal.status !== 'COMPLETED') {
        data.status = data.progress >= 100 ? 'COMPLETED' : statusFromProgress(data.progress);
      }
    } else if (parsed.progress !== undefined) {
      data.progress = parsed.progress;
      if (parsed.status === undefined && goal.status !== 'COMPLETED') {
        data.status = parsed.progress >= 100 ? 'COMPLETED' : statusFromProgress(parsed.progress);
      }
    }

    const beforeStatus = goal.status;
    const beforeProgress = goal.progress;

    const updated = await prisma.goal.update({
      where: { id },
      data,
      include: goalInclude,
    });

    let activities = updated.activities || [];
    activities = pushActivity(activities, actorId, actorName, 'UPDATED', `${actorName} updated goal details`);
    if (data.progress !== undefined && data.progress !== beforeProgress) {
      activities = pushActivity(
        activities, actorId, actorName, 'PROGRESS_CHANGED',
        `Progress changed from ${beforeProgress}% to ${data.progress}%`,
        { from: beforeProgress, to: data.progress }
      );
    }
    if (data.status && data.status !== beforeStatus) {
      activities = pushActivity(
        activities, actorId, actorName, data.status === 'COMPLETED' ? 'COMPLETED' : 'UPDATED',
        `Status changed from ${beforeStatus} to ${data.status}`,
        { from: beforeStatus, to: data.status }
      );
    }

    const finalStatus = data.status || beforeStatus;
    const finalProgress = data.progress !== undefined ? data.progress : beforeProgress;

    const finalData: any = { activities };
    if (finalStatus === 'COMPLETED' && beforeStatus !== 'COMPLETED') {
      finalData.points = (updated.points || 50) + 150;
      finalData.progress = 100;
    }

    const saved = await prisma.goal.update({ where: { id }, data: finalData, include: goalInclude });

    if (goal.ownerId !== actorId) {
      await notify(goal.ownerId, 'Goal Updated', `"${updated.title}" was updated by ${actorName}.`);
    }
    if (finalStatus === 'COMPLETED' && beforeStatus !== 'COMPLETED') {
      await notify(goal.ownerId, 'Achievement Unlocked', `You completed "${updated.title}"! +150 points earned.`);
    }

    await logActivity(actorId, 'GOAL_UPDATE', `Updated goal ${id}`, req);
    res.status(200).json({ status: 'success', data: decorate(saved) });
  } catch (error) {
    next(error);
  }
};

export const deleteGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!actorId) return next(new AppError('Unauthorized', 401));

    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return next(new AppError('Goal not found', 404));

    if (goal.ownerId !== actorId && goal.assignedById !== actorId && !isPrivileged(role)) {
      return next(new AppError('Not authorized to delete this goal', 403));
    }

    await prisma.goal.delete({ where: { id } });
    await logActivity(actorId, 'GOAL_DELETE', `Deleted goal ${goal.title}`, req);
    res.status(200).json({ status: 'success', message: 'Goal deleted' });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════
// Check-ins, Comments, Progress & Approvals
// ═══════════════════════════════════════════════════════════

export const addCheckIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!actorId) return next(new AppError('Unauthorized', 401));

    const parsed = goalCheckInSchema.parse(req.body);
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return next(new AppError('Goal not found', 404));

    const isOwner = goal.ownerId === actorId;
    const isAssigner = goal.assignedById === actorId;
    if (!isOwner && !isAssigner && !isPrivileged(role)) {
      return next(new AppError('Not authorized to check in on this goal', 403));
    }

    const actorName = await getActorName(actorId, String(req.user?.email || 'User'));
    const checkIn = {
      id: uid('ci'),
      authorId: actorId,
      authorName: actorName,
      weekLabel: parsed.weekLabel || currentQuarterLabel(),
      progress: Math.max(0, Math.min(100, Math.round(parsed.progress))),
      problems: parsed.problems || null,
      wins: parsed.wins || null,
      nextActions: parsed.nextActions || null,
      attachments: parsed.attachments || [],
      managerComment: parsed.managerComment || null,
      status: parsed.status || null,
      createdAt: new Date(),
    };

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        checkIns: { push: checkIn },
        progress: checkIn.progress,
        ...(parsed.status ? { status: parsed.status } : {}),
        activities: pushActivity(
          goal.activities || [],
          actorId,
          actorName,
          'CHECKIN',
          `${actorName} posted a weekly check-in (${checkIn.progress}%)`,
          { progress: checkIn.progress, wins: checkIn.wins }
        ),
      },
      include: goalInclude,
    });

    if (!isOwner && goal.ownerId !== actorId) {
      await notify(goal.ownerId, 'Weekly Check-in', `${actorName} checked in on "${goal.title}" (${checkIn.progress}%).`);
    }
    if (goal.managerId && goal.managerId !== actorId) {
      await notify(goal.managerId, 'Weekly Check-in', `${actorName} checked in on "${goal.title}" (${checkIn.progress}%).`);
    }

    await logActivity(actorId, 'GOAL_CHECKIN', `Check-in ${checkIn.progress}% on goal ${id}`, req);
    res.status(200).json({ status: 'success', data: { checkIn, goal: decorate(updated) } });
  } catch (error) {
    next(error);
  }
};

export const addGoalComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!actorId) return next(new AppError('Unauthorized', 401));

    const parsed = goalCommentSchema.parse(req.body);
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return next(new AppError('Goal not found', 404));

    const isOwner = goal.ownerId === actorId;
    const isManager = goal.managerId === actorId || isPrivileged(role);
    if (!isOwner && !isManager && goal.assignedById !== actorId) {
      return next(new AppError('Not authorized to comment on this goal', 403));
    }

    const actorName = await getActorName(actorId, String(req.user?.email || 'User'));
    const comment = {
      id: uid('cm'),
      authorId: actorId,
      authorName: actorName,
      content: parsed.content,
      isManager: parsed.isManager || isManager,
      attachments: parsed.attachments || [],
      timestamp: new Date(),
    };

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        comments: { push: comment },
        activities: pushActivity(
          goal.activities || [],
          actorId,
          actorName,
          'COMMENT',
          `${actorName} commented: "${parsed.content.slice(0, 80)}${parsed.content.length > 80 ? '...' : ''}"`
        ),
      },
      include: goalInclude,
    });

    const target = isManager ? goal.ownerId : goal.managerId || goal.assignedById;
    if (target && target !== actorId) {
      await notify(target, 'New Goal Comment', `${actorName} commented on "${goal.title}".`);
    }

    await logActivity(actorId, 'GOAL_COMMENT', `Commented on goal ${id}`, req);
    res.status(200).json({ status: 'success', data: { comment, comments: updated.comments, goal: decorate(updated) } });
  } catch (error) {
    next(error);
  }
};

export const updateGoalProgress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!actorId) return next(new AppError('Unauthorized', 401));

    const { progress, status, note } = req.body as { progress?: number; status?: string; note?: string };
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return next(new AppError('Goal not found', 404));

    const isOwner = goal.ownerId === actorId;
    if (!isOwner && !isPrivileged(role) && goal.assignedById !== actorId) {
      return next(new AppError('Not authorized to update progress', 403));
    }

    const newProgress = progress !== undefined ? Math.max(0, Math.min(100, Math.round(progress))) : goal.progress;
    const newStatus = status || (newProgress >= 100 ? 'COMPLETED' : statusFromProgress(newProgress));

    const actorName = await getActorName(actorId, String(req.user?.email || 'User'));
    let activities = goal.activities || [];
    if (newProgress !== goal.progress) {
      activities = pushActivity(
        activities, actorId, actorName, 'PROGRESS_CHANGED',
        `Progress updated to ${newProgress}% ${note ? `— ${note}` : ''}`,
        { from: goal.progress, to: newProgress, note: note || null }
      );
    }
    if (newStatus !== goal.status) {
      activities = pushActivity(
        activities, actorId, actorName, newStatus === 'COMPLETED' ? 'COMPLETED' : 'UPDATED',
        `Status changed to ${newStatus}`,
        { from: goal.status, to: newStatus }
      );
    }

    const completedNow = newStatus === 'COMPLETED' && goal.status !== 'COMPLETED';
    const data: any = { progress: newProgress, status: newStatus, activities };
    if (completedNow) data.points = (goal.points || 50) + 150;

    const updated = await prisma.goal.update({ where: { id }, data, include: goalInclude });

    if (completedNow) {
      await notify(goal.ownerId, 'Goal Completed 🎉', `"${updated.title}" is complete. +150 points, achievement unlocked!`);
    } else if (goal.ownerId !== actorId) {
      await notify(goal.ownerId, 'Goal Progress Updated', `"${updated.title}" is now at ${newProgress}% (${newStatus}).`);
    }
    if (goal.managerId && goal.managerId !== actorId && goal.managerId !== goal.ownerId) {
      await notify(goal.managerId, 'Goal Progress Updated', `"${updated.title}" is now at ${newProgress}% (${newStatus}).`);
    }

    await logActivity(actorId, 'GOAL_PROGRESS', `Progress ${newProgress}% on goal ${id}`, req);
    res.status(200).json({ status: 'success', data: decorate(updated) });
  } catch (error) {
    next(error);
  }
};

export const reviewGoal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!actorId) return next(new AppError('Unauthorized', 401));

    const { decision, note } = req.body as { decision: 'APPROVED' | 'REJECTED'; note?: string };
    const goal = await prisma.goal.findUnique({ where: { id } });
    if (!goal) return next(new AppError('Goal not found', 404));

    const isManager = goal.managerId === actorId;
    if (!isManager && !isPrivileged(role)) {
      return next(new AppError('Only assigned managers or HR can review goals', 403));
    }

    const actorName = await getActorName(actorId, String(req.user?.email || 'User'));
    const updated = await prisma.goal.update({
      where: { id },
      data: {
        approvalStatus: decision,
        approvalNote: note || null,
        activities: pushActivity(
          goal.activities || [],
          actorId,
          actorName,
          decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
          `${actorName} ${decision.toLowerCase()} this goal${note ? ` — ${note}` : ''}`,
          { decision, note: note || null }
        ),
      },
      include: goalInclude,
    });

    await notify(
      goal.ownerId,
      decision === 'APPROVED' ? 'Goal Approved ✅' : 'Goal Rejected',
      `Your goal "${goal.title}" was ${decision.toLowerCase()} by ${actorName}.`
    );

    await logActivity(actorId, 'GOAL_REVIEW', `${decision} goal ${id}`, req);
    res.status(200).json({ status: 'success', data: decorate(updated) });
  } catch (error) {
    next(error);
  }
};

export const getGoalTimeline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const where = await scopeWhere(employeeId, role || 'EMPLOYEE');
    const goals = await prisma.goal.findMany({ where, select: { id: true, title: true, activities: true } });

    const events = goals
      .flatMap((g: any) =>
        (g.activities || []).map((a: any) => ({ ...a, goalId: g.id, goalTitle: g.title }))
      )
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 120);

    res.status(200).json({ status: 'success', data: events });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════
// Dashboard, Analytics, Manager Review, Career
// ═══════════════════════════════════════════════════════════

export const getGoalsDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const where = await scopeWhere(employeeId, role || 'EMPLOYEE');
    const myWhere = { ownerId: employeeId };

    const [goals, myGoals] = await Promise.all([
      prisma.goal.findMany({ where }),
      prisma.goal.findMany({ where: myWhere }),
    ]);

    const active = myGoals.filter((g: any) => !['COMPLETED', 'CANCELLED'].includes(g.status));
    const completed = myGoals.filter((g: any) => g.status === 'COMPLETED');
    const attention = myGoals.filter((g: any) => ['AT_RISK', 'BLOCKED'].includes(g.status));

    const weightedProgress = (arr: any[]) => {
      const totalWeight = arr.reduce((s, g) => s + (g.weight || 1), 0) || 1;
      return Math.round(
        arr.reduce((s, g) => {
          const p = g.status === 'COMPLETED' ? 100 : computeProgress(g.keyResults || []);
          return s + (p * (g.weight || 1));
        }, 0) / totalWeight
      );
    };

    const overallProgress = weightedProgress(myGoals);
    const avgCompletion = (score: number): 'HIGH' | 'MEDIUM' | 'LOW' =>
      score >= 75 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';

    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dueThisMonth = active.filter(
      (g: any) => g.dueDate && new Date(g.dueDate) >= now && new Date(g.dueDate) <= monthEnd
    ).length;

    const overdue = active.filter((g: any) => g.dueDate && new Date(g.dueDate) < now).length;
    const blockedCount = attention.length;

    const performanceRating = Math.min(5, Math.round((overallProgress / 20) + (completed.length ? 1 : 0) * 2) || 1);
    const promotionReadiness =
      overallProgress >= 80 ? 'High' : overallProgress >= 55 ? 'Medium' : 'Low';
    const managerFeedback = blockedCount === 0 && overallProgress >= 60 ? 'Positive' : 'Needs Attention';

    const byType = GOAL_TYPES.map((t) => ({
      type: t,
      count: myGoals.filter((g) => g.goalType === t).length,
    })).filter((t) => t.count > 0);

    const statusBreakdown = myGoals.reduce((acc: any, g) => {
      acc[g.status] = (acc[g.status] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      status: 'success',
      quarter: currentQuarterLabel(),
      data: {
        overallProgress,
        totalGoals: myGoals.length,
        activeGoals: active.length,
        completedGoals: completed.length,
        attentionGoals: attention.length,
        overdue,
        dueThisMonth,
        byType,
        byDepartment: myGoals.reduce((acc: any, g) => {
          acc[g.department] = (acc[g.department] || 0) + 1;
          return acc;
        }, {}),
        statusBreakdown,
        teamCount: goals.length,
        performanceRating,
        promotionReadiness,
        managerFeedback,
        avgProgress: weightedProgress(active),
        completionTier: avgCompletion(overallProgress),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getGoalsAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const where = await scopeWhere(employeeId, role || 'EMPLOYEE');
    const goals = await prisma.goal.findMany({ where });

    // Completion trend by quarter
    const byQuarter: Record<string, { total: number; completed: number; avgProgress: number }> = {};
    for (const g of goals) {
      const d = new Date(g.createdAt);
      const q = `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`;
      if (!byQuarter[q]) byQuarter[q] = { total: 0, completed: 0, avgProgress: 0 };
      byQuarter[q].total += 1;
      if (g.status === 'COMPLETED') byQuarter[q].completed += 1;
    }
    const completionTrend = Object.entries(byQuarter)
      .map(([quarter, v]) => ({
        quarter,
        total: v.total,
        completed: v.completed,
        rate: v.total ? Math.round((v.completed / v.total) * 100) : 0,
        avgProgress: 0,
      }))
      .slice(-8);

    for (const row of completionTrend) {
      const qGoals = goals.filter((g) => {
        const d = new Date(g.createdAt);
        const q = `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`;
        return q === row.quarter;
      });
      row.avgProgress = qGoals.length
        ? Math.round(qGoals.reduce((s, g) => s + (g.status === 'COMPLETED' ? 100 : computeProgress(g.keyResults || [])), 0) / qGoals.length)
        : 0;
    }

    // Department comparison
    const deptMap: Record<string, { total: number; completed: number; avgProgress: number }> = {};
    for (const g of goals) {
      if (!deptMap[g.department]) deptMap[g.department] = { total: 0, completed: 0, avgProgress: 0 };
      deptMap[g.department].total += 1;
      if (g.status === 'COMPLETED') deptMap[g.department].completed += 1;
    }
    const departmentComparison = Object.entries(deptMap).map(([department, v]) => ({
      department,
      total: v.total,
      completed: v.completed,
      avgProgress: v.total
        ? Math.round(
            goals
              .filter((g) => g.department === department)
              .reduce((s, g) => s + (g.status === 'COMPLETED' ? 100 : computeProgress(g.keyResults || [])), 0) / v.total
          )
        : 0,
    }));

    // Top performers (by completion & progress)
    const ownerMap: Record<string, any> = {};
    for (const g of goals) {
      if (!ownerMap[g.ownerId]) {
        ownerMap[g.ownerId] = { ownerId: g.ownerId, ownerName: '', total: 0, completed: 0, avgProgress: 0, points: g.points || 0 };
      }
      ownerMap[g.ownerId].total += 1;
      ownerMap[g.ownerId].points += g.points || 0;
      if (g.status === 'COMPLETED') ownerMap[g.ownerId].completed += 1;
    }
    const owners = await prisma.employee.findMany({
      where: { employeeId: { in: Object.keys(ownerMap) } },
      select: { employeeId: true, firstName: true, lastName: true, profileImageUrl: true, designation: true },
    });
    const ownerNameById: Record<string, string> = {};
    for (const o of owners) ownerNameById[o.employeeId] = `${o.firstName} ${o.lastName}`;
    const topPerformers = Object.entries(ownerMap)
      .map(([ownerId, v]) => {
        const ownerGoals = goals.filter((g) => g.ownerId === ownerId);
        const avg = ownerGoals.length
          ? Math.round(ownerGoals.reduce((s, g) => s + (g.status === 'COMPLETED' ? 100 : computeProgress(g.keyResults || [])), 0) / ownerGoals.length)
          : 0;
        return {
          ...v,
          ownerName: ownerNameById[ownerId] || ownerId,
          avgProgress: avg,
          score: avg + v.completed * 8,
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 8);

    const risks = goals.filter((g: any) => ['AT_RISK', 'BLOCKED'].includes(g.status));
    const aging = [
      { label: '< 30 days', count: goals.filter((g) => !g.dueDate || daysBetween(new Date(g.createdAt), new Date()) < 30).length },
      { label: '30-60 days', count: goals.filter((g) => g.dueDate && daysBetween(new Date(g.createdAt), new Date()) < 60 && daysBetween(new Date(g.createdAt), new Date()) >= 30).length },
      { label: '60+ days', count: goals.filter((g) => g.dueDate && daysBetween(new Date(g.createdAt), new Date()) >= 60).length },
    ];

    // Progress heatmap (last 12 weeks)
    const heatmap: { week: string; progress: number; count: number }[] = [];
    for (let w = 11; w >= 0; w--) {
      const d = new Date();
      d.setDate(d.getDate() - w * 7);
      const weekKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekGoals = goals.filter((g) => new Date(g.createdAt) <= d);
      heatmap.push({
        week: weekKey,
        count: weekGoals.length,
        progress: weekGoals.length
          ? Math.round(weekGoals.reduce((s, g) => s + (g.status === 'COMPLETED' ? 100 : computeProgress(g.keyResults || [])), 0) / weekGoals.length)
          : 0,
      });
    }

    const completionByManager: Record<string, { total: number; completed: number }> = {};
    for (const g of goals) {
      const key = g.managerName || 'Unassigned';
      if (!completionByManager[key]) completionByManager[key] = { total: 0, completed: 0 };
      completionByManager[key].total += 1;
      if (g.status === 'COMPLETED') completionByManager[key].completed += 1;
    }

    res.status(200).json({
      status: 'success',
      data: {
        completionTrend,
        departmentComparison,
        topPerformers,
        riskGoals: risks,
        aging,
        heatmap,
        completionByManager: Object.entries(completionByManager).map(([manager, v]) => ({ manager, ...v })),
        completionByType: GOAL_TYPES.map((t) => ({
          type: t,
          count: goals.filter((g) => g.goalType === t && g.status === 'COMPLETED').length,
        })).filter((x) => x.count > 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getManagerReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    if (!isPrivileged(role)) {
      return next(new AppError('Manager dashboard is only available to managers, HR and admins', 403));
    }

    let where: any = { isCompanyGoal: false };
    if (role === 'TEAM_LEAD') {
      const lead = await prisma.employee.findUnique({ where: { employeeId }, select: { department: true } });
      where = { ...where, department: lead?.department };
    }
    if (role === 'HR') {
      where = { ...where, ownerId: { not: { in: ['OBI0001', 'OBI1117'] } } };
    }

    const goals = await prisma.goal.findMany({ where, include: goalInclude });

    const perEmployee: Record<string, any> = {};
    for (const g of goals) {
      if (!perEmployee[g.ownerId]) {
        perEmployee[g.ownerId] = {
          ownerId: g.ownerId,
          ownerName: g.owner ? `${g.owner.firstName} ${g.owner.lastName}` : g.ownerId,
          profileImageUrl: g.owner?.profileImageUrl || null,
          designation: g.owner?.designation || '',
          department: g.department,
          total: 0,
          completed: 0,
          blocked: 0,
          atRisk: 0,
          behind: 0,
          pendingApproval: 0,
          needsSupport: 0,
          avgProgress: 0,
          dueSoon: 0,
        };
      }
      const e = perEmployee[g.ownerId];
      e.total += 1;
      if (g.status === 'COMPLETED') e.completed += 1;
      if (g.status === 'BLOCKED') e.blocked += 1;
      if (g.status === 'AT_RISK') e.atRisk += 1;
      if (g.status === 'BEHIND') e.behind += 1;
      if (g.approvalStatus === 'PENDING_APPROVAL') e.pendingApproval += 1;
      if (['AT_RISK', 'BLOCKED'].includes(g.status)) e.needsSupport += 1;
      if (g.dueDate && new Date(g.dueDate) > new Date() &&
          daysBetween(new Date(), new Date(g.dueDate)) <= 14 &&
          !['COMPLETED', 'CANCELLED'].includes(g.status)) e.dueSoon += 1;
    }

    const employees = await prisma.employee.findMany({
      where: { employeeId: { in: Object.keys(perEmployee) } },
      select: { employeeId: true, firstName: true, lastName: true, profileImageUrl: true, designation: true, department: true },
    });
    const empById: Record<string, any> = {};
    for (const e of employees) empById[e.employeeId] = e;

    const roster = Object.values(perEmployee).map((e: any) => {
      const emp = empById[e.ownerId] || {};
      e.avgProgress = e.total
        ? Math.round(
            goals.filter((g) => g.ownerId === e.ownerId)
              .reduce((s, g) => s + (g.status === 'COMPLETED' ? 100 : computeProgress(g.keyResults || [])), 0) / e.total
          )
        : 0;
      return { ...e, firstName: emp.firstName || '', lastName: emp.lastName || '' };
    });

    const approvalQueue = goals
      .filter((g) => g.approvalStatus === 'PENDING_APPROVAL')
      .map((g) => decorate(g));

    // Weekly summary text
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekActivities = goals
      .flatMap((g: any) => (g.activities || []).map((a: any) => ({ ...a, goalTitle: g.title })))
      .filter((a: any) => new Date(a.timestamp) >= weekAgo);

    const summary = {
      totalEmployees: roster.length,
      totalGoals: goals.length,
      completedThisWeek: goals.filter((g) => g.updatedAt && new Date(g.updatedAt) >= weekAgo && g.status === 'COMPLETED').length,
      blockedGoals: goals.filter((g) => g.status === 'BLOCKED').length,
      atRiskGoals: goals.filter((g) => g.status === 'AT_RISK').length,
      supportNeeded: goals.filter((g) => ['AT_RISK', 'BLOCKED'].includes(g.status)).length,
      pendingApprovals: approvalQueue.length,
      activityEvents: weekActivities.length,
    };

    res.status(200).json({
      status: 'success',
      data: {
        employees: roster,
        approvalQueue,
        summary,
        upComing: goals
          .filter((g: any) => g.dueDate && new Date(g.dueDate) > new Date() && daysBetween(new Date(), new Date(g.dueDate)) <= 7 && !['COMPLETED', 'CANCELLED'].includes(g.status))
          .map(decorate)
          .slice(0, 8),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCareerInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const { employeeId: targetId } = req.query as { employeeId?: string };
    const ownerId = targetId || employeeId;
    if (!ownerId) return next(new AppError('Unauthorized', 401));

    const goals = await prisma.goal.findMany({ where: { ownerId }, include: goalInclude });
    const active = goals.filter((g: any) => !['COMPLETED', 'CANCELLED'].includes(g.status));
    const completed = goals.filter((g: any) => g.status === 'COMPLETED');

    const avgProgress = active.length
      ? Math.round(active.reduce((s, g) => s + computeProgress(g.keyResults || []), 0) / active.length)
      : 0;
    const completionRate = goals.length ? Math.round((completed.length / goals.length) * 100) : 0;

    const skillsSet = new Set<string>();
    for (const g of goals) for (const s of g.skills || []) skillsSet.add(s);
    const skills = Array.from(skillsSet).slice(0, 12);

    // Promotion readiness score (0-100)
    const leadershipGoals = goals.filter((g) => g.goalType === 'LEADERSHIP').length;
    const learningGoals = goals.filter((g) => g.goalType === 'LEARNING').length;
    const atRisk = active.filter((g) => ['AT_RISK', 'BLOCKED'].includes(g.status)).length;
    const onTrack = active.length > 0 ? Math.round((active.filter((g) => g.status === 'ON_TRACK').length / active.length) * 100) : 0;

    const promotionScore = Math.max(0, Math.min(100,
      Math.round(
        avgProgress * 0.4 +
        completionRate * 0.3 +
        Math.min(100, leadershipGoals * 15) * 0.2 +
        Math.max(0, 100 - atRisk * 20) * 0.1
      )
    ));

    const expectedRating = Math.min(5, Math.max(1, Math.round(((promotionScore / 100) * 4.6 + 0.6) * 10) / 10));
    const suggestedHike = Math.min(25, Math.max(0, Math.round(((promotionScore - 50) / 50) * 18)));
    const bonusEligible = promotionScore >= 60;
    const promotionRecommended = promotionScore >= 70;
    const skillsMatched = Math.min(100, Math.round(60 + (completed.length * 8) + (learningGoals * 4)));
    const managerConfidence = Math.min(100, Math.round(promotionScore * 0.7 + onTrack * 0.3));

    const futureRoles =
      promotionScore >= 80
        ? ['Technical Lead', 'Senior Team Lead', 'Project Manager']
        : promotionScore >= 60
          ? ['Senior Software Engineer', 'Team Lead']
          : ['Stable in current role', 'Focus area: skill development'];

    const recentLearning = goals.filter((g) => g.goalType === 'LEARNING').slice(0, 5).map((g) => ({
      title: g.title,
      status: g.status,
      progress: computeProgress(g.keyResults || []),
    }));

    res.status(200).json({
      status: 'success',
      data: {
        promotionScore,
        promotionReady: promotionScore >= 70 ? 'Ready for Promotion' : promotionScore >= 55 ? 'Growing' : 'Developing',
        readinessLevel: promotionScore >= 70 ? 'High' : promotionScore >= 55 ? 'Medium' : 'Low',
        managerConfidence,
        skillsMatched,
        leadershipStrength: leadershipGoals >= 2 ? 'Strong' : leadershipGoals >= 1 ? 'Developing' : 'Core',
        goalCompletion: Math.round((avgProgress + completionRate) / 2),
        expectedRating,
        suggestedHike,
        bonusEligible,
        promotionRecommended,
        futureRoles,
        skills,
        recentLearning,
        careerScore: Math.round(promotionScore * 0.6 + (learningGoals ? 15 : 0) + (leadershipGoals ? 10 : 0)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════
// Templates (Admin Panel)
// ═══════════════════════════════════════════════════════════

export const getGoalTemplates = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.goalTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ status: 'success', data: templates });
  } catch (error) {
    next(error);
  }
};

export const createGoalTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isPrivileged(req.user?.role)) {
      return next(new AppError('Only managers, HR and admins can create templates', 403));
    }
    const parsed = goalTemplateSchema.parse(req.body);
    const template = await prisma.goalTemplate.create({
      data: {
        name: parsed.name,
        goalType: parsed.goalType,
        description: parsed.description || '',
        keyResults: parsed.keyResults || [],
        successMetrics: parsed.successMetrics || [],
        skills: parsed.skills || [],
        aiConfig: parsed.aiConfig || {},
        isActive: true,
        usageCount: 0,
      },
    });
    res.status(201).json({ status: 'success', data: template });
  } catch (error) {
    next(error);
  }
};

export const deleteGoalTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isPrivileged(req.user?.role)) {
      return next(new AppError('Only managers, HR and admins can delete templates', 403));
    }
    const { id } = req.params;
    await prisma.goalTemplate.delete({ where: { id } });
    res.status(200).json({ status: 'success', message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════
// AI Goal Assistant (deterministic, explainable suggestions)
// ═══════════════════════════════════════════════════════════

const KPI_SUGGESTIONS: Record<string, { name: string; unit: string; description: string }[]> = {
  REVENUE: [
    { name: 'Monthly Recurring Revenue', unit: '$', description: 'Track MRR growth' },
    { name: 'Deals Closed', unit: 'count', description: 'Number of signed deals per quarter' },
    { name: 'Average Deal Size', unit: '$', description: 'Weighted pipeline value' },
    { name: 'Win Rate', unit: '%', description: 'Proposals converted to deals' },
  ],
  CUSTOMER_SUCCESS: [
    { name: 'Net Promoter Score', unit: 'pts', description: 'Customer satisfaction score' },
    { name: 'Support Response Time', unit: 'h', description: 'Average first response' },
    { name: 'Customer Retention', unit: '%', description: 'Retained customers' },
    { name: 'CSAT Score', unit: 'pts', description: 'Customer satisfaction rating' },
  ],
  QUALITY: [
    { name: 'Defect Rate', unit: '%', description: 'Percent of releases reworked' },
    { name: 'Code Review Coverage', unit: '%', description: 'PRs reviewed' },
    { name: 'Test Coverage', unit: '%', description: 'Automated test coverage' },
  ],
  LEARNING: [
    { name: 'Certifications Completed', unit: 'count', description: 'Credentials earned' },
    { name: 'Courses Completed', unit: 'count', description: 'Learning paths finished' },
    { name: 'Skill Assessments', unit: 'pts', description: 'Assessment scores' },
  ],
  LEADERSHIP: [
    { name: 'Mentorship Sessions', unit: 'count', description: '1-on-1 sessions held' },
    { name: 'Team Enablement', unit: 'count', description: 'Workshops delivered' },
    { name: '360 Feedback Score', unit: 'pts', description: 'Peer leadership rating' },
  ],
  INNOVATION: [
    { name: 'Ideas Shipped', unit: 'count', description: 'Experiments shipped to production' },
    { name: 'Automation Time Saved', unit: 'h', description: 'Hours saved via automation' },
    { name: 'Process Improvements', unit: 'count', description: 'Optimizations adopted' },
  ],
};

const aiDraftFromText = (text: string, goalType: string): any => {
  const t = text.trim();
  const lines = t.split(/[\n•,;]+/).map((s) => s.trim()).filter(Boolean);
  const title = lines[0]?.slice(0, 90) || 'New Goal';
  const rest = lines.slice(1);

  let krs: any[] = [];
  if (goalType === 'LEARNING') {
    krs = [
      { title: 'Complete core learning path', current: 0, target: 1, unit: 'course' },
      { title: 'Pass skill assessment', current: 0, target: 90, unit: '%' },
    ];
  } else if (goalType === 'REVENUE') {
    krs = [
      { title: 'Generate pipeline', current: 0, target: 100000, unit: '₹' },
      { title: 'Close deals', current: 0, target: 3, unit: 'deals' },
    ];
  } else {
    krs = [
      { title: `Deliver: ${rest?.[0] || title}`, current: 0, target: 1, unit: 'deliverable' },
      { title: 'Track measurable outcome', current: 0, target: 100, unit: '%' },
    ];
  }

  const skills: string[] = [];
  if (goalType === 'REVENUE') skills.push('Negotiation', 'Sales', 'CRM');
  if (goalType === 'LEARNING') skills.push('Learning Agility');
  if (goalType === 'LEADERSHIP') skills.push('Leadership', 'Communication', 'Mentorship');
  if (goalType === 'INNOVATION') skills.push('Problem Solving', 'Creativity', 'AI');

  return {
    title,
    description: rest.slice(0, 2).join('. ') || t,
    keyResults: krs,
    skills: skills.length ? skills : ['Problem Solving'],
    objective: `Advance ${goalType.toLowerCase()} outcomes for OneBridge Infotech`,
    riskFlags: [],
    confidence: 84,
  };
};

const aiConvertTask = (taskText: string) => {
  const t = taskText.trim();
  const goal = aiDraftFromText(t, 'PROJECT');
  goal.type = 'PROJECT';
  goal.keyResults = [
    { title: t.slice(0, 70), current: 0, target: 1, unit: 'deliverable' },
    { title: 'Milestone review passed', current: 0, target: 1, unit: 'milestone' },
  ];
  goal.suggestedMilestones = [
    'Week 1: Planning & scope finalisation',
    'Week 2-3: Core implementation',
    'Week 4: Review, QA & delivery',
  ];
  goal.wordingTip = 'Consider using measurable outcomes instead of activities to maximise OKR impact.';
  return goal;
};

const aiSuggestKpis = (goalType: string) => KPI_SUGGESTIONS[goalType] || KPI_SUGGESTIONS.REVENUE;

const aiPredictCompletion = (goal: any) => {
  const progress = goal?.progress || 0;
  const start = goal?.startDate ? new Date(goal.startDate) : new Date(goal?.createdAt || Date.now());
  const due = goal?.dueDate ? new Date(goal.dueDate) : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const totalDays = daysBetween(start, due);
  const elapsed = daysBetween(start, now);
  const expectedProgress = Math.min(100, Math.round((elapsed / totalDays) * 100));

  let confidence: number;
  let status: string;
  let suggestion = '';
  if (progress >= 100) {
    confidence = 95;
    status = 'On track to complete';
  } else if (progress >= expectedProgress) {
    confidence = Math.min(92, 55 + (progress - expectedProgress) * 0.9);
    status = 'On pace for target';
  } else {
    const gap = expectedProgress - progress;
    confidence = Math.max(5, 55 - gap * 2.2);
    status = gap > 25 ? 'At risk of missing deadline' : 'Slightly behind schedule';
    suggestion = gap > 25 ? 'Break this into weekly milestones and request support early.' : 'Keep momentum with weekly check-ins.';
  }

  const remainingProgress = 100 - progress;
  const daysLeft = daysBetween(now, due);
  const paceNeeded = daysLeft > 0 ? Math.ceil(remainingProgress / daysLeft) : 100;

  return {
    confidence: Math.round(confidence),
    status,
    paceNeededPerDay: paceNeeded,
    projectedCompletion: confidence >= 60 ? 'On track for planned due date' : 'Likely delayed unless unblocked',
    daysLeft,
    suggestion,
  };
};

const aiDetectUnrealistic = (goal: any) => {
  const flags: string[] = [];
  const krs: any[] = goal?.keyResults || [];
  const kr = krs[0];
  const daysLeft = goal?.dueDate ? daysBetween(new Date(), new Date(goal.dueDate)) : 45;

  if (kr && kr.target > 0 && kr.current === 0 && daysLeft < 15 && kr.target > 100) {
    flags.push(`Key result "${kr.title}" starts from zero with only ${daysLeft} days left — likely unrealistic.`);
  }
  if (!goal?.dueDate) {
    flags.push('No due date set — goals without deadlines risk drifting.');
  }
  if ((goal?.progress || 0) < 20 && daysLeft < 21) {
    flags.push('Less than 20% done with under 3 weeks remaining — needs acceleration or scope reduction.');
  }
  if (krs.length > 5) {
    flags.push('More than 5 key results dilutes focus — consider trimming.');
  }
  if (flags.length === 0) {
    flags.push('No critical risk detected — target looks achievable with current pace.');
  }
  return { flags, realistic: flags.length === 0 || (flags.length === 1 && /No critical/.test(flags[0])), suggestedCount: Math.min(4, Math.max(2, krs.length || 3)) };
};

const aiImproveWording = (title: string) => {
  const t = title.trim().replace(/\s+/g, ' ');
  const lower = t.toLowerCase();
  let improved = t;
  if (/^increase/i.test(lower)) improved = `Drive ${t.replace(/^increase\s+/i, '').toLowerCase()} growth`;
  else if (/^improve/i.test(lower)) improved = `Elevate ${t.replace(/^improve\s+/i, '').toLowerCase()} quality`;
  else if (/^build/i.test(lower)) improved = `Deliver ${t.replace(/^build\s+/i, '')} (production-ready)`;
  else if (/^learn/i.test(lower)) improved = `Master ${t.replace(/^learn\s+/i, '')} with applied projects`;
  else if (/^create/i.test(lower)) improved = `Ship ${t.replace(/^create\s+/i, '')}`;
  else improved = t.endsWith('.') ? t : `${t} (measurable outcome)`;
  if (improved === t) improved = `Achieve ${t.toLowerCase()} with measurable milestones`;
  return {
    original: t,
    improved,
    tip: 'Start with a strong verb and end with an outcome you can measure.',
  };
};

const aiGenerateWeeklyUpdate = (checkIn: any) => {
  const wins = checkIn?.wins || 'Delivered planned tasks';
  const problems = checkIn?.problems || 'No major blockers';
  const nextActions = checkIn?.nextActions || 'Continue with the weekly plan';
  const progress = checkIn?.progress ?? 0;
  return `This week I reached ${progress}% completion. Wins: ${wins}. Blockers: ${problems}. Next: ${nextActions}.`;
};

const aiRecommendLearning = (skills: string[], goalType: string) => {
  const map: Record<string, string[]> = {};
  const all = skills.length ? skills : [goalType === 'REVENUE' ? 'Negotiation' : goalType === 'LEADERSHIP' ? 'Leadership' : 'Cloud & AI'];
  return all.slice(0, 4).map((s) => ({
    skill: s,
    course: `Master ${s} for Enterprise Delivery`,
    durationWeeks: 4,
    provider: 'OBI Academy',
    impact: '+6% career score',
  }));
};

export const aiAssist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = goalAiAssistSchema.parse(req.body);
    const { action } = parsed;
    const role = req.user?.role;

    if (!isPrivileged(role) && !['draft_from_text', 'convert_task', 'generate_weekly_update', 'detect_unrealistic', 'predict_completion', 'improve_wording', 'suggest_kpis', 'suggest_milestones', 'recommend_learning', 'identify_blockers'].includes(action)) {
      return next(new AppError('Only managers and HR can use this AI capability', 403));
    }

    let result: any;
    switch (action) {
      case 'draft_from_text':
        result = aiDraftFromText(parsed.text || '', parsed.goalType || 'PROJECT');
        break;
      case 'convert_task':
        result = aiConvertTask(parsed.text || 'New project');
        break;
      case 'suggest_kpis':
        result = { suggestions: aiSuggestKpis(parsed.goalType || 'REVENUE').map((k) => ({ kpi: k.name, unit: k.unit, description: k.description })) };
        break;
      case 'improve_wording':
        result = aiImproveWording(parsed.text || 'Increase performance');
        break;
      case 'predict_completion':
        result = aiPredictCompletion(parsed.goal);
        break;
      case 'detect_unrealistic':
        result = aiDetectUnrealistic(parsed.goal);
        break;
      case 'suggest_milestones':
        result = {
          milestones: [
            { week: 'Week 1', focus: 'Discovery & aligned success metrics' },
            { week: 'Week 2', focus: 'Core execution & weekly check-ins' },
            { week: 'Week 3', focus: 'Validation, review & closeout' },
          ],
        };
        break;
      case 'generate_weekly_update':
        result = { update: aiGenerateWeeklyUpdate(parsed.goal) };
        break;
      case 'recommend_learning':
        result = { recommendations: aiRecommendLearning((parsed.goal?.skills) || [], (parsed.goal?.goalType) || 'INDIVIDUAL') };
        break;
      case 'identify_blockers':
        result = {
          blockers: [
            { risk: 'Unclear success metric', severity: 'HIGH', mitigation: 'Define a measurable KPI before kickoff' },
            { risk: 'Thin progress cadence', severity: 'MEDIUM', mitigation: 'Enable weekly check-ins' },
            { risk: 'Dependency not assigned', severity: 'LOW', mitigation: 'Link dependent goals in the dependency graph' },
          ],
        };
        break;
      default:
        result = { response: 'I can help draft goals, convert tasks to OKRs, suggest KPIs, predict completion and flag unrealistic targets.' };
    }

    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
};

// ═══════════════════════════════════════════════════════════
// Recognition & Leaderboard
// ═══════════════════════════════════════════════════════════

export const getRecognition = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const where = await scopeWhere(employeeId, role || 'EMPLOYEE');
    const goals = await prisma.goal.findMany({ where, include: goalInclude });

    const completed = goals.filter((g) => g.status === 'COMPLETED' && g.updatedAt);
    const leaderboardMap: Record<string, any> = {};
    const recentFeed: any[] = [];

    for (const g of goals) {
      const name = g.owner ? `${g.owner.firstName} ${g.owner.lastName}` : g.ownerId;
      if (!leaderboardMap[g.ownerId]) {
        leaderboardMap[g.ownerId] = {
          ownerId: g.ownerId,
          name,
          profileImageUrl: g.owner?.profileImageUrl || null,
          designation: g.owner?.designation || '',
          points: 0,
          completed: 0,
          badges: [] as string[],
        };
      }
      leaderboardMap[g.ownerId].points += g.points || 0;
      if (g.status === 'COMPLETED') {
        leaderboardMap[g.ownerId].completed += 1;
        if (!leaderboardMap[g.ownerId].badges.includes('Goal Achiever')) leaderboardMap[g.ownerId].badges.push('Goal Achiever');
      }
      if (g.activities?.length) {
        const last = g.activities[g.activities.length - 1];
        if (last.type === 'COMPLETED' || last.type === 'PROGRESS_CHANGED') {
          recentFeed.push({
            id: last.id,
            actorName: last.actorName || name,
            title: g.title,
            type: last.type,
            message: `${last.actorName || name} ${last.type === 'COMPLETED' ? 'completed' : 'updated progress on'} "${g.title}"`,
            timestamp: last.timestamp,
            goalId: g.id,
          });
        }
      }
    }

    const achievements = leaderboardMap[employeeId]
      ? [
          ...(completed.length >= 1 ? ['🎯 Goal Achiever'] : []),
          ...(completed.length >= 3 ? ['🏆 Top Performer'] : []),
          ...(goals.filter((g) => g.goalType === 'LEARNING').length >= 1 ? ['📚 Continuous Learner'] : []),
          ...(goals.filter((g) => g.goalType === 'LEADERSHIP').length >= 1 ? ['🌟 Emerging Leader'] : []),
        ]
      : [];

    const leaderboard = Object.values(leaderboardMap)
      .sort((a: any, b: any) => b.points - a.points)
      .map((e: any, i: number) => ({ ...e, rank: i + 1 }));

    res.status(200).json({
      status: 'success',
      data: {
        leaderboard: leaderboard.slice(0, 12),
        recentFeed: recentFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 30),
        myAchievements: achievements,
        myPoints: leaderboardMap[employeeId]?.points || 0,
        myRank: leaderboard.find((e: any) => e.ownerId === employeeId)?.rank || null,
        totalCompleted: completed.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeOptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        employeeId: true,
        firstName: true,
        lastName: true,
        department: true,
        designation: true,
        profileImageUrl: true,
      },
      orderBy: { firstName: 'asc' },
    });
    res.status(200).json({ status: 'success', data: employees });
  } catch (error) {
    next(error);
  }
};
