// Made-up sample data. Nothing here comes from a real company or customer.

export function sampleTemplate() {
  return {
    id: 'small-business',
    name: 'Small Business Customer',
    colors: { mandatory: '#d93025', desired: '#f29900' },
    fields: [
      { name: 'customerName', label: 'Customer name', type: 'text' },
      { name: 'revenue', label: 'Annual revenue', type: 'number' },
      { name: 'netIncome', label: 'Net income', type: 'number' },
      { name: 'cost', label: 'Annual cost', type: 'number' },
      { name: 'costComment', label: 'Cost comment', type: 'text' },
    ],
    rules: [
      {
        id: 'R001',
        type: 'mandatory',
        formula: 'isBlank(customerName)',
        description: 'Customer name is required.',
        highlight: ['customerName'],
      },
      {
        id: 'R002',
        type: 'mandatory',
        formula: 'isBlank(revenue) || revenue < 50000',
        description: 'Revenue should be at least 50,000.',
        highlight: ['revenue'],
      },
      {
        id: 'R003',
        type: 'desired',
        formula: 'cost > 100000 && isBlank(costComment)',
        description: 'Costs above 100,000 need a comment explaining why.',
        highlight: ['costComment'],
      },
      {
        id: 'R004',
        type: 'desired',
        formula: 'isBlank(netIncome)',
        description: 'Net income is recommended.',
        highlight: ['netIncome'],
      },
    ],
  };
}

export function sampleCustomers() {
  return {
    'C-1001': {
      id: 'C-1001',
      templateId: 'small-business',
      record: { customerName: 'Alder Hardware', revenue: 120000, netIncome: 18000, cost: 80000, costComment: '' },
    },
    'C-1002': {
      id: 'C-1002',
      templateId: 'small-business',
      record: { customerName: 'Birch Bakery', revenue: 42000, netIncome: 5000, cost: 30000, costComment: '' },
    },
    'C-1003': {
      id: 'C-1003',
      templateId: 'small-business',
      record: { customerName: 'Cedar Logistics', revenue: 900000, netIncome: 61000, cost: 150000, costComment: '' },
    },
    'C-1004': {
      id: 'C-1004',
      templateId: 'small-business',
      record: { customerName: 'Dune Design', revenue: 35000, netIncome: '', cost: 120000, costComment: '' },
    },
  };
}
