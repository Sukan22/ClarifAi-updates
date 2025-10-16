'use client';
import * as React from 'react';
import UploadTab from './UplodeTab';
import ClassifierTab from './ClassifierTab';
import ValidatorTab from './ValidatorTab';
import UserStoriesTab from './UserStoriesTab';
import GherkinTab from './GherkinTab';
import TestCasesTab from './TestCasesTab';
import TraceabilityTab from './TraceabilityTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Check, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Requirement } from './UplodeTab';
import { cn } from '@/lib/utils';

const steps = [
  { value: 'upload', label: '1. Upload' },
  { value: 'classifier', label: '2. Classifier' },
  { value: 'validator', label: '3. Validator' },
  { value: 'user stories', label: '4. User Stories' },
  { value: 'gherkin', label: '5. Gherkin' },
  { value: 'test cases', label: '6. Test Cases' },
  { value: 'traceability', label: '7. Traceability' },
];

export default function BRDClarifai({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = React.useState('upload');
  const [fileTriedToExtract, setFileTriedToExtract] = React.useState(false);
  const [completedSteps, setCompletedSteps] = React.useState<{ [key: string]: boolean }>({
    document: false, // Change: Track document completion
    yaml: false,     // Change: Track yaml completion
    classifier: false,
    validator: false,
    'user stories': false,
    gherkin: false,
    'test cases': false,
    traceability: false,
  });
  const [extractedData, setExtractedData] = React.useState<Requirement[]>([]);
  const [extractionStatuses, setExtractionStatuses] = React.useState<{
    document: 'idle' | 'success' | 'failed';
    yaml: 'idle' | 'success' | 'failed';
  }>({
    document: 'idle',
    yaml: 'idle',
  });
  const [classifiedPayload, setClassifiedPayload] = useState<any>(null);
  const [validatePayload, setvalidatePayload] = useState<any>(null);
  const [userstoriesPayload, setuserstoriesPayload] = useState<any>(null);
  const [gerkinPayload, setgerkinPayload] = useState<any>(null);
  const [testcasePayload, settestcasePayload] = useState<any>(null);
  const [classifiedRequirements, setClassifiedRequirements] = useState<any[]>([]);
  const [validatedRequirements, setValidatedRequirements] = useState<any[]>([]);
  const [userstoriesRequirements, setuserstoriesRequirements] = useState<any[]>([]);
  const [gerkinRequirements, setgerkinRequirements] = useState<any[]>([]);
  const [testcaseRequirement, settestcaseRequirement] = useState<any[]>([]);
  const [traceabilityRequirements, settraceabilityRequirements] = useState<any[]>([]);
  const [isTraceabilityLoading, setIsTraceabilityLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [yamlFile, setYamlFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'document' | 'yaml'>('document');

  // Change: Reset states for the current uploadType
  useEffect(() => {
    setFileTriedToExtract(false);
    setExtractionStatuses((prev) => ({
      ...prev,
      [uploadType]: 'idle',
    }));
    setCompletedSteps((prev) => ({
      ...prev,
      [uploadType]: false,
    }));
    setExtractedData([]);
  }, [uploadType]);

  const combinedPayload = {
    classified_requirements: classifiedRequirements,
    validated_requirements: validatedRequirements,
    user_stories: userstoriesRequirements,
    gherkin_scenarios: gerkinRequirements,
    test_cases: testcaseRequirement,
  };

  const handleUploadComplete = (data: Requirement[]) => {
    setExtractedData(data);
    if (data.length > 0) {
      setExtractionStatuses((prev) => ({
        ...prev,
        [uploadType]: 'success',
      }));
      setCompletedSteps((prev) => ({ ...prev, [uploadType]: true })); // Change: Set completion for current uploadType
    } else if (fileTriedToExtract) {
      setExtractionStatuses((prev) => ({
        ...prev,
        [uploadType]: 'failed',
      }));
      setCompletedSteps((prev) => ({ ...prev, [uploadType]: false })); // Change: Ensure completion is false on failure
    }
  };

  const extractedPayload = { extracted_requirements: extractedData };

  const goToClassifier = (fullPayload: any) => {
    setClassifiedPayload(fullPayload);
    setClassifiedRequirements(fullPayload.classified_requirements || []);
    setEnabledSteps((prev) => [...new Set([...prev, 1])]);
    setActiveTab('classifier');
    setCompletedSteps((prev) => ({ ...prev, classifier: true }));
  };

  const goToValidator = (dataFromValidatorApi: any) => {
    setvalidatePayload(dataFromValidatorApi);
    setValidatedRequirements(dataFromValidatorApi.validated_requirements);
    setEnabledSteps((prev) => [...new Set([...prev, 2])]);
    setActiveTab('validator');
    setCompletedSteps((prev) => ({ ...prev, validator: true }));
  };

  const goTouserstories = (fullPayload: any) => {
    setuserstoriesPayload(fullPayload);
    setuserstoriesRequirements(fullPayload.user_stories);
    setEnabledSteps((prev) => [...new Set([...prev, 3])]);
    setActiveTab('user stories');
    setCompletedSteps((prev) => ({ ...prev, 'user stories': true }));
  };

  const goTogerkin = (fullPayload: any) => {
    setgerkinPayload(fullPayload);
    setgerkinRequirements(fullPayload.gherkin_scenarios);
    setEnabledSteps((prev) => [...new Set([...prev, 4])]);
    setActiveTab('gherkin');
    setCompletedSteps((prev) => ({ ...prev, 'gherkin': true }));
  };

  const goTotestcases = (fullPayload: any) => {
    settestcasePayload(fullPayload);
    settestcaseRequirement(fullPayload.test_cases);
    setEnabledSteps((prev) => [...new Set([...prev, 5])]);
    setActiveTab('test cases');
    setCompletedSteps((prev) => ({ ...prev, 'test cases': true }));
  };

  const goToTraceability = async () => {
    try {
      setIsTraceabilityLoading(true);
      const response = await fetch('http://localhost:8000/traceability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(combinedPayload),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      settraceabilityRequirements(result.traceability);
      console.log('Traceability data submitted successfully:', traceabilityRequirements);
      setEnabledSteps((prev) => [...new Set([...prev, 6])]);
      setActiveTab('traceability');
      setCompletedSteps((prev) => ({ ...prev, 'traceability': true }));
    } catch (error) {
      console.error('Failed to submit traceability data:', error);
    } finally {
      setIsTraceabilityLoading(false);
    }
  };

  const markClassifierComplete = () => {
    setCompletedSteps((prev) => ({ ...prev, classifier: true }));
  };

  const [enabledSteps, setEnabledSteps] = useState([0]); // Only Upload step enabled initially

  const isStepEnabled = (index: number) => {
    return index === 0 || enabledSteps.includes(index);
  };

  return (
    <>
      {onBack && (
        <button onClick={onBack} className="mb-4 text-sm text-primary hover:underline">
          ← Back
        </button>
      )}
      <div className="w-full">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            const currentIndex = steps.findIndex((s) => s.value === val);
            if (isStepEnabled(currentIndex)) {
              setActiveTab(val);
            }
          }}
        >
          <TabsList className="grid grid-cols-7 w-full bg-[#ececec] dark:bg-[#2e2D2D] rounded-md h-[6.5vh]">
            {steps.map((step, index) => {
              // Change: Use completedSteps[uploadType] for upload tab
              const isCompleted = step.value === 'upload' ? completedSteps[uploadType] : completedSteps[step.value];
              const isDisabled = !isStepEnabled(index);
              const showRed =
                step.value === 'upload' &&
                fileTriedToExtract &&
                extractionStatuses[uploadType] === 'failed' &&
                extractedData.length === 0;
              return (
                <TabsTrigger
                  key={step.value}
                  value={step.value}
                  disabled={isDisabled}
                  className={cn(
                    'w-full rounded-md px-2 py-2 text-xs font-medium transition-all flex items-center justify-center gap-2',
                    activeTab === step.value ? 'bg-purple-500 text-white' : 'text-black dark:text-white',
                    isDisabled && 'opacity-50 pointer-events-none cursor-not-allowed'
                  )}
                >
                  <div
                    className={`w-4 h-4 rounded-md border flex items-center justify-center text-[9px] ${
                      showRed
                        ? 'bg-red-500 border-red-500'
                        : isCompleted
                        ? 'bg-green-500 border-green-500'
                        : activeTab === step.value
                        ? 'bg-[#B164FF]'
                        : 'bg-black'
                    }`}
                  >
                    {isCompleted && <Check className="w-2 h-2 text-black" />}
                    {showRed && <X className="w-2 h-2 text-white" />}
                  </div>
                  {step.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsContent value="upload">
            <UploadTab
              onUploadComplete={handleUploadComplete}
              isUploadComplete={completedSteps[uploadType]} // Change: Pass completion status for current uploadType
              extractedData={extractedData}
              setExtractedData={setExtractedData}
              extractionStatus={extractionStatuses[uploadType]}
              onExtractTriggered={() => setFileTriedToExtract(true)}
              goToClassifier={goToClassifier}
              editingId={editingId}
              setEditingId={setEditingId}
              documentFile={documentFile}
              setDocumentFile={setDocumentFile}
              yamlFile={yamlFile}
              setYamlFile={setYamlFile}
              uploadType={uploadType}
              setUploadType={setUploadType}
            />
          </TabsContent>
          <TabsContent value="classifier">
            <ClassifierTab
              classifiedData={classifiedRequirements}
              fullClassifiedPayload={classifiedPayload}
              goTovalidator={goToValidator}
              fullExtractedPayload={extractedPayload}
              editingId={editingId}
              setEditingId={setEditingId}
              onUpdateClassifiedData={setClassifiedRequirements}
            />
          </TabsContent>
          <TabsContent value="validator">
            <ValidatorTab
              validatedData={validatedRequirements}
              fullValidatedDataPayload={validatePayload}
              goTouserstories={goTouserstories}
              fullClassifierPayload={classifiedPayload}
              onUpdateValidatedData={setValidatedRequirements}
            />
          </TabsContent>
          <TabsContent value="user stories">
            <UserStoriesTab
              goTogerkin={goTogerkin}
              userstoriesData={userstoriesRequirements}
              fulluserstoriesdataPayload={userstoriesPayload}
              fullValidatorPayload={validatePayload}
              onUpdatedUserStoriesData={setuserstoriesRequirements}
              onUpdateUserStoriesPayload={setuserstoriesPayload}
            />
          </TabsContent>
          <TabsContent value="gherkin">
            <GherkinTab
              goTotestcases={goTotestcases}
              gherkinData={gerkinRequirements}
              fullGherkinDataPayload={gerkinPayload}
              fullUserStoriesPayload={userstoriesPayload}
            />
          </TabsContent>
          <TabsContent value="test cases">
            <TestCasesTab
              goToTraceability={goToTraceability}
              testcaseData={testcaseRequirement}
              fulltestcaseDataPayload={testcasePayload}
              isLoading={isTraceabilityLoading}
              fulluserstoriesPayload={userstoriesPayload}
            />
          </TabsContent>
          <TabsContent value="traceability">
            <TraceabilityTab
              traceabilityData={traceabilityRequirements}
              combinedPayload={combinedPayload}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}