'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import ImageUploadTab from './ImageUploadTab';
import FigmaUserStoriesTab from './FigmaUserStoriesTab';
import GherkinTab from './FigmaGerkinsTab';
import TestCasesTab from './FigmaTestCasesTab';
import FigmaTraceabilityTab from './FigmaTraceabilityTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  { value: 'upload', label: '1. Upload Image' },
  { value: 'user stories', label: '2. User Stories' },
  { value: 'gherkin', label: '3. Gherkin' },
  { value: 'test cases', label: '4. Test Cases' },
  { value: 'traceability', label: '5. Traceability' },
];

export default function FigmaClarifai({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState('upload');
  const [completedSteps, setCompletedSteps] = useState<{ [key: string]: boolean }>({
    upload: false,
    'user stories': false,
    gherkin: false,
    'test cases': false,
    traceability: false,
  });
  const [enabledSteps, setEnabledSteps] = useState([0]);
  const [userstoriesPayload, setUserstoriesPayload] = useState<any>(null);
  const [userstoriesRequirements, setUserstoriesRequirements] = useState<any[]>([]);
  const [gerkinPayload, setGerkinPayload] = useState<any>(null);
  const [gerkinRequirements, setGerkinRequirements] = useState<any[]>([]);
  const [testcasePayload, setTestcasePayload] = useState<any>(null);
  const [testcaseRequirement, setTestcaseRequirement] = useState<any[]>([]);
  const [traceabilityRequirements, setTraceabilityRequirements] = useState<any[]>([]);
  const [isTraceabilityLoading, setIsTraceabilityLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // New states for uploaded files
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedDocFile, setUploadedDocFile] = useState<File | null>(null);

  // Process traceability response to filter out UNKNOWN entries and ensure correct linking
  const processTraceabilityData = (rawData: any[]) => {
    const processed: any[] = [];
    const testCaseMap: { [key: string]: any[] } = {};

    // Map test cases by derived user_story_id from test_id
    rawData.forEach(entry => {
      if (entry.test_cases && entry.test_cases.length > 0) {
        entry.test_cases.forEach((tc: any) => {
          const match = tc.test_id?.match(/TC-US-(\d+)-/);
          const usId = match ? `US-${match[1].padStart(3, '0')}` : entry.user_story_id;
          if (!testCaseMap[usId]) {
            testCaseMap[usId] = [];
          }
          testCaseMap[usId].push({ ...tc, user_story_id: usId });
        });
      }

      // Include only valid user story entries
      if (entry.user_story_id?.startsWith('US-') && entry.user_story) {
        processed.push({
          ...entry,
          test_cases: testCaseMap[entry.user_story_id] || []
        });
      }
    });

    // Get all existing user story IDs from your requirements data
    const existingUserStoryIds = userstoriesRequirements
      .map(us => us.requirement_id)
      .filter(id => id && id.startsWith('US-'))
      .sort();

    // Only include user stories that actually exist in your requirements data
    existingUserStoryIds.forEach(usId => {
      if (!processed.find(p => p.user_story_id === usId)) {
        const userStory = userstoriesRequirements.find(us => us.requirement_id === usId);
        const gherkinData = gerkinRequirements.find(g => g.user_story_id === usId);
        
        // Only add if user story actually exists and has content
        if (userStory && userStory.user_story && userStory.user_story.trim() !== '') {
          processed.push({
            user_story_id: usId,
            usid: usId,
            user_story: userStory.user_story || "",
            acceptance_criteria: userStory.acceptance_criteria || [],
            gherkin_feature: gherkinData?.feature || "",
            gherkin_scenarios: gherkinData?.scenarios || [],
            test_cases: testCaseMap[usId] || []
          });
        }
      }
    });

    // Debug log to see what's being processed
    console.log('Existing user story IDs:', existingUserStoryIds);
    console.log('Processed traceability entries:', processed.length);
    console.log('Sample processed entry:', processed[0]);

    return processed.sort((a, b) => a.user_story_id.localeCompare(b.user_story_id));
  };

  const combinedPayload = {
    user_stories: userstoriesRequirements
      .filter(story => story && story.requirement_id && story.user_story)
      .map(story => ({
        user_story_id: story.requirement_id,
        usid: story.usid || story.requirement_id,
        user_story: story.user_story || "",
        acceptance_criteria: story.acceptance_criteria || [],
        ...story
      })),
    gherkin_scenarios: gerkinRequirements
      .filter(scenario => scenario && scenario.user_story_id && scenario.feature)
      .map(scenario => ({
        user_story_id: scenario.user_story_id,
        feature: scenario.feature || "",
        scenarios: scenario.scenarios || [],
        ...scenario
      })),
    test_cases: testcaseRequirement
      .filter(tc => tc && tc.test_id && tc.title)
      .map(testcase => {
        const match = testcase.test_id?.match(/TC-US-(\d+)-/);
        const userStoryId = match ? `US-${match[1].padStart(3, '0')}` : "UNKNOWN_" + Math.random().toString(36).substring(2, 9);
        return {
          user_story_id: userStoryId,
          test_case_id: testcase.test_case_id || "TC_" + Math.random().toString(36).substring(2, 9),
          test_id: testcase.test_id,
          title: testcase.title,
          precondition: testcase.precondition || "",
          steps: testcase.steps || [],
          expected_result: testcase.expected_result || "",
          priority: testcase.priority || "",
          tags: testcase.tags || [],
          ...testcase
        };
      }),
  };

  useEffect(() => {
    sessionStorage.clear();
  }, []);

  useEffect(() => {
    const savedId = sessionStorage.getItem("editingId");
    if (savedId) setEditingId(savedId);
  }, []);

  useEffect(() => {
    if (editingId !== null) {
      sessionStorage.setItem("editingId", editingId);
    } else {
      sessionStorage.removeItem("editingId");
    }
  }, [editingId]);

  const isStepEnabled = (index: number) => index === 0 || enabledSteps.includes(index);

  const handleGenerateUserStories = async (data: { user_stories: any[] }) => {
    try {
      console.log("Input data.user_stories:", JSON.stringify(data.user_stories, null, 2));
      const mappedStories = data.user_stories
        .filter(story => story && story.user_story_id && story.user_story)
        .map((story: any) => ({
          ...story,
          requirement_id: story.user_story_id,
        }));
      console.log("mappedStories:", JSON.stringify(mappedStories, null, 2));
      setUserstoriesPayload(data);
      setUserstoriesRequirements(mappedStories);
      setCompletedSteps((prev) => ({ ...prev, upload: true, 'user stories': true }));
      setEnabledSteps((prev) => [...new Set([...prev, 1])]);
      setActiveTab('user stories');
    } catch (error) {
      console.error("Failed to process user stories:", error);
      setCompletedSteps((prev) => ({ ...prev, upload: false, 'user stories': false }));
    }
  };

  const goToGherkin = (fullPayload: any) => {
    const validGherkin = fullPayload.gherkin_scenarios?.filter((g: any) => g && g.user_story_id && g.feature) || [];
    console.log("Gherkin payload:", JSON.stringify(validGherkin, null, 2));
    setGerkinPayload(fullPayload);
    setGerkinRequirements(validGherkin);
    setEnabledSteps((prev) => [...new Set([...prev, 2])]);
    setActiveTab('gherkin');
    setCompletedSteps((prev) => ({ ...prev, gherkin: true }));
  };

  const goToTestCases = (fullPayload: any) => {
    const validTestCases = fullPayload.test_cases?.filter((tc: any) => tc && tc.test_id && tc.title) || [];
    console.log("Test cases payload:", JSON.stringify(validTestCases, null, 2));
    setTestcasePayload(fullPayload);
    setTestcaseRequirement(validTestCases);
    setEnabledSteps((prev) => [...new Set([...prev, 3])]);
    setActiveTab('test cases');
    setCompletedSteps((prev) => ({ ...prev, 'test cases': true }));
  };

  const goToTraceability = async () => {
    try {
      if (!userstoriesRequirements.length || !gerkinRequirements.length || !testcaseRequirement.length) {
        alert("Please complete all previous steps before generating traceability.");
        return;
      }
      setIsTraceabilityLoading(true);

      // Log input data for debugging
      console.log("combinedPayload:", JSON.stringify(combinedPayload, null, 2));

      // Send payload to backend
      const response = await fetch("http://127.0.0.1:8000/newtraceability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(combinedPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json();
      console.log("Backend traceability response:", JSON.stringify(result, null, 2));

      // Process response to ensure correct linking
      const processedTraceability = processTraceabilityData(result.traceability || result || []);
      console.log("Processed traceability:", JSON.stringify(processedTraceability, null, 2));

      setTraceabilityRequirements(processedTraceability);
      setEnabledSteps((prev) => [...new Set([...prev, 4])]);
      setActiveTab('traceability');
      setCompletedSteps((prev) => ({ ...prev, traceability: true }));
    } catch (error) {
      console.error("Failed to generate traceability:", error);
      alert(`Failed to generate traceability: ${error.message}`);
    } finally {
      setIsTraceabilityLoading(false);
    }
  };

  return (
    <>
      {onBack && (
        <button onClick={onBack} className="mb-4 text-sm text-primary hover:underline">
          ← Back to Approaches
        </button>
      )}
      <div className="w-full">
        <Tabs value={activeTab} onValueChange={(val) => {
          const currentIndex = steps.findIndex((s) => s.value === val);
          if (isStepEnabled(currentIndex)) setActiveTab(val);
        }}>
          <TabsList className="grid grid-cols-5 w-full bg-[#ececec] dark:bg-[#2e2D2D] rounded-md h-[6.5vh]">
            {steps.map((step, index) => {
              const isCompleted = completedSteps[step.value];
              const isDisabled = !isStepEnabled(index);
              return (
                <TabsTrigger
                  key={step.value}
                  value={step.value}
                  disabled={isDisabled}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-xs font-medium transition-all flex items-center justify-center gap-2",
                    activeTab === step.value ? 'bg-purple-500 text-white' : 'text-black dark:text-white',
                    isDisabled && 'opacity-50 pointer-events-none cursor-not-allowed'
                  )}
                >
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center text-[9px] ${
                    isCompleted ? 'bg-green-500 border-green-500' : activeTab === step.value ? 'bg-[#B164FF]' : 'bg-black'
                  }`}>
                    {isCompleted && <Check className="w-2 h-2 text-black" />}
                  </div>
                  {step.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="upload">
            <ImageUploadTab
              isUploadComplete={completedSteps.upload}
              onGenerateUserStories={handleGenerateUserStories}
              uploadedImageFile={uploadedImageFile}
              uploadedDocFile={uploadedDocFile}
              onFilesUploaded={(img, doc) => {
                setUploadedImageFile(img);
                setUploadedDocFile(doc);
              }}
              onClearImage={() => setUploadedImageFile(null)}
              onClearDoc={() => {
                setUploadedDocFile(null);
              }}
            />
          </TabsContent>
          <TabsContent value="user stories">
            <FigmaUserStoriesTab
              goTogerkin={goToGherkin}
              userstoriesData={userstoriesRequirements}
              fulluserstoriesdataPayload={userstoriesPayload}
              fullValidatorPayload={null}
              onUpdatedUserStoriesData={setUserstoriesRequirements}
              onUpdateUserStoriesPayload={setUserstoriesPayload}
              uploadedImageFile={uploadedImageFile}
              uploadedDocFile={uploadedDocFile}
            />
          </TabsContent>
          <TabsContent value="gherkin">
            <GherkinTab
              goTotestcases={goToTestCases}
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
            <FigmaTraceabilityTab
              traceabilityData={traceabilityRequirements}
              combinedPayload={combinedPayload}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}