import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { taskSchema, taskUpdateSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';
import { socketService } from '../services/socketService';
import { emailService } from '../services/emailService';

const markOverdueTasks = async () => {
  const now = new Date();
  await prisma.task.updateMany({
    where: {
      dueDate: { lt: now },
      status: { notIn: ['COMPLETED', 'REJECTED', 'OVERDUE'] }
    },
    data: { status: 'OVERDUE' }
  });
};

export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.user?.employeeId;
    const role = req.user?.role;
    if (!creatorId) return next(new AppError('Unauthorized', 401));

    const parsed = taskSchema.parse(req.body);

    // If regular employee (not Admin/HR/Lead), they can only assign to themselves
    const isPrivileged = role === 'HR' || role === 'SUPER_ADMIN' || role === 'TEAM_LEAD';
    if (!isPrivileged && parsed.employeeId !== creatorId) {
      return next(new AppError('Employees can only assign tasks to themselves', 403));
    }

    const employee = await prisma.employee.findUnique({
      where: { employeeId: parsed.employeeId },
    });
    if (!employee) {
      return next(new AppError(`Assignee employee ID ${parsed.employeeId} not found`, 404));
    }

    const task = await prisma.task.create({
      data: {
        title: parsed.title,
        description: parsed.description,
        projectName: (req.body as any).projectName || null,
        priority: parsed.priority,
        status: 'PENDING',
        startDate: (req.body as any).startDate ? new Date((req.body as any).startDate) : null,
        dueDate: new Date(parsed.dueDate),
        expectedHours: (req.body as any).expectedHours || null,
        riskLevel: (req.body as any).riskLevel || null,
        attachments: (req.body as any).attachments || [],
        employeeId: parsed.employeeId,
        assignedById: creatorId,
        dependencies: parsed.dependencies || [],
        isRecurring: parsed.isRecurring,
        recurrenceCron: parsed.recurrenceCron,
        subtasks: parsed.subtasks || [],
        progress: 0,
        emailSent: false,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            designation: true,
          },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });

    // Send task assignment notification asynchronously (fire-and-forget) to keep task creation fast
    sendTaskAssignmentNotificationInternal(task.id).catch((notifyErr: any) => {
      console.error('Failed to send task assignment notification:', notifyErr?.message || notifyErr);
    });

    await logActivity(creatorId, 'TASK_CREATE', `Assigned task ${task.id} to ${parsed.employeeId}`, req);

    res.status(201).json({
      status: 'success',
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

const sendTaskAssignmentNotificationInternal = async (taskId: string) => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      employee: { select: { firstName: true, lastName: true, email: true, employeeId: true } },
      assignedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!task) return;

  const assignedByName = task.assignedBy
    ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}`
    : 'OneBridge HR';

  const deadline = new Date(task.dueDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let timeline: string | undefined;
  if (task.startDate) {
    const start = new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    timeline = `Phase 1: Planning & Setup (${start}) → Phase 2: Execution → Phase 3: Review & Delivery (${end})${task.expectedHours ? ` | Estimated Effort: ${task.expectedHours} hrs` : ''}`;
  }

  await emailService.sendTaskAssignmentEmail(
    task.employee.email,
    `${task.employee.firstName} ${task.employee.lastName}`,
    {
      title: task.title,
      description: task.description,
      priority: task.priority,
      deadline,
      timeline,
      attachments: task.attachments as string[],
      assignedByName,
      projectName: task.projectName || undefined,
    }
  );

  await prisma.task.update({
    where: { id: taskId },
    data: { emailSent: true },
  });

  await prisma.notification.create({
    data: {
      employeeId: task.employeeId,
      title: 'New Task Assigned',
      message: `You have been assigned task: "${task.title}" by ${assignedByName}. Due date: ${deadline}`,
    },
  });

  const notificationPayload = {
    employeeId: task.employee.employeeId,
    title: 'New Task Assigned',
    message: `Task: ${task.title}`,
  };
  socketService.io?.emit('notification', notificationPayload);
  socketService.sendNotification(task.employee.employeeId, 'notification', notificationPayload);
};

export const sendTaskAssignmentNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return next(new AppError('Task not found', 404));

    const isCreator = task.assignedById === employeeId;
    const isHrOrAdmin = req.user?.role === 'HR' || req.user?.role === 'SUPER_ADMIN';
    if (!isCreator && !isHrOrAdmin) {
      return next(new AppError('Not authorized to resend task notification', 403));
    }

    await sendTaskAssignmentNotificationInternal(taskId);

    await logActivity(employeeId, 'TASK_NOTIFY_RESEND', `Resent assignment notification for task ${taskId}`, req);

    res.status(200).json({
      status: 'success',
      message: 'Task assignment notification sent successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const parsed = taskUpdateSchema.parse(req.body);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return next(new AppError('Task not found', 404));
    }

    const isAssignee = task.employeeId === employeeId;
    const isCreator = task.assignedById === employeeId;
    const isHrOrAdmin = req.user?.role === 'HR' || req.user?.role === 'SUPER_ADMIN';

    if (!isAssignee && !isCreator && !isHrOrAdmin) {
      return next(new AppError('Not authorized to modify this task', 403));
    }

    const updateData: any = {};

    if ((req.body as any).projectName !== undefined) {
      updateData.projectName = (req.body as any).projectName;
    }
    if ((req.body as any).startDate !== undefined) {
      updateData.startDate = (req.body as any).startDate ? new Date((req.body as any).startDate) : null;
    }
    if ((req.body as any).dueDate !== undefined) {
      updateData.dueDate = new Date((req.body as any).dueDate);
    }
    if ((req.body as any).expectedHours !== undefined) {
      updateData.expectedHours = (req.body as any).expectedHours;
    }
    if ((req.body as any).riskLevel !== undefined) {
      updateData.riskLevel = (req.body as any).riskLevel;
    }
    if ((req.body as any).attachments !== undefined) {
      updateData.attachments = (req.body as any).attachments;
    }
    if ((req.body as any).priority !== undefined) {
      updateData.priority = (req.body as any).priority;
    }

    if (parsed.status !== undefined) {
      updateData.status = parsed.status;
      if (parsed.status === 'COMPLETED') {
        updateData.progress = 100;
      }
    }

    if (parsed.progress !== undefined) {
      updateData.progress = parsed.progress;
    }

    if (parsed.subtasks !== undefined) {
      updateData.subtasks = parsed.subtasks;
    }

    if (parsed.comment !== undefined && parsed.comment.trim() !== '') {
      const newComment = {
        authorId: employeeId,
        authorName: `${req.user?.email || 'User'}`,
        content: parsed.comment,
        timestamp: new Date(),
      };

      updateData.comments = {
        push: newComment,
      };
    }

    if (parsed.timeLogMinutes !== undefined && parsed.timeLogMinutes > 0) {
      const newLog = {
        employeeId,
        durationMinutes: parsed.timeLogMinutes,
        loggedAt: new Date(),
      };
      updateData.timeLogs = {
        push: newLog,
      };
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });

    const targetNotifyId = isAssignee ? task.assignedById : task.employeeId;
    const modifierName = employeeId;

    await prisma.notification.create({
      data: {
        employeeId: targetNotifyId,
        title: 'Task Updated',
        message: `Task "${task.title}" was updated by ${modifierName}. Status: ${updatedTask.status}, Progress: ${updatedTask.progress}%`,
      },
    });

    socketService.sendNotification(targetNotifyId, 'notification', {
      title: 'Task Updated',
      message: `Task "${task.title}" status: ${updatedTask.status}`,
    });

    await logActivity(employeeId, 'TASK_UPDATE', `Updated task ${taskId} | Status: ${updatedTask.status} | Progress: ${updatedTask.progress}`, req);

    res.status(200).json({
      status: 'success',
      data: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    await markOverdueTasks();

    const isAdmin = role === 'HR' || role === 'SUPER_ADMIN';
    const where: any = isAdmin ? {} : { employeeId };

    const tasks = await prisma.task.findMany({ where });

    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    const now = new Date();
    const overdueTasks = tasks.filter(t =>
      t.dueDate < now && !['COMPLETED', 'REJECTED'].includes(t.status)
    ).length;

    const criticalTasks = tasks.filter(t =>
      t.priority === 'CRITICAL' && !['COMPLETED', 'REJECTED'].includes(t.status)
    ).length;

    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = tasks
      .filter(t =>
        t.dueDate >= now &&
        t.dueDate <= next7Days &&
        !['COMPLETED', 'REJECTED'].includes(t.status)
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        progress: t.progress,
        employeeId: t.employeeId,
        projectName: t.projectName,
      }));

    const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
    let productivity: number | null = null;
    if (completedTasks.length > 0) {
      const totalDays = completedTasks.reduce((sum, t) => {
        const created = new Date(t.createdAt).getTime();
        const due = new Date(t.dueDate).getTime();
        const actual = Math.min(due, new Date(t.updatedAt).getTime());
        const days = Math.max(1, Math.ceil((actual - created) / (1000 * 60 * 60 * 24)));
        return sum + days;
      }, 0);
      productivity = Math.round((totalDays / completedTasks.length) * 10) / 10;
    }

    res.status(200).json({
      status: 'success',
      data: {
        total,
        completionPercent,
        overdueTasks,
        criticalTasks,
        upcomingDeadlines,
        productivity,
        byStatus: {
          pending: tasks.filter(t => t.status === 'PENDING').length,
          inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
          review: tasks.filter(t => t.status === 'REVIEW').length,
          completed,
          rejected: tasks.filter(t => t.status === 'REJECTED').length,
        },
        byPriority: {
          low: tasks.filter(t => t.priority === 'LOW').length,
          medium: tasks.filter(t => t.priority === 'MEDIUM').length,
          high: tasks.filter(t => t.priority === 'HIGH').length,
          critical: criticalTasks,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTimelineCards = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    await markOverdueTasks();

    const isAdmin = role === 'HR' || role === 'SUPER_ADMIN' || role === 'TEAM_LEAD';
    const where: any = {
      priority: { in: ['HIGH', 'CRITICAL'] },
      status: { notIn: ['COMPLETED', 'REJECTED'] },
    };
    if (!isAdmin) {
      where.employeeId = employeeId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
      },
      orderBy: [
        { priority: 'desc' as any },
        { dueDate: 'asc' },
      ],
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const timelineCards = tasks.map(t => {
      const dueDate = new Date(t.dueDate);
      const remainingDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const startDate = t.startDate ? new Date(t.startDate) : new Date(t.createdAt);
      return {
        id: t.id,
        title: t.title,
        startDate,
        endDate: dueDate,
        expectedHours: t.expectedHours,
        progress: t.progress,
        riskLevel: t.riskLevel,
        remainingDays,
        priority: t.priority,
        status: t.status,
        projectName: t.projectName,
        employeeId: t.employeeId,
        employeeName: t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : null,
        emailSent: t.emailSent,
      };
    });

    res.status(200).json({
      status: 'success',
      count: timelineCards.length,
      data: timelineCards,
    });
  } catch (error) {
    next(error);
  }
};

export const addTaskComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const { content, attachments } = req.body;
    if (!content || !content.trim()) {
      return next(new AppError('Comment content is required', 400));
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return next(new AppError('Task not found', 404));

    const isAssignee = task.employeeId === employeeId;
    const isCreator = task.assignedById === employeeId;
    const isHrOrAdmin = req.user?.role === 'HR' || req.user?.role === 'SUPER_ADMIN';
    if (!isAssignee && !isCreator && !isHrOrAdmin) {
      return next(new AppError('Not authorized to comment on this task', 403));
    }

    const author = await prisma.employee.findUnique({
      where: { employeeId },
      select: { firstName: true, lastName: true, email: true },
    });

    const newComment = {
      authorId: employeeId,
      authorName: author ? `${author.firstName} ${author.lastName}` : req.user?.email || 'User',
      content: content.trim(),
      attachments: attachments || [],
      timestamp: new Date(),
    };

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        comments: { push: newComment } as any,
      },
      include: {
        employee: { select: { firstName: true, lastName: true } },
        assignedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const targetNotifyId = isAssignee ? task.assignedById : task.employeeId;
    await prisma.notification.create({
      data: {
        employeeId: targetNotifyId,
        title: 'New Comment on Task',
        message: `${newComment.authorName} commented on "${task.title}": "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
      },
    });

    socketService.sendNotification(targetNotifyId, 'notification', {
      title: 'New Comment',
      message: `Task: ${task.title}`,
    });

    await logActivity(employeeId, 'TASK_COMMENT', `Added comment to task ${id}`, req);

    res.status(200).json({
      status: 'success',
      data: {
        comment: newComment,
        comments: updatedTask.comments,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logTimeEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const { durationMinutes, notes } = req.body;
    const mins = Number(durationMinutes);
    if (!mins || mins <= 0) {
      return next(new AppError('Valid durationMinutes (positive number) is required', 400));
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return next(new AppError('Task not found', 404));

    const isAssignee = task.employeeId === employeeId;
    const isHrOrAdmin = req.user?.role === 'HR' || req.user?.role === 'SUPER_ADMIN';
    if (!isAssignee && !isHrOrAdmin) {
      return next(new AppError('Not authorized to log time for this task', 403));
    }

    const newLog = {
      employeeId,
      durationMinutes: mins,
      loggedAt: new Date(),
      notes: notes?.trim() || undefined,
    };

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        timeLogs: { push: newLog as any } as any,
      },
    });

    const totalMinutes = (updatedTask.timeLogs as any[] || []).reduce(
      (sum: number, l: any) => sum + (l.durationMinutes || 0), 0
    );

    await logActivity(employeeId, 'TASK_TIME_LOG', `Logged ${mins} mins on task ${id}`, req);

    res.status(200).json({
      status: 'success',
      data: {
        log: newLog,
        totalLoggedMinutes: totalMinutes,
        timeLogs: updatedTask.timeLogs,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.employeeId || req.user?.employeeId;

    await markOverdueTasks();

    const tasks = await prisma.task.findMany({
      where: { employeeId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

export const getAssignedTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;

    await markOverdueTasks();

    const tasks = await prisma.task.findMany({
      where: { assignedById: employeeId },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await markOverdueTasks();

    const tasks = await prisma.task.findMany({
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            department: true,
          },
        },
        assignedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const employeeId = req.user?.employeeId;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return next(new AppError('Task not found', 404));

    await prisma.task.delete({ where: { id: taskId } });

    await logActivity(employeeId, 'TASK_DELETE', `Deleted task "${task.title}" (${taskId})`, req);

    res.status(200).json({
      status: 'success',
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getTaskStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.user?.employeeId;
    const role = req.user?.role;
    if (!employeeId) return next(new AppError('Unauthorized', 401));

    const isAdmin = role === 'HR' || role === 'SUPER_ADMIN';
    const where = isAdmin ? {} : { employeeId };

    const tasks = await prisma.task.findMany({ where });

    const now = new Date();
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'PENDING').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      review: tasks.filter(t => t.status === 'REVIEW').length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      rejected: tasks.filter(t => t.status === 'REJECTED').length,
      overdue: tasks.filter(t => t.dueDate < now && !['COMPLETED', 'REJECTED'].includes(t.status)).length,
      totalTimeLogged: tasks.reduce((sum, t) => {
        const logs = (t.timeLogs as any[]) || [];
        return sum + logs.reduce((s: number, l: any) => s + (l.durationMinutes || 0), 0);
      }, 0),
    };

    res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
