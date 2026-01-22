import type { AnalyserPreset } from '../types';

/**
 * Default presets for the vault analyser
 * These should be seeded in the backend via a management command or migration
 */
export const defaultPresets: Omit<AnalyserPreset, 'id' | 'created_at' | 'updated_at' | 'is_system' | 'created_by' | 'is_active' | 'isDefault'>[] = [
  {
    name: 'Contract Analysis',
    description: 'Extract key information from contracts and legal documents',
    columns: [
      {
        name: 'Parties',
        type: 'short-text',
        prompt: 'Extract the names of all parties involved in the contract (individuals, companies, organizations).',
      },
      {
        name: 'Contract Date',
        type: 'date',
        prompt: 'Extract the date when the contract was signed or executed.',
      },
      {
        name: 'Contract Value',
        type: 'number',
        prompt: 'Extract the monetary value or amount specified in the contract. Include currency if mentioned.',
      },
      {
        name: 'Key Terms',
        type: 'long-text',
        prompt: 'Extract the main terms and conditions, including duration, payment terms, obligations, and any special clauses.',
      },
      {
        name: 'Termination Clause',
        type: 'long-text',
        prompt: 'Extract information about termination conditions, notice periods, and termination procedures.',
      },
    ],
  },
  {
    name: 'Invoice Extraction',
    description: 'Extract structured data from invoices',
    columns: [
      {
        name: 'Invoice Number',
        type: 'short-text',
        prompt: 'Extract the invoice number or invoice ID.',
      },
      {
        name: 'Invoice Date',
        type: 'date',
        prompt: 'Extract the invoice date.',
      },
      {
        name: 'Due Date',
        type: 'date',
        prompt: 'Extract the payment due date.',
      },
      {
        name: 'Vendor Name',
        type: 'short-text',
        prompt: 'Extract the name of the vendor or supplier issuing the invoice.',
      },
      {
        name: 'Total Amount',
        type: 'number',
        prompt: 'Extract the total amount due on the invoice. Include currency if mentioned.',
      },
      {
        name: 'Line Items',
        type: 'list',
        prompt: 'Extract all line items from the invoice, including description, quantity, unit price, and line total.',
      },
    ],
  },
  {
    name: 'Receipt Extraction',
    description: 'Extract data from receipts',
    columns: [
      {
        name: 'Merchant Name',
        type: 'short-text',
        prompt: 'Extract the name of the merchant or business.',
      },
      {
        name: 'Purchase Date',
        type: 'date',
        prompt: 'Extract the date of purchase.',
      },
      {
        name: 'Total Amount',
        type: 'number',
        prompt: 'Extract the total amount paid. Include currency if mentioned.',
      },
      {
        name: 'Payment Method',
        type: 'short-text',
        prompt: 'Extract the payment method used (cash, credit card, debit card, etc.).',
      },
      {
        name: 'Items Purchased',
        type: 'list',
        prompt: 'Extract all items purchased, including description and price if available.',
      },
    ],
  },
  {
    name: 'Person Identification',
    description: 'Extract information about people mentioned in documents',
    columns: [
      {
        name: 'Full Name',
        type: 'short-text',
        prompt: 'Extract the full name of the person.',
      },
      {
        name: 'Date of Birth',
        type: 'date',
        prompt: 'Extract the date of birth if mentioned.',
      },
      {
        name: 'Address',
        type: 'long-text',
        prompt: 'Extract the full address including street, city, state, and postal code.',
      },
      {
        name: 'Contact Information',
        type: 'short-text',
        prompt: 'Extract phone numbers, email addresses, or other contact information.',
      },
      {
        name: 'ID Number',
        type: 'short-text',
        prompt: 'Extract any identification numbers (SSN, passport number, driver\'s license, etc.).',
      },
    ],
  },
  {
    name: 'Financial Statement',
    description: 'Extract key financial metrics from statements',
    columns: [
      {
        name: 'Statement Period',
        type: 'short-text',
        prompt: 'Extract the reporting period (e.g., Q1 2024, Fiscal Year 2023).',
      },
      {
        name: 'Revenue',
        type: 'number',
        prompt: 'Extract total revenue or sales figures.',
      },
      {
        name: 'Expenses',
        type: 'number',
        prompt: 'Extract total expenses or costs.',
      },
      {
        name: 'Net Income',
        type: 'number',
        prompt: 'Extract net income or profit/loss.',
      },
      {
        name: 'Assets',
        type: 'number',
        prompt: 'Extract total assets if mentioned.',
      },
      {
        name: 'Liabilities',
        type: 'number',
        prompt: 'Extract total liabilities if mentioned.',
      },
    ],
  },
];
