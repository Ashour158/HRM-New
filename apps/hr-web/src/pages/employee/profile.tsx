
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldMask } from '@/components/common/field-mask';
import { AuditTrail } from '@/components/common/audit-trail';
import { AllowedActions } from '@/components/common/allowed-actions';
import { useFieldAccess } from '@/hooks/use-field-access';
import { formatDate } from '@/lib/utils';
import { User, MapPin, Building, FileText } from 'lucide-react';

interface EmployeeProfileData {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  ssn?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  hireDate: string;
  employmentType: string;
  status: string;
  department: string;
  jobTitle: string;
  manager: string;
  legalEntity: string;
  documents: Array<{ id: string; name: string; type: string; uploadedAt: string }>;
}

function ProfileField({
  label,
  value,
  fieldPath,
  resourceId,
}: {
  label: string;
  value: string | undefined;
  fieldPath: string;
  resourceId: string;
}) {
  const { data: fieldAccess, isLoading } = useFieldAccess(fieldPath, 'WORKER', resourceId);

  if (isLoading) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <FieldMask
        value={value}
        decision={fieldAccess?.decision || 'VISIBLE'}
        maskingRule={fieldAccess?.maskingRule}
        reason={fieldAccess?.reason}
      />
    </div>
  );
}

/**
 * Employee profile page with personal info, employment details, and documents.
 * Field-level access policies are applied to sensitive fields.
 */
const DEMO_PROFILE: EmployeeProfileData = {
  id: '00000000-0000-0000-0000-000000000000',
  employeeId: 'DEMO-001',
  firstName: 'Demo',
  lastName: 'User',
  email: 'demo.user@example.com',
  phone: '+1-555-0100',
  dateOfBirth: '1990-01-01',
  ssn: '123-45-6789',
  address: {
    street: '123 Innovation Dr',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'US',
  },
  hireDate: '2023-01-15',
  employmentType: 'FULL_TIME',
  status: 'ACTIVE',
  department: 'Engineering',
  jobTitle: 'Senior Software Engineer',
  manager: 'Alice Manager',
  legalEntity: 'Acme Corp US',
  documents: [],
};

export function EmployeeProfile() {
  const { data: profile, isLoading, error } = useApiQuery<EmployeeProfileData>(
    ['employee-profile'],
    '/employee/profile'
  );

  const displayProfile = profile ?? DEMO_PROFILE;
  const isDemo = !profile || !!error;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!displayProfile) {
    return <div className="p-4 text-muted-foreground">Profile not found</div>;
  }

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 text-sm">
          <strong>Development Mode:</strong> Showing demo profile data because <code>/employee/profile</code> is not yet wired to an authenticated user endpoint. Create an employee in the Admin Employees page to see real data.
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {displayProfile.firstName} {displayProfile.lastName}
          </h2>
          <p className="text-muted-foreground">{displayProfile.jobTitle} • {displayProfile.department}</p>
        </div>
        <AllowedActions
          aggregateType="WORKER"
          aggregateId={displayProfile.id}
          onAction={(action) => console.log('Action:', action)}
        />
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="personal">Personal Information</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Your personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <ProfileField
                  label="First Name"
                  value={displayProfile.firstName}
                  fieldPath="worker.personal.firstName"
                  resourceId={displayProfile.id}
                />
                <ProfileField
                  label="Last Name"
                  value={displayProfile.lastName}
                  fieldPath="worker.personal.lastName"
                  resourceId={displayProfile.id}
                />
                <ProfileField
                  label="Email"
                  value={displayProfile.email}
                  fieldPath="worker.personal.email"
                  resourceId={displayProfile.id}
                />
                <ProfileField
                  label="Phone"
                  value={displayProfile.phone}
                  fieldPath="worker.personal.phone"
                  resourceId={displayProfile.id}
                />
                <ProfileField
                  label="Date of Birth"
                  value={formatDate(displayProfile.dateOfBirth)}
                  fieldPath="worker.personal.dateOfBirth"
                  resourceId={displayProfile.id}
                />
                <ProfileField
                  label="SSN"
                  value={displayProfile.ssn}
                  fieldPath="worker.personal.ssn"
                  resourceId={displayProfile.id}
                />
              </div>

              {displayProfile.address && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Address
                  </p>
                  <p className="text-sm">
                    {displayProfile.address.street}, {displayProfile.address.city}, {displayProfile.address.state}{' '}
                    {displayProfile.address.zip}, {displayProfile.address.country}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Employment Details
              </CardTitle>
              <CardDescription>Your employment and job information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Employee ID</p>
                  <p className="text-sm font-medium">{displayProfile.employeeId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Hire Date</p>
                  <p className="text-sm font-medium">{formatDate(displayProfile.hireDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Employment Type</p>
                  <p className="text-sm font-medium">{displayProfile.employmentType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="text-sm font-medium">{displayProfile.status}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="text-sm font-medium">{displayProfile.department}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Job Title</p>
                  <p className="text-sm font-medium">{displayProfile.jobTitle}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Manager</p>
                  <p className="text-sm font-medium">{displayProfile.manager}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Legal Entity</p>
                  <p className="text-sm font-medium">{displayProfile.legalEntity}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documents
              </CardTitle>
              <CardDescription>Your uploaded documents and files</CardDescription>
            </CardHeader>
            <CardContent>
              {displayProfile.documents && displayProfile.documents.length > 0 ? (
                <div className="space-y-3">
                  {displayProfile.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.type} • Uploaded {formatDate(doc.uploadedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No documents uploaded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Trail</CardTitle>
              <CardDescription>Activity log for your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTrail resourceType="WORKER" resourceId={displayProfile.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
