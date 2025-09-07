export interface Customer {
  id: string
  type: 'individual' | 'company' | 'walk-in'
  name: string
  email: string
  phone: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
  // Individual customer fields
  dateOfBirth?: string
  gender?: 'male' | 'female' | 'other'
  // Company customer fields
  companyName?: string
  contactPerson?: string
  taxId?: string
  industry?: string
  employeeCount?: string
  // Common fields
  loyaltyPoints: number
  totalSpent: number
  totalOrders: number
  preferredPaymentMethod: 'cash' | 'card' | 'mobile' | 'loyalty'
  notes?: string
  tags: string[]
  status: 'active' | 'inactive' | 'vip'
  createdAt: string
  lastVisit?: string
  avatar?: string
  // Additional fields for ERPNext integration
  defaultCurrency?: string
  companyCurrency?: string
}

export const mockCustomers: Customer[] = [
  // Walk-in Customer (special customer)
  {
    id: "WALK-IN",
    type: "walk-in",
    name: "Walk-In Customer",
    email: "walkin@pos.local",
    phone: "N/A",
    address: {
      street: "Point of Sale",
      city: "Dubai",
      state: "Dubai",
      zipCode: "00000",
      country: "UAE"
    },
    loyaltyPoints: 0,
    totalSpent: 0,
    totalOrders: 0,
    preferredPaymentMethod: "cash",
    notes: "Default walk-in customer for cash transactions",
    tags: ["Walk-In", "Default"],
    status: "active",
    createdAt: "2020-01-01T00:00:00Z"
  },
  // Individual Customers
  {
    id: "CUST001",
    type: "individual",
    name: "Ahmed Al-Rashid",
    email: "ahmed.rashid@email.com",
    phone: "+971-50-123-4567",
    address: {
      street: "123 Sheikh Zayed Road",
      city: "Dubai",
      state: "Dubai",
      zipCode: "12345",
      country: "UAE"
    },
    dateOfBirth: "1985-03-15",
    gender: "male",
    loyaltyPoints: 2450,
    totalSpent: 3250.50,
    totalOrders: 45,
    preferredPaymentMethod: "card",
    notes: "Regular customer, prefers Arabic coffee",
    tags: ["VIP", "Regular"],
    status: "vip",
    createdAt: "2023-01-15T10:30:00Z",
    lastVisit: "2024-12-20T14:22:00Z"
  },
  {
    id: "CUST002",
    type: "individual",
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "+971-55-987-6543",
    address: {
      street: "456 Jumeirah Beach Road",
      city: "Dubai",
      state: "Dubai",
      zipCode: "54321",
      country: "UAE"
    },
    dateOfBirth: "1992-07-22",
    gender: "female",
    loyaltyPoints: 1850,
    totalSpent: 2100.75,
    totalOrders: 32,
    preferredPaymentMethod: "mobile",
    notes: "Lactose intolerant, prefers oat milk",
    tags: ["Health-conscious", "Mobile Pay"],
    status: "active",
    createdAt: "2023-02-10T09:15:00Z",
    lastVisit: "2024-12-19T16:45:00Z"
  },
  // Company Customer
  {
    id: "COMP001",
    type: "company",
    name: "Emirates Business Solutions",
    companyName: "Emirates Business Solutions LLC",
    contactPerson: "Mohammed Hassan",
    email: "mohammed.hassan@ebs.ae",
    phone: "+971-56-234-5678",
    address: {
      street: "789 Al Wasl Road",
      city: "Dubai",
      state: "Dubai",
      zipCode: "67890",
      country: "UAE"
    },
    taxId: "100123456700003",
    industry: "Consulting",
    employeeCount: "50-100",
    loyaltyPoints: 3200,
    totalSpent: 4890.25,
    totalOrders: 67,
    preferredPaymentMethod: "card",
    notes: "Business owner, often orders for office meetings",
    tags: ["Business", "Bulk Orders", "Corporate"],
    status: "vip",
    createdAt: "2022-11-20T11:45:00Z",
    lastVisit: "2024-12-21T09:30:00Z"
  },
  {
    id: "CUST004",
    type: "individual",
    name: "Emily Chen",
    email: "emily.chen@email.com",
    phone: "+971-52-345-6789",
    address: {
      street: "321 Downtown Boulevard",
      city: "Dubai",
      state: "Dubai",
      zipCode: "13579",
      country: "UAE"
    },
    dateOfBirth: "1990-09-18",
    gender: "female",
    loyaltyPoints: 890,
    totalSpent: 1245.30,
    totalOrders: 18,
    preferredPaymentMethod: "card",
    tags: ["Student", "Evening Customer"],
    status: "active",
    createdAt: "2024-05-12T13:20:00Z",
    lastVisit: "2024-12-18T19:15:00Z"
  },
  {
    id: "CUST005",
    type: "individual",
    name: "Omar Al-Mansoori",
    email: "omar.mansoori@email.com",
    phone: "+971-50-456-7890",
    address: {
      street: "654 Marina Walk",
      city: "Dubai",
      state: "Dubai",
      zipCode: "24680",
      country: "UAE"
    },
    dateOfBirth: "1987-04-30",
    gender: "male",
    loyaltyPoints: 1560,
    totalSpent: 2340.80,
    totalOrders: 29,
    preferredPaymentMethod: "loyalty",
    notes: "Loves trying new menu items",
    tags: ["Adventurous", "Loyalty Member"],
    status: "active",
    createdAt: "2023-08-07T14:10:00Z",
    lastVisit: "2024-12-17T12:30:00Z"
  },
  // Company Customer
  {
    id: "COMP002",
    type: "company",
    name: "Al-Zahra Marketing Agency",
    companyName: "Al-Zahra Marketing Agency LLC",
    contactPerson: "Fatima Al-Zahra",
    email: "fatima@alzahra-marketing.ae",
    phone: "+971-55-567-8901",
    address: {
      street: "987 Business Bay",
      city: "Dubai",
      state: "Dubai",
      zipCode: "35791",
      country: "UAE"
    },
    taxId: "100456789000003",
    industry: "Marketing & Advertising",
    employeeCount: "20-50",
    loyaltyPoints: 2100,
    totalSpent: 2890.45,
    totalOrders: 38,
    preferredPaymentMethod: "mobile",
    tags: ["Tech Professional", "Weekend Regular", "Marketing Agency"],
    status: "active",
    createdAt: "2023-03-25T16:45:00Z",
    lastVisit: "2024-12-16T10:20:00Z"
  },
  {
    id: "CUST007",
    type: "individual",
    name: "David Rodriguez",
    email: "david.rodriguez@email.com",
    phone: "+971-56-678-9012",
    address: {
      street: "147 Palm Jumeirah",
      city: "Dubai",
      state: "Dubai",
      zipCode: "46802",
      country: "UAE"
    },
    dateOfBirth: "1983-06-25",
    gender: "male",
    loyaltyPoints: 760,
    totalSpent: 980.60,
    totalOrders: 12,
    preferredPaymentMethod: "card",
    tags: ["Tourist", "Occasional"],
    status: "active",
    createdAt: "2024-09-15T08:30:00Z",
    lastVisit: "2024-12-15T15:45:00Z"
  },
  {
    id: "CUST008",
    type: "individual",
    name: "Aisha Mahmoud",
    email: "aisha.mahmoud@email.com",
    phone: "+971-52-789-0123",
    address: {
      street: "258 Deira City Centre",
      city: "Dubai",
      state: "Dubai",
      zipCode: "57913",
      country: "UAE"
    },
    dateOfBirth: "1991-01-08",
    gender: "female",
    loyaltyPoints: 1340,
    totalSpent: 1890.20,
    totalOrders: 24,
    preferredPaymentMethod: "cash",
    notes: "Prefers traditional Arabic sweets",
    tags: ["Traditional", "Cash Preferred"],
    status: "active",
    createdAt: "2023-12-03T12:15:00Z",
    lastVisit: "2024-12-14T13:50:00Z"
  },
  // Company Customer
  {
    id: "COMP003",
    type: "company",
    name: "Wilson Executive Services",
    companyName: "Wilson Executive Services Ltd",
    contactPerson: "James Wilson",
    email: "james@wilson-exec.com",
    phone: "+971-50-890-1234",
    address: {
      street: "369 JLT Cluster A",
      city: "Dubai",
      state: "Dubai",
      zipCode: "68024",
      country: "UAE"
    },
    taxId: "100789123000003",
    industry: "Executive Services",
    employeeCount: "100+",
    loyaltyPoints: 4200,
    totalSpent: 6780.90,
    totalOrders: 89,
    preferredPaymentMethod: "card",
    notes: "Executive customer, large orders for meetings and events",
    tags: ["Executive", "Corporate", "High Value", "Events"],
    status: "vip",
    createdAt: "2022-07-18T09:45:00Z",
    lastVisit: "2024-12-21T11:15:00Z"
  },
  {
    id: "CUST010",
    type: "individual",
    name: "Layla Abdulla",
    email: "layla.abdulla@email.com",
    phone: "+971-55-901-2345",
    address: {
      street: "741 Al Barsha",
      city: "Dubai",
      state: "Dubai",
      zipCode: "79135",
      country: "UAE"
    },
    dateOfBirth: "1986-08-03",
    gender: "female",
    loyaltyPoints: 1680,
    totalSpent: 2340.15,
    totalOrders: 31,
    preferredPaymentMethod: "mobile",
    tags: ["Family Customer", "Weekend Visits"],
    status: "active",
    createdAt: "2023-06-12T15:30:00Z",
    lastVisit: "2024-12-13T17:20:00Z"
  },
  {
    id: "CUST011",
    type: "individual",
    name: "Roberto Silva",
    email: "roberto.silva@email.com",
    phone: "+971-56-012-3456",
    address: {
      street: "852 Motor City",
      city: "Dubai",
      state: "Dubai",
      zipCode: "80246",
      country: "UAE"
    },
    dateOfBirth: "1994-05-20",
    gender: "male",
    loyaltyPoints: 520,
    totalSpent: 745.85,
    totalOrders: 9,
    preferredPaymentMethod: "card",
    tags: ["New Customer", "Sports Fan"],
    status: "active",
    createdAt: "2024-11-08T10:25:00Z",
    lastVisit: "2024-12-12T14:35:00Z"
  },
  {
    id: "CUST012",
    type: "individual",
    name: "Priya Sharma",
    email: "priya.sharma@email.com",
    phone: "+971-52-123-4567",
    address: {
      street: "963 International City",
      city: "Dubai",
      state: "Dubai",
      zipCode: "91357",
      country: "UAE"
    },
    dateOfBirth: "1993-02-28",
    gender: "female",
    loyaltyPoints: 980,
    totalSpent: 1456.70,
    totalOrders: 19,
    preferredPaymentMethod: "mobile",
    notes: "Vegetarian, loves chai",
    tags: ["Vegetarian", "Chai Lover"],
    status: "active",
    createdAt: "2024-04-20T11:40:00Z",
    lastVisit: "2024-12-11T16:25:00Z"
  },
  // Company Customer
  {
    id: "COMP004",
    type: "company",
    name: "Al-Dubai Holdings",
    companyName: "Al-Dubai Holdings LLC",
    contactPerson: "Hassan Al-Dubai",
    email: "hassan@aldubaiholdings.ae",
    phone: "+971-50-234-5678",
    address: {
      street: "159 Dubai Marina",
      city: "Dubai",
      state: "Dubai",
      zipCode: "02468",
      country: "UAE"
    },
    taxId: "100987654000003",
    industry: "Real Estate & Investment",
    employeeCount: "100+",
    loyaltyPoints: 2890,
    totalSpent: 4210.35,
    totalOrders: 56,
    preferredPaymentMethod: "loyalty",
    notes: "Local business owner, community leader, real estate investments",
    tags: ["Community Leader", "Local Business", "Real Estate", "Investment"],
    status: "vip",
    createdAt: "2022-09-30T13:55:00Z",
    lastVisit: "2024-12-20T09:45:00Z"
  },
  {
    id: "CUST014",
    type: "individual",
    name: "Sophie Martin",
    email: "sophie.martin@email.com",
    phone: "+971-55-345-6789",
    address: {
      street: "753 The Gardens",
      city: "Dubai",
      state: "Dubai",
      zipCode: "13579",
      country: "UAE"
    },
    dateOfBirth: "1996-07-09",
    gender: "female",
    loyaltyPoints: 650,
    totalSpent: 890.25,
    totalOrders: 11,
    preferredPaymentMethod: "card",
    tags: ["Student", "Art Lover"],
    status: "active",
    createdAt: "2024-08-14T14:20:00Z",
    lastVisit: "2024-12-10T18:30:00Z"
  },
  {
    id: "CUST015",
    type: "individual",
    name: "Khalid Al-Shamsi",
    email: "khalid.shamsi@email.com",
    phone: "+971-56-456-7890",
    address: {
      street: "486 Emirates Hills",
      city: "Dubai",
      state: "Dubai",
      zipCode: "24680",
      country: "UAE"
    },
    dateOfBirth: "1975-11-30",
    gender: "male",
    loyaltyPoints: 5200,
    totalSpent: 8950.80,
    totalOrders: 112,
    preferredPaymentMethod: "card",
    notes: "Premium customer, hosts business events",
    tags: ["Premium", "Business Events", "High Spender"],
    status: "vip",
    createdAt: "2021-12-05T10:15:00Z",
    lastVisit: "2024-12-21T12:40:00Z"
  },
  {
    id: "CUST016",
    type: "individual",
    name: "Maria Gonzalez",
    email: "maria.gonzalez@email.com",
    phone: "+971-52-567-8901",
    address: {
      street: "597 Discovery Gardens",
      city: "Dubai",
      state: "Dubai",
      zipCode: "35791",
      country: "UAE"
    },
    dateOfBirth: "1988-04-12",
    gender: "female",
    loyaltyPoints: 1120,
    totalSpent: 1650.40,
    totalOrders: 21,
    preferredPaymentMethod: "mobile",
    tags: ["Language Teacher", "Cultural Events"],
    status: "active",
    createdAt: "2023-10-22T16:10:00Z",
    lastVisit: "2024-12-09T13:15:00Z"
  },
  {
    id: "CUST017",
    type: "individual",
    name: "Ali Al-Mansouri",
    email: "ali.mansouri@email.com",
    phone: "+971-50-678-9012",
    address: {
      street: "208 Bur Dubai",
      city: "Dubai",
      state: "Dubai",
      zipCode: "46802",
      country: "UAE"
    },
    dateOfBirth: "1982-09-05",
    gender: "male",
    loyaltyPoints: 1780,
    totalSpent: 2560.15,
    totalOrders: 35,
    preferredPaymentMethod: "cash",
    notes: "Traditional customer, loves Arabic coffee",
    tags: ["Traditional", "Heritage Lover"],
    status: "active",
    createdAt: "2023-01-28T09:30:00Z",
    lastVisit: "2024-12-08T15:50:00Z"
  },
  {
    id: "CUST018",
    type: "individual",
    name: "Lisa Thompson",
    email: "lisa.thompson@email.com",
    phone: "+971-55-789-0123",
    address: {
      street: "319 Arabian Ranches",
      city: "Dubai",
      state: "Dubai",
      zipCode: "57913",
      country: "UAE"
    },
    dateOfBirth: "1991-06-18",
    gender: "female",
    loyaltyPoints: 340,
    totalSpent: 520.90,
    totalOrders: 6,
    preferredPaymentMethod: "card",
    tags: ["New Resident", "Health Conscious"],
    status: "active",
    createdAt: "2024-10-05T12:45:00Z",
    lastVisit: "2024-12-07T11:20:00Z"
  },
  {
    id: "CUST019",
    type: "individual",
    name: "Youssef Ibrahim",
    email: "youssef.ibrahim@email.com",
    phone: "+971-56-890-1234",
    address: {
      street: "430 Al Mizhar",
      city: "Dubai",
      state: "Dubai",
      zipCode: "68024",
      country: "UAE"
    },
    dateOfBirth: "1984-01-22",
    gender: "male",
    loyaltyPoints: 2350,
    totalSpent: 3480.65,
    totalOrders: 47,
    preferredPaymentMethod: "loyalty",
    notes: "Engineer, precise with orders",
    tags: ["Engineer", "Detail-Oriented"],
    status: "active",
    createdAt: "2022-12-18T14:35:00Z",
    lastVisit: "2024-12-06T17:10:00Z"
  },
  {
    id: "CUST020",
    type: "individual",
    name: "Nadia Al-Rashid",
    email: "nadia.rashid@email.com",
    phone: "+971-52-901-2345",
    address: {
      street: "541 Mirdif",
      city: "Dubai",
      state: "Dubai",
      zipCode: "79135",
      country: "UAE"
    },
    dateOfBirth: "1989-08-16",
    gender: "female",
    loyaltyPoints: 1460,
    totalSpent: 2120.30,
    totalOrders: 28,
    preferredPaymentMethod: "mobile",
    tags: ["Doctor", "Healthcare Professional"],
    status: "active",
    createdAt: "2023-07-14T11:25:00Z",
    lastVisit: "2024-12-05T08:45:00Z"
  },
  // Company Customer
  {
    id: "COMP005",
    type: "company",
    name: "TechFlow Solutions",
    companyName: "TechFlow Solutions LLC",
    contactPerson: "Michael Brown",
    email: "michael@techflow.ae",
    phone: "+971-50-012-3456",
    address: {
      street: "652 Silicon Oasis",
      city: "Dubai",
      state: "Dubai",
      zipCode: "80246",
      country: "UAE"
    },
    taxId: "100111222000003",
    industry: "Technology & Software",
    employeeCount: "20-50",
    loyaltyPoints: 890,
    totalSpent: 1340.75,
    totalOrders: 16,
    preferredPaymentMethod: "card",
    tags: ["Tech Professional", "Gadget Lover", "Software Company"],
    status: "active",
    createdAt: "2024-06-30T15:20:00Z",
    lastVisit: "2024-12-04T19:30:00Z"
  },
  // Company Customer
  {
    id: "COMP006",
    type: "company",
    name: "Maktoum Fashion House",
    companyName: "Maktoum Fashion House LLC",
    contactPerson: "Zara Al-Maktoum",
    email: "zara@maktoomfashion.ae",
    phone: "+971-55-123-4567",
    address: {
      street: "763 Al Safa",
      city: "Dubai",
      state: "Dubai",
      zipCode: "91357",
      country: "UAE"
    },
    taxId: "100333444000003",
    industry: "Fashion & Design",
    employeeCount: "10-20",
    loyaltyPoints: 3100,
    totalSpent: 4670.20,
    totalOrders: 62,
    preferredPaymentMethod: "card",
    notes: "Fashion designer, aesthetic preferences, luxury brand",
    tags: ["Fashion Designer", "Aesthetic", "Creative", "Luxury Brand"],
    status: "vip",
    createdAt: "2022-08-22T13:40:00Z",
    lastVisit: "2024-12-21T14:25:00Z"
  },
  {
    id: "CUST023",
    type: "individual",
    name: "Andrew Davis",
    email: "andrew.davis@email.com",
    phone: "+971-56-234-5678",
    address: {
      street: "874 Dubai Sports City",
      city: "Dubai",
      state: "Dubai",
      zipCode: "02468",
      country: "UAE"
    },
    dateOfBirth: "1990-10-07",
    gender: "male",
    loyaltyPoints: 720,
    totalSpent: 1080.45,
    totalOrders: 13,
    preferredPaymentMethod: "mobile",
    tags: ["Sports Coach", "Fitness Enthusiast"],
    status: "active",
    createdAt: "2024-07-19T10:55:00Z",
    lastVisit: "2024-12-03T16:40:00Z"
  },
  {
    id: "CUST024",
    type: "individual",
    name: "Samira Hassan",
    email: "samira.hassan@email.com",
    phone: "+971-52-345-6789",
    address: {
      street: "985 Jumeirah Village Circle",
      city: "Dubai",
      state: "Dubai",
      zipCode: "13579",
      country: "UAE"
    },
    dateOfBirth: "1985-05-31",
    gender: "female",
    loyaltyPoints: 2020,
    totalSpent: 2890.85,
    totalOrders: 39,
    preferredPaymentMethod: "loyalty",
    notes: "Nutritionist, health-focused orders",
    tags: ["Nutritionist", "Health Expert"],
    status: "active",
    createdAt: "2023-04-16T12:10:00Z",
    lastVisit: "2024-12-02T09:15:00Z"
  },
  {
    id: "CUST025",
    type: "individual",
    name: "Ryan O'Connor",
    email: "ryan.oconnor@email.com",
    phone: "+971-50-456-7890",
    address: {
      street: "096 The Greens",
      city: "Dubai",
      state: "Dubai",
      zipCode: "24680",
      country: "UAE"
    },
    dateOfBirth: "1986-09-24",
    gender: "male",
    loyaltyPoints: 1250,
    totalSpent: 1890.60,
    totalOrders: 25,
    preferredPaymentMethod: "card",
    tags: ["Photographer", "Creative Professional"],
    status: "active",
    createdAt: "2023-11-11T14:45:00Z",
    lastVisit: "2024-12-01T12:55:00Z"
  }
]

export const getCustomerById = (id: string): Customer | undefined => {
  return mockCustomers.find(customer => customer.id === id)
}

export const getCustomersByStatus = (status: Customer['status']): Customer[] => {
  return mockCustomers.filter(customer => customer.status === status)
}

export const searchCustomers = (query: string): Customer[] => {
  const lowercaseQuery = query.toLowerCase()
  return mockCustomers.filter(customer =>
    customer.name.toLowerCase().includes(lowercaseQuery) ||
    customer.email.toLowerCase().includes(lowercaseQuery) ||
    customer.phone.includes(query) ||
    customer.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  )
}
