
import * as React from 'react';
import { useApiMutation, useApiQuery } from '@/hooks/use-api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldMask } from '@/components/common/field-mask';
import { AllowedActions } from '@/components/common/allowed-actions';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useFieldAccess } from '@/hooks/use-field-access';
import { useUIStore } from '@/stores/ui-store';
import { formatDate } from '@/lib/utils';
import { User, MapPin, Building, FileText, MessageSquare, Star, Target, TrendingUp } from 'lucide-react';

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

interface EmployeeProfilePerformance {
  actionPlan?: {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    currentPerformance?: {
      latestRating: number | null;
      averageGoalProgress: number;
      peerAverageRating: number | null;
      activeGoalCount: number;
      openDevelopmentPlan: boolean;
    };
    progressTrend?: string;
    checkInCadence?: string;
    recommendedActions?: string[];
  };
  feedbackSummary?: {
    averageRating: number | null;
    responseCount: number;
    anonymousResponseCount: number;
    conciseFeedback: string;
    dimensionAverages?: Record<string, number>;
  };
  nineBox?: {
    performanceScore: number;
    potentialScore: number;
    performanceBand: string;
    potentialBand: string;
    box: string;
  };
  goals?: {
    total: number;
    active: number;
    achieved: number;
    atRisk: number;
    averageProgress: number;
  };
}

interface OpenProfileChangeCasePayload {
  caseType: string;
  priority: string;
  description: string;
}

interface OpenProfileChangeCaseResponse {
  caseNumber?: string;
}

const profileChangeOptions = [
  { value: 'PHONE', label: 'Phone' },
  { value: 'ADDRESS', label: 'Address' },
  { value: 'PERSONAL_DATA', label: 'Personal data' },
  { value: 'DOCUMENT', label: 'Document' },
  { value: 'EMERGENCY_CONTACT', label: 'Emergency contact' },
];

const documentRequestOptions = [
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'WORK_PERMIT', label: 'Work permit' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'MEDICAL_FITNESS', label: 'Medical fitness' },
  { value: 'INSURANCE_CARD', label: 'Insurance card' },
  { value: 'OTHER', label: 'Other document' },
];

function formatScore(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined || Number.isNaN(value) ? '-' : `${Math.round(value * 10) / 10}${suffix}`;
}

