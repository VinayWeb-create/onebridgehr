import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './config/db';

const enterpriseLeads = [
  {
    leadNumber: 'LED-2026-0001',
    clientName: 'Sanjay Deshmukh',
    companyName: 'NexGen Fintech Solutions',
    email: 'sanjay.d@nexgenfin.com',
    phone: '+91 98450 11223',
    serviceOfInterest: 'AI Agents',
    projectDetails:
      'We are looking to implement autonomous multi-agent systems to handle tier-1 loan pre-screening, financial risk analysis, and customer onboarding verification with real-time API integrations.',
    timeline: 'Immediate (1 month)',
    source: 'WEBSITE',
    status: 'NEGOTIATING',
    estimatedValue: 450000,
    currency: 'INR',
    notes: 'High priority enterprise deal. Met with VP Engineering. Discovery call completed.',
    followUpDate: new Date('2026-08-20'),
  },
  {
    leadNumber: 'LED-2026-0002',
    clientName: 'Pooja Iyer',
    companyName: 'OmniHealth Diagnostics',
    email: 'pooja.iyer@omnihealth.io',
    phone: '+91 97312 44556',
    serviceOfInterest: 'Cloud Solutions',
    projectDetails:
      'Need complete cloud migration from legacy on-prem infrastructure to AWS with multi-region failover, HIPAA/GDPR compliant data encryption, and Kubernetes microservices setup.',
    timeline: '1-3 Months',
    source: 'WEBSITE',
    status: 'PROPOSAL_SENT',
    estimatedValue: 680000,
    currency: 'INR',
    notes: 'Architecture blueprint and proposal sent. Awaiting feedback from CTO.',
    followUpDate: new Date('2026-08-22'),
  },
  {
    leadNumber: 'LED-2026-0003',
    clientName: 'Vikram Malhotra',
    companyName: 'AeroLogix Supply Chain',
    email: 'v.malhotra@aerologix.in',
    phone: '+91 99887 66554',
    serviceOfInterest: 'AI & Automation',
    projectDetails:
      'Intelligent document processing and OCR automation to parse global shipping bills, customs documents, and invoices directly into our ERP system with 99%+ accuracy.',
    timeline: '1-3 Months',
    source: 'WEBSITE',
    status: 'CONTACTED',
    estimatedValue: 350000,
    currency: 'INR',
    notes: 'Initial requirement gathering call conducted. Scheduling technical POC demo.',
    followUpDate: new Date('2026-08-25'),
  },
  {
    leadNumber: 'LED-2026-0004',
    clientName: 'Ananya Roy',
    companyName: 'ScaleGrid Systems',
    email: 'ananya.roy@scalegrid.com',
    phone: '+91 91234 56780',
    serviceOfInterest: 'DevOps & CI/CD',
    projectDetails:
      'Set up end-to-end automated CI/CD deployment pipelines using GitLab CI/CD and ArgoCD for our Kubernetes clusters across staging, QA, and production with automated security gates.',
    timeline: 'Immediate (1 month)',
    source: 'WEBSITE',
    status: 'WON',
    estimatedValue: 280000,
    currency: 'INR',
    notes: 'Contract signed! Onboarding and sprint planning kicking off next Monday.',
    followUpDate: null,
  },
  {
    leadNumber: 'LED-2026-0005',
    clientName: 'Kavita Menon',
    companyName: 'PrimeSecure Payments',
    email: 'kavita.m@primesecure.net',
    phone: '+91 98200 77889',
    serviceOfInterest: 'Cybersecurity',
    projectDetails:
      'Comprehensive vulnerability assessment, automated penetration testing (VAPT), SOC 2 compliance readiness audit, and continuous threat monitoring setup.',
    timeline: 'Immediate (1 month)',
    source: 'WEBSITE',
    status: 'NEW',
    estimatedValue: 520000,
    currency: 'INR',
    notes: 'Inquiry received via website contact form. Needs discovery call scheduled.',
    followUpDate: new Date('2026-08-18'),
  },
  {
    leadNumber: 'LED-2026-0006',
    clientName: 'Rohan Sen',
    companyName: 'Vanguard Retail Tech',
    email: 'rohan.sen@vanguardtech.co',
    phone: '+91 98310 99887',
    serviceOfInterest: 'Software Development',
    projectDetails:
      'End-to-end custom enterprise web & mobile application development for omni-channel retail inventory management with real-time POS synchronization.',
    timeline: '3-6 Months',
    source: 'WEBSITE',
    status: 'NEW',
    estimatedValue: 850000,
    currency: 'INR',
    notes: 'New enterprise inquiry from website. Assigned to Super Admin for qualification.',
    followUpDate: new Date('2026-08-19'),
  },
  {
    leadNumber: 'LED-2026-0007',
    clientName: 'Deepak Nambiar',
    companyName: 'Starlight Global Consulting',
    email: 'deepak.n@starlightglobal.com',
    phone: '+91 94470 12345',
    serviceOfInterest: 'Staffing',
    projectDetails:
      'Need contract staffing of 6 senior Full-Stack React/Node.js engineers and 2 DevOps architects for a 12-month cloud modernization project.',
    timeline: 'Immediate (1 month)',
    source: 'WEBSITE',
    status: 'CONTACTED',
    estimatedValue: 1200000,
    currency: 'INR',
    notes: 'Talent profiles and rate cards shared with hiring manager.',
    followUpDate: new Date('2026-08-21'),
  },
  {
    leadNumber: 'LED-2026-0008',
    clientName: 'Meera Kapoor',
    companyName: 'Aura Lifestyle Brands',
    email: 'meera.kapoor@auralifestyle.com',
    phone: '+91 98112 33445',
    serviceOfInterest: 'Marketing Cloud',
    projectDetails:
      'Salesforce Marketing Cloud implementation, customer journey automation, and multi-channel campaign integration across WhatsApp, Email, and SMS.',
    timeline: '1-3 Months',
    source: 'WEBSITE',
    status: 'PROPOSAL_SENT',
    estimatedValue: 400000,
    currency: 'INR',
    notes: 'Sent detailed milestone breakdown. Client reviewing with marketing heads.',
    followUpDate: new Date('2026-08-24'),
  },
  {
    leadNumber: 'LED-2026-0009',
    clientName: 'Arjun Singhania',
    companyName: 'Apex Capital Ventures',
    email: 'arjun@apexcap.vc',
    phone: '+91 99100 88776',
    serviceOfInterest: 'Digital Transformation',
    projectDetails:
      'Modernizing legacy portfolio management systems, integrating automated workflow approvals, BI analytics dashboards, and cloud-native microservices.',
    timeline: '3-6 Months',
    source: 'WEBSITE',
    status: 'NEGOTIATING',
    estimatedValue: 950000,
    currency: 'INR',
    notes: 'Finalizing statement of work (SOW) and service level agreements.',
    followUpDate: new Date('2026-08-23'),
  },
];

export async function seedLeads() {
  console.log('Seeding enterprise leads based on Onebridge contact inquiries...');
  
  for (const leadData of enterpriseLeads) {
    const existing = await (prisma as any).lead.findFirst({
      where: {
        OR: [
          { leadNumber: leadData.leadNumber },
          { email: leadData.email },
        ],
      },
    });

    if (!existing) {
      await (prisma as any).lead.create({
        data: leadData,
      });
      console.log(`Created Lead: ${leadData.leadNumber} - ${leadData.clientName} (${leadData.serviceOfInterest})`);
    } else {
      await (prisma as any).lead.update({
        where: { id: existing.id },
        data: leadData,
      });
      console.log(`Updated Lead: ${leadData.leadNumber} - ${leadData.clientName} (${leadData.serviceOfInterest})`);
    }
  }

  console.log('All Onebridge enterprise leads seeded successfully! 🚀');
}

if (require.main === module) {
  seedLeads()
    .catch((err) => {
      console.error('Error seeding leads:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
