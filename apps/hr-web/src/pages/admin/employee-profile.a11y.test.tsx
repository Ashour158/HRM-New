import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEmployeeProfile } from './employee-profile';

const apiClientGetMock = vi.hoisted(() => vi.fn());
const workerId = '00000000-0000-4000-8000-000000000901';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: apiClientGetMock,
    post: vi.fn(),
  },
}));

vi.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: { addNotification: () => void }) => unknown) => selector({ addNotification: vi.fn() }),
}));

const profile = {
  worker: {
    id: workerId,
    employeeId: 'EMP-001',
    firstName: 'Amina',
    lastName: 'Khalil',
    email: 'amina.khalil@example.com',
    hireDate: '2025-01-15',
    status: 'ACTIVE',
    jobTitle: 'HR Business Partner',
    departmentName: 'People Operations',
    managerName: 'Sara Ahmed',
    legalEntityName: 'Acme Health LLC',
  },
  basic: {
    dateOfBirth: '1990-04-02',
    gender: 'FEMALE',
    personalEmail: 'amina.personal@example.com',
    workEmail: 'amina.khalil@example.com',
    phoneNumber: '+201000000000',
    workPhoneNumber: '+201000000001',
  },
  contact: {
    address: { line1: 'Nile Corniche', city: 'Cairo', country: 'Egypt' },
    workLocation: { name: 'Cairo HQ', city: 'Cairo' },
    socialLinks: { linkedIn: 'https://linkedin.com/in/amina' },
    departmentName: 'People Operations',
    dottedLineManagerId: '',
    hrbpId: '',
    mentorId: '',
    colleagueIds: [],
  },
  emergencyContact: {
    emergencyContact: { name: 'Youssef Khalil', relationship: 'Spouse', phoneNumber: '+201000000002' },
    emergencyContacts: [],
  },
  background: {
    education: [],
    experience: [],
    certifications: [],
  },
  compensation: {
    grossSalaryAmount: 45000,
    taxAmount: 4500,
    insuranceAmount: 900,
    netSalaryAmount: 39600,
    salaryCurrency: 'EGP',
    salaryBasis: 'MONTHLY',
    payFrequency: 'MONTHLY',
  },
  documents: {
    documents: [],
  },
  workAuthorization: {
    workAuthorization: { countryCode: 'EG', status: 'CITIZEN' },
  },
  tax: {
    taxProfile: { taxIdentifier: '123-456-789' },
  },
  banking: {
    bankAccount: { bankName: 'National Bank', accountHolderName: 'Amina Khalil' },
  },
  dependents: {
    dependents: [],
    beneficiaries: [],
  },
  assetAccess: {
    assets: [],
    accessBadges: [],
  },
  skills: {
    skills: [],
    licenses: [],
  },
  consents: {
    consents: [],
    privacyNotices: [],
    retentionHolds: [],
  },
  governance: {
    dataClassification: 'RESTRICTED',
    personalDataRecords: [
      { id: '1', dataCategory: 'Identity', dataClassification: 'RESTRICTED', consentStatus: 'GRANTED', state: 'ACTIVE' },
    ],
  },
};

function apiResponse(data: unknown) {
  return Promise.resolve({ data: { success: true, data } });
}

function renderProfile() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/employees/${workerId}`]}>
        <Routes>
          <Route path="/admin/employees/:id" element={<AdminEmployeeProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminEmployeeProfile accessibility', () => {
  beforeEach(() => {
    apiClientGetMock.mockReset();
    apiClientGetMock.mockImplementation((url: string) => {
      if (url === `/hr/core/workers/${workerId}/profile`) return apiResponse(profile);
      if (url === `/hr/core/workers/${workerId}/master-profile`) return apiResponse({});
      if (url === '/admin/hcm-setup') return apiResponse({ fieldRules: [] });
      if (url === '/policy/allowed-actions') return apiResponse([]);
      if (url === '/audit') return apiResponse([]);
      return apiResponse([]);
    });
  });

  it('renders without accessibility violations', async () => {
    const { container } = renderProfile();

    expect(await screen.findByRole('heading', { level: 2, name: 'Amina Khalil' })).toBeInTheDocument();
    await waitFor(() => expect(apiClientGetMock).toHaveBeenCalledWith(`/hr/core/workers/${workerId}/profile`));
    await expect(axe(container)).resolves.toHaveNoViolations();
  });
});
