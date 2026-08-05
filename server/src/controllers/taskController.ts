import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { taskSchema, taskUpdateSchema } from '../models/validators';
import { logActivity } from '../middleware/auditLogger';
import { socketService } from '../services/socketService';

export const createTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const creatorId = req.user?.employeeId;
    if (!creatorId) return next(new AppError('Unauthorized', 401));

    const parsed = taskSchema.parse(req.body);

    // Verify assignee exists
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
        priority: parsed.priority,
        status: 'PENDING',
        dueDate: new Date(parsed.dueDate),
        employeeId: parsed.employeeId,
        assignedById: creatorId,
        dependencies: parsed.dependencies || [],
        isRecurring: parsed.isRecurring,
        recurrenceCron: parsed.recurrenceCron,
        subtasks: parsed.subtasks || [],
        progress: 0,
      },
    });

    // Notify employee
    await prisma.notification.create({
      data: {
        employeeId: parsed.employeeId,
        title: 'New Task Assigned',
        message: `You have been assigned task: "${parsed.title}" by ${creatorId}. Due date: ${new Date(parsed.dueDate).toLocaleDateString()}`,
      },
    });

    socketService.sendNotification(parsed.employeeId, 'notification', {
      title: 'New Task Assigned',
      message: `Task: ${parsed.title}`,
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

    // Auth check: user must be assignee or creator (or HR/Admin)
    const isAssignee = task.employeeId === employeeId;
    const isCreator = task.assignedById === employeeId;
    const isHrOrAdmin = req.user?.role === 'HR' || req.user?.role === 'SUPER_ADMIN';

    if (!isAssignee && !isCreator && !isHrOrAdmin) {
      return next(new AppError('Not authorized to modify this task', 403));
    }

    const updateData: any = {};

    if (parsed.status !== undefined) {
      updateData.status = parsed.status;
      // If completed, set progress to 100
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

    // Add comment if provided
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

    // Add time log if provided
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

    // Notify assignee or creator depending on who made the change
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

export const getEmployeeTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employeeId = req.params.employeeId || req.user?.employeeId;

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
