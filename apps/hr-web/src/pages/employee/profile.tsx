
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldMask } from '@/components/common/field-mask';
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
  address?: string;
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

export function EmployeeProfile() {
  const { data: profile, isLoading, error } = useApiQuery<EmployeeProfileData>(
    ['employee-profile'],
    '/employee/profile'
  );

  const displayProfile = profile;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error || !displayProfile) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Employee profile could not be loaded. Make sure the authenticated user is linked to a worker record.
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        />
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="personal">Personal Information</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
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
                  <p className="text-sm">{displayProfile.address}</p>
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

      </Tabs>
    </div>
  );
}
