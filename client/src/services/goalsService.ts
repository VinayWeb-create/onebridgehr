import { api } from './api';

export type GoalStatus = 'NOT_STARTED' | 'ON_TRACK' | 'BEHIND' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type GoalPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type GoalType =
  | 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'INDIVIDUAL' | 'LEARNING' | 'INNOVATION'
  | 'REVENUE' | 'CUSTOMER_SUCCESS' | 'QUALITY' | 'PROJECT' | 'LEADERSHIP' | 'STRETCH';
export type GoalVisibility = 'PRIVATE' | 'TEAM' | 'DEPARTMENT' | 'COMPANY';
export type ApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface GoalKeyResult {
  id: string;
  title: string;
  current: number;
  target: number;
  unit?: string | null;
  progress: number;
  confidence?: number | null;
}

export interface GoalCheckIn {
  id: string;
  authorId?: string | null;
  authorName: string;
  weekLabel: string;
  progress: number;
  problems?: string | null;
  wins?: string | null;
  nextActions?: string | null;
  attachments: string[];
  managerComment?: string | null;
  status?: string | null;
  createdAt: string;
}

export interface GoalComment {
  id: string;
  authorId?: string | null;
  authorName: string;
  content: string;
  isManager: boolean;
  attachments: string[];
  timestamp: string;
}

export interface GoalActivity {
  id: string;
  actorId?: string | null;
  actorName: string;
  type: string;
  message: string;
  metadata?: Record<string, any> | null;
  timestamp: string;
}

