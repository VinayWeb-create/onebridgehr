const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function prepareIndustryQuotations() {
  console.log('--- Preparing Industry Quotations on OneBridge Platform ---');

  // 1. Get or create default Billing Company
  let company = null;
  try {
    company = await prisma.billingCompany.findFirst({ where: { isDefault: true } });
    if (!company) {
      company = await prisma.billingCompany.findFirst();
    }
  } catch (e) {
    console.log('BillingCompany lookup note:', e.message);
  }

  if (!company) {
    company = {
      name: 'Onebridge Infotech Pvt Ltd',
      email: 'info@onebridgeinfotech.com',
      phone: '+91 98765 43210',
      website: 'https://onebridgeinfotech.com',
      addressLine1: 'Corporate Tower, Tech Hub',
      city: 'Hyderabad',
      state: 'Telangana',
      stateCode: '36',
      country: 'India',
    };
    try {
      company = await prisma.billingCompany.create({
        data: {
          ...company,
          isDefault: true,
          isActive: true,
        },
      });
    } catch (e) {
      console.log('Using in-memory fallback for company details');
    }
  }

  const validityDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days

  // Helper for sequential Quotation Number
  const quoCount = await prisma.quotation.count();
  const getNextQuoNum = (offset) => `QUO-2026-${String(quoCount + offset).padStart(4, '0')}`;

  // =========================================================================
  // 1. QUOTATION 1: Food Industry
  // =========================================================================
  console.log('\nCreating Quotation 1: Food Industry...');

  const foodItems = [
    {
      description: 'One-time Setup & Implementation (Food Industry Digital Funnel)',
      details: 'Comprehensive setup including Marketing funnel setup, Google Analytics / conversion tracking, CRM configuration, Lead-source configuration, Campaign structure, Tracking setup, and WhatsApp/Email workflow planning.',
      hsnSac: '998311',
      quantity: 1,
      unit: 'One-time',
      unitPrice: 35000,
      taxPercent: 18,
      amount: 35000,
      taxableAmount: 35000,
      cgst: 3150,
      sgst: 3150,
      igst: 0,
      total: 41300,
    },
    {
      description: 'Monthly Digital Marketing & Lead Generation Management (Food Industry B2B & B2C)',
      details: 'Monthly execution: Up to 12 Facebook/Instagram creatives & posts, up to 4 campaigns, up to 2 LinkedIn B2B campaigns (targeting Food Manufacturers, Distributors, Wholesalers, Retailers, Hotels, Restaurants, Food Processors, Procurement Teams, Importers/Exporters), Landing page optimization (up to 2), Ongoing Lead Gen via QLeads, CRM management, WhatsApp campaign support, up to 4 Email campaigns, Monthly Analytics Reporting & Strategy Review.',
      hsnSac: '998313',
      quantity: 1,
      unit: 'Month',
      unitPrice: 50000,
      taxPercent: 18,
      amount: 50000,
      taxableAmount: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
      total: 59000,
    },
  ];

  const foodSubTotal = 85000;
  const foodCgst = 7650;
  const foodSgst = 7650;
  const foodTaxAmount = 15300;
  const foodTotal = 100300;

  const foodTerms = `1. Payment Terms:
• 50% of setup fee in advance.
• Remaining setup amount before implementation completion.
• Monthly service fee payable in advance.
• Advertising budgets (Facebook, Instagram, LinkedIn) and third-party charges payable separately.

2. Exclusions (Billed separately based on actual requirement):
• Facebook/Instagram advertising budget & LinkedIn advertising budget.
• QLeads or third-party database subscriptions.
• WhatsApp Business/API conversation charges.
• Email/SMS broadcast charges.
• CRM third-party license charges (if applicable).
• Website development beyond agreed optimization.
• Professional photography/videography & Influencer marketing.
• Major graphic/video production & third-party software/API charges.

3. Quotation Validity: 30 Days from date of issuance.`;

  const foodNotes = `OBJECTIVE:
To build an integrated digital marketing and lead-generation system for the Food business covering B2B and B2C audiences, with focus on generating qualified enquiries, increasing website traffic, improving brand visibility and establishing measurable sales funnels.

EXPECTED MARKETING FUNNEL:
Facebook / LinkedIn / Lead Sources ➔ Food Industry Landing Page / Website ➔ Lead Capture ➔ CRM ➔ B2B / B2C Segmentation ➔ WhatsApp + Email Follow-up ➔ Sales Team ➔ Conversion & Revenue Tracking.

*Note: Lead volumes and conversions depend on market, offer, targeting, advertising budget, website quality and sales follow-up. No fixed number of leads or sales is guaranteed.`;

  const foodQuotationNumber = getNextQuoNum(1);
  const foodShareToken = crypto.randomBytes(24).toString('base64url');

  const foodQuotation = await prisma.quotation.create({
    data: {
      quotationNumber: foodQuotationNumber,
      companyId: company?.id || undefined,
      title: 'Food Industry – Digital Marketing, Lead Generation & Customer Engagement',
      clientName: 'Food Industry Client',
      clientCompany: 'TasteCraft Foods & Agro Products',
      clientEmail: 'contact@tastecraftfoods.com',
      clientPhone: '+91 98111 22334',
      clientAddress: 'Food Processing Park, Phase-II, Hyderabad, Telangana',
      items: foodItems,
      subTotal: foodSubTotal,
      taxPercent: 18,
      taxAmount: foodTaxAmount,
      discountAmount: 0,
      totalAmount: foodTotal,
      currency: 'INR',
      cgstAmount: foodCgst,
      sgstAmount: foodSgst,
      igstAmount: 0,
      taxType: 'CGST_SGST',
      placeOfSupply: 'Telangana',
      placeOfSupplyCode: '36',
      amountInWords: 'One Lakh Three Hundred Rupees Only',
      termsAndConditions: foodTerms,
      notes: foodNotes,
      status: 'SENT',
      validUntil: validityDate,
      shareToken: foodShareToken,
    },
  });

  console.log(`✅ Quotation 1 Created: ${foodQuotation.quotationNumber} (ID: ${foodQuotation.id})`);
  console.log(`   Share Token: ${foodShareToken}`);
  console.log(`   Total Amount: ₹${foodQuotation.totalAmount} (Subtotal: ₹${foodQuotation.subTotal} + GST: ₹${foodQuotation.taxAmount})`);

  // =========================================================================
  // 2. QUOTATION 2: Textile Industry
  // =========================================================================
  console.log('\nCreating Quotation 2: Textile Industry...');

  const textileItems = [
    {
      description: 'One-time Setup & Implementation (Textile Industry Digital Funnel)',
      details: 'Comprehensive setup including Textile marketing funnel setup, CRM configuration, Analytics setup, Campaign tracking, Lead-source setup, B2B/B2C segmentation, and WhatsApp/Email workflow planning.',
      hsnSac: '998311',
      quantity: 1,
      unit: 'One-time',
      unitPrice: 35000,
      taxPercent: 18,
      amount: 35000,
      taxableAmount: 35000,
      cgst: 3150,
      sgst: 3150,
      igst: 0,
      total: 41300,
    },
    {
      description: 'Monthly Digital Marketing & Lead Generation Management (Textile Industry B2B & B2C)',
      details: 'Monthly execution: Up to 12 Facebook/Instagram posts & creatives, up to 4 FB campaigns, up to 2 LinkedIn B2B campaigns (targeting Textile Manufacturers, Garment Manufacturers, Fabric Suppliers, Textile Exporters, Importers, Wholesalers, Retailers, Fashion Businesses, Apparel Brands, Procurement Teams), Textile landing-page optimization (up to 2), Ongoing Lead Gen via QLeads, CRM management, WhatsApp campaign support, up to 4 Email campaigns, Monthly Analytics Reporting & Strategy Review.',
      hsnSac: '998313',
      quantity: 1,
      unit: 'Month',
      unitPrice: 50000,
      taxPercent: 18,
      amount: 50000,
      taxableAmount: 50000,
      cgst: 4500,
      sgst: 4500,
      igst: 0,
      total: 59000,
    },
  ];

  const textileSubTotal = 85000;
  const textileCgst = 7650;
  const textileSgst = 7650;
  const textileTaxAmount = 15300;
  const textileTotal = 100300;

  const textileTerms = `1. Payment Terms:
• 50% of setup fee in advance.
• Remaining setup amount before implementation completion.
• Monthly management fee payable in advance.
• Advertising spend and third-party platform charges payable separately.

2. Exclusions (Billed separately based on actual usage/requirement):
• Facebook/Instagram advertising spend & LinkedIn advertising spend.
• QLeads / database subscription.
• WhatsApp Business/API conversation charges.
• Email/SMS gateway charges.
• CRM subscription / third-party licenses.
• Website development beyond agreed optimization.
• Photography/videography & Product catalogue production.
• Influencer marketing & Major creative/video production.
• Third-party software/API charges.

3. Quotation Validity: 30 Days from date of issuance.`;

  const textileNotes = `OBJECTIVE:
To establish a dedicated digital marketing and lead-generation ecosystem for the Textile business, targeting both B2B buyers and B2C customers through LinkedIn, Facebook, website, lead-generation platforms, CRM, WhatsApp and email.

MARKETING FUNNEL:
LinkedIn / Facebook / QLeads ➔ Textile Website / Landing Page ➔ Product / Catalogue Interest ➔ Lead Capture ➔ CRM ➔ B2B / B2C Segmentation ➔ WhatsApp + Email Follow-up ➔ Sales Team ➔ Quotation / Demo / Sample Request ➔ Order / Conversion.

*Note: Lead volumes and conversions depend on market conditions, product competitiveness, advertising budget, targeting, website conversion rate and sales follow-up. No fixed number of leads or sales is guaranteed.`;

  const textileQuotationNumber = getNextQuoNum(2);
  const textileShareToken = crypto.randomBytes(24).toString('base64url');

  const textileQuotation = await prisma.quotation.create({
    data: {
      quotationNumber: textileQuotationNumber,
      companyId: company?.id || undefined,
      title: 'Textile Industry – Digital Marketing, Lead Generation & Customer Engagement',
      clientName: 'Textile Industry Client',
      clientCompany: 'Vanguard Textiles & Garments Ltd',
      clientEmail: 'sales@vanguardtextiles.in',
      clientPhone: '+91 98222 33445',
      clientAddress: 'Weaving & Apparel Cluster, Surat, Gujarat',
      items: textileItems,
      subTotal: textileSubTotal,
      taxPercent: 18,
      taxAmount: textileTaxAmount,
      discountAmount: 0,
      totalAmount: textileTotal,
      currency: 'INR',
      cgstAmount: textileCgst,
      sgstAmount: textileSgst,
      igstAmount: 0,
      taxType: 'CGST_SGST',
      placeOfSupply: 'Telangana',
      placeOfSupplyCode: '36',
      amountInWords: 'One Lakh Three Hundred Rupees Only',
      termsAndConditions: textileTerms,
      notes: textileNotes,
      status: 'SENT',
      validUntil: validityDate,
      shareToken: textileShareToken,
    },
  });

  console.log(`✅ Quotation 2 Created: ${textileQuotation.quotationNumber} (ID: ${textileQuotation.id})`);
  console.log(`   Share Token: ${textileShareToken}`);
  console.log(`   Total Amount: ₹${textileQuotation.totalAmount} (Subtotal: ₹${textileQuotation.subTotal} + GST: ₹${textileQuotation.taxAmount})`);

  console.log('\n--- Summary of Created Quotations ---');
  console.log(`1. Food Industry Quotation:`);
  console.log(`   Number: ${foodQuotation.quotationNumber}`);
  console.log(`   Client: ${foodQuotation.clientCompany} (${foodQuotation.clientName})`);
  console.log(`   Share Link: /p/${foodShareToken}`);
  console.log(`   Total Amount: ₹${foodQuotation.totalAmount}`);
  console.log(`\n2. Textile Industry Quotation:`);
  console.log(`   Number: ${textileQuotation.quotationNumber}`);
  console.log(`   Client: ${textileQuotation.clientCompany} (${textileQuotation.clientName})`);
  console.log(`   Share Link: /p/${textileShareToken}`);
  console.log(`   Total Amount: ₹${textileQuotation.totalAmount}`);
}

prepareIndustryQuotations()
  .catch((err) => {
    console.error('Error preparing quotations:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