function performanceRiskVariant(riskLevel?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (riskLevel === 'HIGH') return 'destructive';
  if (riskLevel === 'MEDIUM') return 'secondary';
  if (riskLevel === 'LOW') return 'default';
  return 'outline';
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
  const addNotification = useUIStore((s) => s.addNotification);
  const [profileChangeType, setProfileChangeType] = React.useState(profileChangeOptions[0].value);
  const [profileChangeDetails, setProfileChangeDetails] = React.useState('');
  const [documentRequestType, setDocumentRequestType] = React.useState(documentRequestOptions[0].value);
  const [documentRequestDetails, setDocumentRequestDetails] = React.useState('');
  const { data: profile, isLoading, error, refetch } = useApiQuery<EmployeeProfileData>(
    ['employee-profile'],
    '/employee/profile'
  );
  const profileId = profile?.id ?? '';
  const {
    data: performanceImpact,
    isLoading: isPerformanceLoading,
    error: performanceError,
    refetch: refetchPerformance,
  } = useApiQuery<EmployeeProfilePerformance>(
    ['employee-profile-performance', profileId],
    `/performance/action-plans/worker/${profileId}`,
    { enabled: Boolean(profileId) },
  );

  const displayProfile = profile;
  const profileChangeMutation = useApiMutation<OpenProfileChangeCaseResponse, OpenProfileChangeCasePayload>(
    '/hr-service-delivery/cases',
    'post',
    [['employee-services-cases']],
  );
  const selectedChangeLabel = profileChangeOptions.find((option) => option.value === profileChangeType)?.label ?? 'Profile';
  const selectedDocumentLabel = documentRequestOptions.find((option) => option.value === documentRequestType)?.label ?? 'Document';
  const canSubmitProfileChange = profileChangeDetails.trim().length > 0 && !profileChangeMutation.isPending;
  const canSubmitDocumentRequest = documentRequestDetails.trim().length > 0 && !profileChangeMutation.isPending;

  const submitProfileChangeRequest = async () => {
    if (!displayProfile || !canSubmitProfileChange) return;
    const description = [
      `Profile change requested: ${selectedChangeLabel}`,
      `Employee: ${displayProfile.employeeId} - ${displayProfile.firstName} ${displayProfile.lastName}`,
      `Details: ${profileChangeDetails.trim()}`,
    ].join('\n');
    try {
      const result = await profileChangeMutation.mutateAsync({
        caseType: 'PROFILE_DATA_CHANGE',
        priority: 'MEDIUM',
        description,
      });
      setProfileChangeDetails('');
      addNotification({
        title: 'Profile change requested',
        message: result.caseNumber ? `Case ${result.caseNumber} was opened for HR review.` : 'Your request was sent to HR for review.',
        type: 'success',
        read: false,
      });
    } catch {
      addNotification({
        title: 'Could not request profile change',
        message: 'Please review the details and try again.',
        type: 'error',
        read: false,
      });
    }
  };

  const submitDocumentRequest = async () => {
    if (!displayProfile || !canSubmitDocumentRequest) return;
    const description = [
      `Document request: ${selectedDocumentLabel}`,
      `Employee: ${displayProfile.employeeId} - ${displayProfile.firstName} ${displayProfile.lastName}`,
      `Details: ${documentRequestDetails.trim()}`,
    ].join('\n');
    try {
      const result = await profileChangeMutation.mutateAsync({
        caseType: 'EMPLOYEE_DOCUMENT_UPDATE',
        priority: 'MEDIUM',
        description,
      });
      setDocumentRequestDetails('');
      addNotification({
        title: 'Document request submitted',
        message: result.caseNumber ? `Case ${result.caseNumber} was opened for HR review.` : 'Your document request was sent to HR.',
        type: 'success',
        read: false,
      });
    } catch {
      addNotification({
        title: 'Could not submit document request',
        message: 'Please review the details and try again.',
        type: 'error',
        read: false,
      });
    }
  };

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
      <div className="space-y-6">
        <ErrorState
          title="Profile could not be loaded"
          description="Make sure the authenticated user is linked to a worker record."
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="fusion-gradient-text text-2xl font-bold">
            {displayProfile.firstName} {displayProfile.lastName}
          </h2>
          <p className="text-slate-500">{displayProfile.jobTitle} • {displayProfile.department}</p>
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
          <TabsTrigger value="performance">Performance</TabsTrigger>
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="profile-change-type">What needs changing</Label>
                    <select
                      id="profile-change-type"
                      value={profileChangeType}
                      onChange={(event) => setProfileChangeType(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {profileChangeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-change-details">Details</Label>
                    <textarea
                      id="profile-change-details"
                      value={profileChangeDetails}
                      onChange={(event) => setProfileChangeDetails(event.target.value)}
                      rows={3}
                      placeholder="Tell HR what should be corrected or updated"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <Button type="button" disabled={!canSubmitProfileChange} onClick={submitProfileChangeRequest}>
                    {profileChangeMutation.isPending ? 'Submitting...' : 'Submit change request'}
                  </Button>
                </div>
              </div>
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

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Performance Impact
                  </CardTitle>
                  <CardDescription>Current goals, 360 feedback, and development signals.</CardDescription>
                </div>
                <Badge variant={performanceRiskVariant(performanceImpact?.actionPlan?.riskLevel)}>
                  {performanceImpact?.actionPlan?.riskLevel ? `${performanceImpact.actionPlan.riskLevel} risk` : 'No risk signal'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {isPerformanceLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
                </div>
              ) : performanceError ? (
                <ErrorState
                  title="Performance data could not be loaded"
                  description="Try again in a moment."
                  error={performanceError}
                  onRetry={() => refetchPerformance()}
                />
              ) : performanceImpact ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <TrendingUp className="h-4 w-4" />
                        Latest rating
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {formatScore(performanceImpact.actionPlan?.currentPerformance?.latestRating)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <Target className="h-4 w-4" />
                        Goals
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {formatScore(performanceImpact.goals?.averageProgress ?? performanceImpact.actionPlan?.currentPerformance?.averageGoalProgress, '%')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <MessageSquare className="h-4 w-4" />
                        360 feedback
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900">
                        {formatScore(performanceImpact.feedbackSummary?.averageRating ?? performanceImpact.actionPlan?.currentPerformance?.peerAverageRating)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{performanceImpact.feedbackSummary?.responseCount ?? 0} peer responses</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <Star className="h-4 w-4" />
                        Talent grid
                      </div>
                      <p className="mt-2 text-2xl font-bold text-slate-900">{performanceImpact.nineBox?.box ?? '-'}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatScore(performanceImpact.nineBox?.performanceScore, '%')} performance
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">360 feedback summary</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {performanceImpact.feedbackSummary?.conciseFeedback || 'No submitted feedback summary yet.'}
                      </p>
                      {performanceImpact.feedbackSummary?.dimensionAverages ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {Object.entries(performanceImpact.feedbackSummary.dimensionAverages).map(([dimension, score]) => (
                            <div key={dimension} className="rounded-xl bg-white px-3 py-2 text-sm">
                              <span className="font-medium capitalize text-slate-800">{dimension}</span>
                              <span className="float-right text-slate-600">{formatScore(score)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">Development rhythm</p>
                      <p className="mt-2 text-sm text-slate-600">{performanceImpact.actionPlan?.checkInCadence ?? 'Manager check-in cadence not set.'}</p>
                      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">Next focus</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {performanceImpact.actionPlan?.recommendedActions?.[0] ?? 'No action plan recommendation yet.'}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Star}
                  title="No performance signal yet"
                  description="Reviews, goals, and 360 feedback will appear here after the active performance cycle starts."
                />
              )}
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
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="document-request-type">Document type</Label>
                    <select
                      id="document-request-type"
                      value={documentRequestType}
                      onChange={(event) => setDocumentRequestType(event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      {documentRequestOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="document-request-details">Document details</Label>
                    <textarea
                      id="document-request-details"
                      value={documentRequestDetails}
                      onChange={(event) => setDocumentRequestDetails(event.target.value)}
                      rows={3}
                      placeholder="Tell HR what document should be added, renewed, or replaced"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <Button type="button" disabled={!canSubmitDocumentRequest} onClick={submitDocumentRequest}>
                    {profileChangeMutation.isPending ? 'Submitting...' : 'Submit document request'}
                  </Button>
                </div>
              </div>
              {displayProfile.documents && displayProfile.documents.length > 0 ? (
                <div className="space-y-3">
                  {displayProfile.documents.map((doc) => (
                    <div key={doc.id} className="fusion-glass fusion-hover flex items-center justify-between rounded-2xl p-3">
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
                <EmptyState
                  icon={FileText}
                  title="No documents uploaded"
                  description="Documents and files shared with you will appear here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