export interface GoalOwner {
  firstName: string;
  lastName: string;
  department?: string;
  designation?: string;
  profileImageUrl?: string | null;
  employeeId: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  goalType: GoalType;
  ownerId: string;
  owner?: GoalOwner;
  assignedById?: string | null;
  assignedBy?: { firstName: string; lastName: string; designation?: string } | null;
  managerName?: string | null;
  managerId?: string | null;
  department: string;
  priority: GoalPriority;
  weight: number;
  progress: number;
  status: GoalStatus;
  confidence?: number | null;
  startDate: string;
  endDate?: string | null;
  dueDate?: string | null;
  businessObjective?: string | null;
  businessImpact?: string | null;
  successMetrics: string[];
  kpiName?: string | null;
  kpiCurrent?: number | null;
  kpiTarget?: number | null;
  kpiUnit?: string | null;
  departmentKpi?: string | null;
  linkedProject?: string | null;
  linkedKpiIds: string[];
  skills: string[];
  contributors: string[];
  attachments: string[];
  keyResults: GoalKeyResult[];
  checkIns: GoalCheckIn[];
  comments: GoalComment[];
  activities: GoalActivity[];
  dependencies: string[];
  parentGoalId?: string | null;
  isCompanyGoal: boolean;
  visibility: GoalVisibility;
  approvalStatus: ApprovalStatus;
  approvalNote?: string | null;
  points: number;
  aiNotes?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalTemplate {
  id: string;
  name: string;
  goalType: GoalType;
  description: string;
  keyResults: GoalKeyResult[];
  successMetrics: string[];
  skills: string[];
  aiConfig?: Record<string, any> | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

export interface DashboardData {
  quarter?: string;
  overallProgress: number;
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  attentionGoals: number;
  overdue: number;
  dueThisMonth: number;
  byType: { type: string; count: number }[];
  byDepartment: Record<string, number>;
  statusBreakdown: Record<string, number>;
  teamCount: number;
  performanceRating: number;
  promotionReadiness: string;
  managerFeedback: string;
  avgProgress: number;
  completionTier: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AnalyticsData {
  completionTrend: { quarter: string; total: number; completed: number; rate: number; avgProgress: number }[];
  departmentComparison: { department: string; total: number; completed: number; avgProgress: number }[];
  topPerformers: {
    ownerId: string; ownerName: string; total: number; completed: number; avgProgress: number;
    points: number; score: number;
  }[];
  riskGoals: Goal[];
  aging: { label: string; count: number }[];
  heatmap: { week: string; progress: number; count: number }[];
  completionByManager: { manager: string; total: number; completed: number }[];
  completionByType: { type: string; count: number }[];
}

export interface ManagerReviewData {
  employees: {
    ownerId: string; ownerName: string; profileImageUrl?: string | null; designation: string;
    department: string; total: number; completed: number; blocked: number; atRisk: number;
    behind: number; pendingApproval: number; needsSupport: number; avgProgress: number; dueSoon: number;
  }[];
  approvalQueue: Goal[];
  summary: {
    totalEmployees: number; totalGoals: number; completedThisWeek: number; blockedGoals: number;
    atRiskGoals: number; supportNeeded: number; pendingApprovals: number; activityEvents: number;
  };
  upComing: Goal[];
}

export interface CareerData {
  promotionScore: number;
  promotionReady: string;
  readinessLevel: string;
  managerConfidence: number;
  skillsMatched: number;
  leadershipStrength: string;
  goalCompletion: number;
  expectedRating: number;
  suggestedHike: number;
  bonusEligible: boolean;
  promotionRecommended: boolean;
  futureRoles: string[];
  skills: string[];
  recentLearning: { title: string; status: GoalStatus; progress: number }[];
  careerScore: number;
}

export interface RecognitionData {
  leaderboard: {
    ownerId: string; name: string; profileImageUrl?: string | null; designation: string;
    points: number; completed: number; badges: string[]; rank: number;
  }[];
  recentFeed: {
    id: string; actorName: string; title: string; type: string; message: string;
    timestamp: string; goalId: string;
  }[];
  myAchievements: string[];
  myPoints: number;
  myRank: number | null;
  totalCompleted: number;
}

export interface EmployeeOption {
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  profileImageUrl?: string | null;
}

export interface AiResult {
  [key: string]: any;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  goalType?: GoalType;
  ownerId?: string;
  managerId?: string;
  managerName?: string;
  priority?: GoalPriority;
  weight?: number;
  status?: GoalStatus;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  businessObjective?: string;
  businessImpact?: string;
  successMetrics?: string[];
  kpiName?: string;
  kpiCurrent?: number;
  kpiTarget?: number;
  kpiUnit?: string;
  departmentKpi?: string;
  linkedProject?: string;
  skills?: string[];
  contributors?: string[];
  attachments?: string[];
  keyResults?: Partial<GoalKeyResult>[];
  dependencies?: string[];
  parentGoalId?: string;
  isCompanyGoal?: boolean;
  visibility?: GoalVisibility;
  approvalStatus?: ApprovalStatus;
}

export const goalsService = {
  // CRUD
  getGoals: async (params?: Record<string, string>) => {
    const res = await api.get('/goals', { params });
    return res.data.data as Goal[];
  },
  getMyGoals: async () => {
    const res = await api.get('/goals/mine');
    return res.data.data as Goal[];
  },
  getGoalById: async (id: string) => {
    const res = await api.get(`/goals/${id}`);
    return res.data.data as Goal;
  },
  createGoal: async (data: CreateGoalInput) => {
    const res = await api.post('/goals', data);
    return res.data.data as Goal;
  },
  updateGoal: async (id: string, data: Partial<CreateGoalInput>) => {
    const res = await api.put(`/goals/${id}`, data);
    return res.data.data as Goal;
  },
  deleteGoal: async (id: string) => {
    const res = await api.delete(`/goals/${id}`);
    return res.data;
  },

  // Interactions
  addCheckIn: async (id: string, data: { weekLabel?: string; progress: number; problems?: string; wins?: string; nextActions?: string; status?: GoalStatus }) => {
    const res = await api.post(`/goals/${id}/check-in`, data);
    return res.data.data as { checkIn: GoalCheckIn; goal: Goal };
  },
  addComment: async (id: string, data: { content: string; isManager?: boolean }) => {
    const res = await api.post(`/goals/${id}/comment`, data);
    return res.data.data as { comment: GoalComment; comments: GoalComment[]; goal: Goal };
  },
  updateProgress: async (id: string, data: { progress?: number; status?: GoalStatus; note?: string }) => {
    const res = await api.post(`/goals/${id}/progress`, data);
    return res.data.data as Goal;
  },
  reviewGoal: async (id: string, data: { decision: 'APPROVED' | 'REJECTED'; note?: string }) => {
    const res = await api.post(`/goals/${id}/review`, data);
    return res.data.data as Goal;
  },

  // Dashboards & analytics
  getDashboard: async () => {
    const res = await api.get('/goals/dashboard');
    return res.data.data as DashboardData;
  },
  getAnalytics: async () => {
    const res = await api.get('/goals/analytics');
    return res.data.data as AnalyticsData;
  },
  getManagerReview: async () => {
    const res = await api.get('/goals/manager-review');
    return res.data.data as ManagerReviewData;
  },
  getCareer: async (employeeId?: string) => {
    const res = await api.get('/goals/career', { params: { employeeId } });
    return res.data.data as CareerData;
  },
  getTimeline: async () => {
    const res = await api.get('/goals/timeline');
    return res.data.data as (GoalActivity & { goalId: string; goalTitle: string })[];
  },
  getRecognition: async () => {
    const res = await api.get('/goals/recognition');
    return res.data.data as RecognitionData;
  },
  getEmployeeOptions: async () => {
    const res = await api.get('/goals/employees');
    return res.data.data as EmployeeOption[];
  },

  // Templates
  getTemplates: async () => {
    const res = await api.get('/goals/templates');
    return res.data.data as GoalTemplate[];
  },
  createTemplate: async (data: Partial<GoalTemplate>) => {
    const res = await api.post('/goals/templates', data);
    return res.data.data as GoalTemplate;
  },
  deleteTemplate: async (id: string) => {
    const res = await api.delete(`/goals/templates/${id}`);
    return res.data;
  },

  // AI assistant
  aiAssist: async (action: string, payload: any) => {
    const res = await api.post('/goals/ai/assist', { action, ...payload });
    return res.data.data as AiResult;
  },
};