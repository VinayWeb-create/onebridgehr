# Task List: OneBridge Infotech HR Management System

## Foundation
- [x] Initialize directory structure and configuration files
- [x] Set up `shared` folder for TypeScript schemas and validation validators

## Backend Development (`server/`)
- [x] Initialize Server, `package.json`, and TS Config
- [x] Set up Prisma Schema for MongoDB and run generation
- [x] Build Authentication APIs (Login, Register, Password Reset, Lockout checks)
- [x] Build Employee Profile & Document Upload APIs (with Signature validations)
- [x] Build Services (Nodemailer, PDFKit payslip engine, QR code generator, Socket.io socket handlers)
- [x] Build Attendance API (with check-in/out, breaks, overtime calculations and geofencing validation)
- [x] Build Leave Management API (workflow approvals, balance logic)
- [x] Build Task Board API (Kanban transitions, dependencies, time logging)
- [x] Build Payroll API (Net salary math, monthly generation, PDF export triggers)
- [x] Build Global Search and Reports API
- [x] Set up Audit logging, Security middleware (Helmet, Rate-limit, CORS, error handling)

## Frontend Development (`client/`)
- [x] Initialize React + Vite + TypeScript in the `client/` folder
- [x] Install dependencies (Tailwind, Shadcn UI, React Query, React Hook Form, Axios, Recharts)
- [x] Create layout structures (AuthLayout, Sidebar navigation, Header, Theme support)
- [x] Build Auth Pages (Login, forgot/reset password, profile setup)
- [x] Build Employee Dashboard (Overview, profile completeness, status, check-in widget, leaves)
- [x] Build HR Dashboard (Employee grid, present/absent stats, leave approval table, payroll builder)
- [x] Build Task Kanban Board & Calendar page (Drag-drop statuses, subtask details modal)
- [x] Build ID Card Preview (Front/back animated preview, print layout stylesheet, PNG/PDF download)
- [x] Build Leave Request form and status tracker
- [x] Build Payroll & Payslip Panel (Interactive tables, PDF/email actions)

## Orchestration & Deployment
- [x] Create Seeding Script for MongoDB records
- [x] Set up Dockerfiles and docker-compose Configuration
- [x] Create comprehensive README.md and Swagger API Docs
- [x] Complete full verification cycle and launch dev server
