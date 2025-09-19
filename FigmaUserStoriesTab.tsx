import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, CirclePlus, RotateCcw, User2Icon, Pencil, Sparkles } from "lucide-react";
import FeedbackModal from "@/components/clarifai/FeedbackModal";
import EditStoryModal from "@/components/clarifai/EditStoryModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Badge } from "../ui/badge";

type Requirement = {
  requirement_id: string;
  user_story_id: string;
  title: string;
  user_story: string;
  description?: string;
  acceptance_criteria: string[];
  confidence_score: number;
  tshirt_size: string;
  priority: string;
  tags?: string[];
  "Description/Note"?: string;
  "Tags/Labels"?: string[];
  priorityScore?: number;
};

type FormattedRequirement = {
  id: string; // This will be the user_story_id for Figma flow
  confidence: number;
  stories: {
    usid: string;
    title: string;
    role: string;
    story: string;
    description: string;
    acceptanceCriteria: string[];
    tshirt_size: string;
    priority: string;
    priorityScore?: number;
    tags: string[];
    confidence: number;
  }[];
};

type Story = FormattedRequirement['stories'][0];

interface FigmaUserStoriesProps {
  goTogerkin: (gerkinData: any) => void;
  userstoriesData: Requirement[];
  fulluserstoriesdataPayload: { user_stories: Requirement[] };
  fullValidatorPayload: null;
  onUpdatedUserStoriesData: (updatedData: Requirement[]) => void;
  onUpdateUserStoriesPayload: (updatedPayload: any) => void;
}

export default function FigmaUserStoriesTab({ 
  goTogerkin, 
  userstoriesData, 
  fulluserstoriesdataPayload, 
  fullValidatorPayload, 
  onUpdatedUserStoriesData, 
  onUpdateUserStoriesPayload 
}: FigmaUserStoriesProps) {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [expandAll, setExpandAll] = useState(false);
  const [expandedReqs, setExpandedReqs] = useState<Record<string, boolean>>({});
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [selectedStory, setSelectedStory] = useState<null | Story>(null);
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null); // Changed from currentReqId
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'view' | 'edit' | 'refine'>('view');
  const [showDialogMessage, setShowDialogMessage] = useState<string>('');
  const [editedStory, setEditedStory] = useState<Story>(null as any);
  // Refine states
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendClicked, setSendClicked] = useState(false);
  const [updatedStory, setUpdatedStory] = useState<any>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timeroutRef = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editableStory, setEditableStory] = useState<any>(null);

  const getPriorityScore = (priority: string): number => {
    switch (priority?.toLowerCase()) {
      case 'high': return 0.9;
      case 'medium': return 0.5;
      case 'low': return 0.1;
      default: return 0.5;
    }
  };

  useEffect(() => {
    if (showDialogMessage) {
      const timer = setTimeout(() => setShowDialogMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [showDialogMessage]);

  useEffect(() => {
    const extractRoleFromStory = (story: string): string => {
      const match = story.match(/As (a|an|the) ([^,]*)/i);
      return match ? match[2].trim() : "Unknown";
    };
    
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 3000);

    const formattedData: FormattedRequirement[] = userstoriesData.map((storyObj, index) => ({
      // Use user_story_id as the primary identifier for Figma flow
      id: storyObj.user_story_id || `FIGMA-${index + 1}`,
      confidence: storyObj.confidence_score ?? 0.5,
      stories: [
        {
          usid: storyObj.user_story_id,
          title: storyObj.title,
          role: extractRoleFromStory(storyObj.user_story),
          story: storyObj.user_story,
          // Handle both description and Description/Note
          description: storyObj.description || storyObj["Description/Note"] || '',
          acceptanceCriteria: storyObj.acceptance_criteria || [],
          tshirt_size: storyObj.tshirt_size || '',
          priority: storyObj.priority || '',
          priorityScore: getPriorityScore(storyObj.priority),
          // Handle both tags and Tags/Labels, keep original case for Figma flow
          tags: storyObj.tags || storyObj["Tags/Labels"] || [],
          confidence: storyObj.confidence_score ?? 0.5,
        },
      ],
    }));

    setRequirements(formattedData);
    console.log('FigmaUserStoriesTab - Initial requirements:', formattedData);
  }, [userstoriesData]);

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [requirements, setRequirements] = useState<FormattedRequirement[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPostingSuccess, setShowPostingSuccess] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  const uniqueRoles = Array.from(
    new Set(
      requirements.flatMap((item) =>
        item.stories.map((story) => story.role)
      )
    )
  );

  const uniqueTags: string[] = Array.from(
    new Set(
      requirements.flatMap((item) =>
        item.stories.flatMap((story) => story.tags).filter(tag => tag && tag.length > 0)
      )
    )
  ).sort();

  const filteredRequirements = requirements.filter((req) => {
    const meetsConfidence = req.confidence >= confidenceThreshold;
    const meetsRoles =
      roleFilter.length === 0 ||
      req.stories.some((s) => roleFilter.includes(s.role));
    const meetsId =
      selectedIds.length === 0 || selectedIds.includes(req.id);
    const meetsSearch =
      searchText.trim() === "" ||
      req.id.toLowerCase().includes(searchText.toLowerCase()) ||
      req.stories.some((s) =>
        s.story.toLowerCase().includes(searchText.toLowerCase())
      );
    const meetsTags =
      tagFilter.length === 0 ||
      req.stories.some((s) => s.tags.some((tag) => tagFilter.includes(tag)));

    return meetsConfidence && meetsRoles && meetsId && meetsSearch && meetsTags;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const totalPages = Math.ceil(filteredRequirements.length / rowsPerPage);
  const paginated = filteredRequirements.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const clearAllFilters = () => {
    setRoleFilter([]);
    setSelectedIds([]);
    setTagFilter([]);
    setConfidenceThreshold(0);
    setSearchText("");
  };

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedReqs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const storieslength = requirements.length;

  const handlegherkin = async () => {
    if (!fulluserstoriesdataPayload) return;
    setIsLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/gherkin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fulluserstoriesdataPayload),
      });
      if (!response.ok) throw new Error("Gherkin generation failed");
      const gerkinData = await response.json();
      goTogerkin(gerkinData);
    } catch (err) {
      console.error("Gherkin error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = () => {
    console.log("Regenerate not available in Figma flow");
  };

  const handlePost = async () => {
    if (!fulluserstoriesdataPayload) return;
    setIsPosting(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/jira/user_stories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fulluserstoriesdataPayload),
      });
      if (!response.ok) throw new Error("Posting failed");
      console.log("handlepost in figma usecase success");
      const data = await response.json();
    } catch (err) {
      console.error("Posting error:", err);
    } finally {
      setIsPosting(false);
      setShowPostingSuccess(true);
      setTimeout(() => {
        setShowPostingSuccess(false);
      }, 5000);
    }
  };

  useEffect(() => {
    const newStates: Record<string, boolean> = {};
    requirements.forEach((r) => {
      newStates[r.stories[0]?.usid || ''] = expandAll;
    });
    setExpandedReqs(newStates);
  }, [expandAll, requirements]);

  const handleEditClick = () => {
    setEditedStory(selectedStory);
    setViewMode('edit');
  };

  const handleRefineClick = () => {
    setFeedback('');
    setUpdatedStory(null);
    setIsEditing(false);
    setEditableStory(null);
    setViewMode('refine');
  };

  const handleEditSave = () => {
    const normalizedConfidence =
      typeof editedStory.confidence === 'string'
        ? editedStory.confidence.toLowerCase() === 'high' ? 0.8 : editedStory.confidence.toLowerCase() === 'medium' ? 0.5 : 0.2
        : editedStory.confidence ?? selectedStory?.confidence ?? 0;

    const normalizedPriorityScore = getPriorityScore(editedStory.priority);

    const normalizedStory = { 
      ...editedStory, 
      confidence: normalizedConfidence,
      priorityScore: normalizedPriorityScore,
      // Handle Figma-specific fields
      description: editedStory.description || selectedStory.description,
      tags: editedStory.tags || selectedStory.tags,
      acceptanceCriteria: editedStory.acceptanceCriteria || selectedStory.acceptanceCriteria,
    };

    setSelectedStory(normalizedStory);
    
    // Update requirements - find by user_story_id
    setRequirements((prevReqs) =>
      prevReqs.map((req) => ({
        ...req,
        stories: req.stories.map((s) =>
          s.usid === selectedStory.usid ? { ...s, ...normalizedStory } : s
        ),
        confidence: normalizedConfidence,
      }))
    );

    // Update the original payload - find by user_story_id
    const index = fulluserstoriesdataPayload.user_stories.findIndex((r: Requirement) => r.user_story_id === selectedStory.usid);
    if (index !== -1) {
      const updatedStories = [...fulluserstoriesdataPayload.user_stories];
      updatedStories[index] = {
        ...updatedStories[index],
        title: normalizedStory.title,
        user_story: normalizedStory.story,
        description: normalizedStory.description,
        acceptance_criteria: normalizedStory.acceptanceCriteria,
        confidence_score: normalizedConfidence,
        tshirt_size: normalizedStory.tshirt_size,
        priority: normalizedStory.priority,
        tags: normalizedStory.tags,
        "Description/Note": normalizedStory.description, // Update Figma-specific field
        "Tags/Labels": normalizedStory.tags, // Update Figma-specific field
      };
      const updatedPayload = { ...fulluserstoriesdataPayload, user_stories: updatedStories };
      onUpdateUserStoriesPayload(updatedPayload);
      onUpdatedUserStoriesData(updatedStories);
      setShowDialogMessage('Edit submitted successfully');
    } else {
      console.error('Story not found for update:', selectedStory.usid);
    }
    
    setViewMode('view');
  };

  const handleChange = (field: keyof Story, value: string | string[]) => {
    setEditedStory((prev) => ({ ...prev, [field]: value }));
  };

  const handleRefineSubmit = async () => {
    if (!feedback.trim()) return;
    setLoading(true);
    setSendClicked(true);

    try {
      console.log('FeedbackModal - Original confidence:', selectedStory?.confidence, 'Input story:', selectedStory);
      const res = await fetch("http://127.0.0.1:8000/update-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story: selectedStory, feedback }),
      });

      const updated = await res.json();
      console.log('FeedbackModal - Backend confidence:', updated.updated_story?.confidence);
      const normalizedConfidence = selectedStory?.confidence ?? 0.5;

      const normalizedStory = {
        ...updated.updated_story,
        usid: updated.updated_story.usid || selectedStory.usid,
        acceptanceCriteria: updated.updated_story.acceptanceCriteria || updated.updated_story.acceptance_criteria || selectedStory.acceptanceCriteria,
        description: updated.updated_story.description || updated.updated_story["Description/Note"] || selectedStory.description,
        tags: updated.updated_story.tags || updated.updated_story["Tags/Labels"] || selectedStory.tags,
        confidence: normalizedConfidence,
        priorityScore: getPriorityScore(updated.updated_story.priority || selectedStory.priority),
      };
      setUpdatedStory(normalizedStory);
      setEditableStory(normalizedStory);
      setFeedback("");
      setShowDialogMessage('Feedback edited successfully');
    } catch (err) {
      console.error("LLM update failed:", err);
    } finally {
      setLoading(false);
      setTimeout(() => setSendClicked(false), 300);
    }
  };

  const handleRefineSave = () => {
    console.log('FeedbackModal - Saving with confidence:', editableStory?.confidence ?? updatedStory.confidence);
    const finalStory = isEditing ? editableStory : updatedStory;
    const normalizedConfidence = finalStory.confidence ?? selectedStory?.confidence ?? 0.5;
    const normalizedPriorityScore = getPriorityScore(finalStory.priority);
    
    const normalizedStory = {
      ...finalStory,
      confidence: normalizedConfidence,
      priorityScore: normalizedPriorityScore,
      // Handle Figma-specific fields
      description: finalStory.description || selectedStory.description,
      tags: finalStory.tags || selectedStory.tags,
      acceptanceCriteria: finalStory.acceptanceCriteria || selectedStory.acceptanceCriteria,
    };
    
    setSelectedStory(normalizedStory);
    
    // Update requirements - find by user_story_id
    setRequirements((prevReqs) =>
      prevReqs.map((req) => ({
        ...req,
        stories: req.stories.map((s) =>
          s.usid === selectedStory?.usid ? { ...s, ...normalizedStory } : s
        ),
        confidence: normalizedConfidence,
      }))
    );

    // Update the original payload - find by user_story_id
    const index = fulluserstoriesdataPayload.user_stories.findIndex((r: Requirement) => r.user_story_id === selectedStory.usid);
    if (index !== -1) {
      const updatedStories = [...fulluserstoriesdataPayload.user_stories];
      updatedStories[index] = {
        ...updatedStories[index],
        title: normalizedStory.title,
        user_story: normalizedStory.story,
        description: normalizedStory.description,
        acceptance_criteria: normalizedStory.acceptanceCriteria,
        confidence_score: normalizedConfidence,
        tshirt_size: normalizedStory.tshirt_size,
        priority: normalizedStory.priority,
        tags: normalizedStory.tags,
        "Description/Note": normalizedStory.description, // Update Figma-specific field
        "Tags/Labels": normalizedStory.tags, // Update Figma-specific field
      };
      const updatedPayload = { ...fulluserstoriesdataPayload, user_stories: updatedStories };
      onUpdateUserStoriesPayload(updatedPayload);
      onUpdatedUserStoriesData(updatedStories);
      setShowDialogMessage('Feedback saved successfully');
    } else {
      console.error('Story not found for update:', selectedStory.usid);
    }
    
    setViewMode('view');
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = true;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      if (timeroutRef.current) {
        clearTimeout(timeroutRef.current);
      }
    };

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }

      setFeedback((prev) => (prev ? prev + " " + transcript : transcript));
      if (timeroutRef.current) {
        clearTimeout(timeroutRef.current);
      }
      timeroutRef.current = setTimeout(() => { recognition.stop(); }, 2000);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  return (
    <>
      <div className="bg-[#f6f6f6] dark:bg-[#181818] rounded-2xl text-black dark:text-white h-[75vh] overflow-hidden flex flex-col">
        <div className="px-3 py-3 flex items-center gap-2 border-b border-gray-700">
          <div>
            <h1 className="text-[16px] font-semibold">Figma User Stories List</h1>
            <p className="text-[12px] text-gray-400">Generated {storieslength} User Stories Requirements</p>
          </div>
        </div>

        <div className="flex gap-4 p-6 items-center">
          <Input
            placeholder="Filter tasks..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-1/4"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="border border-dashed">
                <CirclePlus className="w-4 h-4" />
                User as a:
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-55 p-2 bg-gray-900 border-gray-700 text-white">
              <ScrollArea className="h-30 w-full pr-2">
                <div className="flex flex-col gap-2">
                  {uniqueRoles.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={roleFilter.includes(role)}
                        onCheckedChange={() =>
                          setRoleFilter((prev) =>
                            prev.includes(role)
                              ? prev.filter((item) => item !== role)
                              : [...prev, role]
                          )
                        }
                      />
                      <span className="text-white font-medium">{role}</span>
                    </label>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="border border-dashed">
                <CirclePlus className="w-4 h-4" />
                Story ID
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 bg-gray-900 border-gray-700 text-white p-4 rounded-lg shadow-xl">
              <ScrollArea className="h-30 w-full pr-2">
                <div className="flex flex-col gap-2">
                  {requirements.map((req) => (
                    <label key={req.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedIds.includes(req.id)}
                        onCheckedChange={() => toggleId(req.id)}
                      />
                      <span className="text-white">{req.id}</span>
                    </label>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium whitespace-nowrap">
              Confidence
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono px-2 py-1 bg-[#d0d0d0] dark:bg-gray-800 rounded">
                {confidenceThreshold.toFixed(1)}
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={confidenceThreshold}
                onChange={(e) =>
                  setConfidenceThreshold(parseFloat(e.target.value))
                }
                className="w-38 h-2 accent-black dark:accent-white bg-[#d0d0d0] dark:bg-gray-700 rounded-lg"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm font-medium">Expand All</span>
            <div className="w-[52px] h-[22px] bg-white rounded-full flex items-center justify-between px-[2px]">
              <button
                onClick={() => setExpandAll(false)}
                className={`w-[24px] h-[18px] text-[12px] font-bold rounded-full transition-all duration-200 ${
                  !expandAll ? "bg-black text-white" : "text-black"
                }`}
              >
                N
              </button>
              <button
                onClick={() => setExpandAll(true)}
                className={`w-[24px] h-[18px] text-[12px] font-bold rounded-full transition-all duration-200 ${
                  expandAll ? "bg-black text-white" : "text-black"
                }`}
              >
                Y
              </button>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={clearAllFilters}
            className="text-sm text-black dark:text-white border border-dashed px-3 py-2"
          >
            <span><RotateCcw /></span>
            Clear Filters
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="border border-dashed">
                <CirclePlus className="w-4 h-4" />
                Tags
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 bg-gray-900 border-gray-700 text-white overflow-hidden">
              <ScrollArea className="h-60 w-full">
                <div className="flex flex-col gap-2 p-2">
                  {uniqueTags.map((tag) => (
                    <label key={tag} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={tagFilter.includes(tag)}
                        onCheckedChange={(checked) =>
                          setTagFilter((prev) =>
                            checked
                              ? [...prev, tag]
                              : prev.filter((item) => item !== tag)
                          )
                        }
                      />
                      <span className="text-white font-medium">{tag}</span>
                    </label>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto px-4 pr-6 pb-4">
          {paginated.map((req) => (
            <div key={req.id} className="rounded-2xl border dark:border-gray-700 mb-4 ml-2 mr-2">
              <button
                onClick={() => toggleExpand(req.stories[0]?.usid || '')}
                className="w-full flex justify-between items-center pl-4 pr-4 px-6 py-3 rounded-2xl dark:bg-[#272727] bg-gray-300"
              >
                <div className="grid grid-cols-2 text-sm font-semibold gap-25 text-gray-700 dark:text-gray-400 mb-2">
                  <div>User As a.. ({req.stories.length})</div>
                  <div>Stories ({req.stories.length})</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-700 dark:text-gray-400">
                    Story ID – <span className="text-black dark:text-white">{req.id}</span>
                  </div>
                  <ConfidenceBadge confidence={req.confidence} />
                  {expandedReqs[req.stories[0]?.usid || ''] ? (
                    <ChevronUp className="w-4 h-4 text-gray-700 dark:text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-700 dark:text-gray-400" />
                  )}
                </div>
              </button>
              {expandedReqs[req.stories[0]?.usid || ''] && (
                <div className="px-2 space-y-4 bg-white dark:bg-[#1a1a1a] rounded-b-xl max-h-[200px]">
                  <ScrollArea className="h-full w-full pr-2">
                    {req.stories.map((story, idx) => (
                      <div key={story.usid} className="flex items-center justify-between border-b border-gray-400 dark:border-gray-700 py-2 gap-4">
                        <div className="flex items-center text-black dark:text-white pl-4 gap-2 min-w-[180px]">
                          <User2Icon className="w-4 h-4" />
                          <span className="text-sm">{story.role}</span>
                        </div>
                        <div className="flex-1 text-sm text-black dark:text-white px-2">
                          "{story.story}"
                          <span className="ml-2">
                            <Badge className="pb-0.5 pt-0.5 text-sm font-normal rounded-sm bg-[#466ABA] text-white">
                              {story.tshirt_size}
                            </Badge>
                          </span>
                          <span className="ml-1">
                            <Badge
                              className={`pb-0.5 pt-0.5 text-sm font-normal rounded-sm ${
                                story?.priority === "High"
                                  ? "bg-[#6C4343] text-white"
                                  : story?.priority === "Medium"
                                  ? "bg-[#695A3A] text-white"
                                  : "bg-[#387189] text-white"
                              }`}
                            >
                              {story?.priority}
                            </Badge>
                          </span>
                        </div>
                        <Button
                          className="bg-black dark:bg-white text-white dark:text-black mr-2 h-8 px-3 text-xs rounded-t-md rounded-b-md whitespace-nowrap"
                          onClick={() => {
                            console.log('FigmaUserStoriesTab - Setting selectedStory:', story);
                            setSelectedStory(story);
                            setCurrentStoryId(req.id); // Use story ID
                            setViewMode('view');
                            setIsViewOpen(true);
                          }}
                        >
                          Edit/Refine Feedback
                        </Button>
                      </div>
                    ))}
                    <ScrollBar orientation="vertical" />
                  </ScrollArea>
                </div>
              )}
            </div>
          ))}
          <ScrollBar orientation="vertical" />
        </ScrollArea>

        <div className="flex justify-end items-center h-9 border-b border-gray-700 text-sm bg-[#f6f6f6] dark:bg-black text-black dark:text-white">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-black dark:text-white">Rows per page</span>
              <select
                className="bg-black border border-gray-700 text-white rounded px-2 py-1"
                value={rowsPerPage}
                onChange={(e) => {
                  setCurrentPage(1);
                  setRowsPerPage(parseInt(e.target.value));
                }}
              >
                {[2, 5, 10, 25].map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <div className="text-black dark:text-white">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1} 
                className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50"
              >
                &laquo;
              </button>
              <button 
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} 
                disabled={currentPage === 1} 
                className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50"
              >
                &lsaquo;
              </button>
              <button 
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages} 
                className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50"
              >
                &rsaquo;
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages} 
                className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-between gap-2 mt-2">
          <div className="min-w-[300px] h-[30px] flex items-center">
            {showMessage && (
              <span className="flex flex-row gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 30.266 30.266"
                  className="mt-1"
                >
                  <path
                    d="M30.266,15.133A15.133,15.133,0,1,1,15.133,0,15.133,15.133,0,0,1,30.266,15.133ZM22.756,9.4a1.419,1.419,0,0,0-2.043.042l-6.57,8.37-3.959-3.961a1.419,1.419,0,0,0-2.005,2.005l5.005,5.007a1.419,1.419,0,0,0,2.041-.038l7.551-9.439A1.419,1.419,0,0,0,22.758,9.4Z"
                    fill="#24d304"
                  />
                </svg>
                Generated user stories data
              </span>
            )}
            {showPostingSuccess && (
              <span className="flex flex-row gap-2">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="15" 
                  height="15" 
                  viewBox="0 0 30.266 30.266" 
                  className="mt-1"
                >
                  <path 
                    d="M30.266,15.133A15.133,15.133,0,1,1,15.133,0,15.133,15.133,0,0,1,30.266,15.133ZM22.756,9.4a1.419,1.419,0,0,0-2.043.042l-6.57,8.37-3.959-3.961a1.419,1.419,0,0,0-2.005,2.005l5.005,5.007a1.419,1.419,0,0,0,2.041-.038l7.551-9.439A1.419,1.419,0,0,0,22.758,9.4Z" 
                    fill="#24d304" 
                  />
                </svg>
                Bulk issues created successfully!
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              className="bg-white dark:bg-[#0D0D0D] text-black dark:text-white border border-gray-400"
              disabled={filteredRequirements.length === 0 || isPosting}
              onClick={handlePost}
            >
              {isPosting ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-black dark:text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Posting...
                </span>
              ) : (
                "Post"
              )}
            </Button>
            <Button
              className="bg-white dark:bg-[#0D0D0D] text-black dark:text-white border border-gray-400"
              disabled={filteredRequirements.length === 0 || isRegenerating}
              onClick={handleRegenerate}
            >
              {isRegenerating ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-black dark:text-white"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Regenerating...
                </span>
              ) : (
                "Regenerate Response"
              )}
            </Button>
            <Button
              className="bg-black dark:bg-white text-white dark:text-black"
              disabled={isLoading}
              onClick={handlegherkin}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4 text-white dark:text-black"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Generate Gherkin"
              )}
            </Button>
          </div>
        </div>
      </div>
      
     <Dialog open={isViewOpen} onOpenChange={(open) => {
  setIsViewOpen(open);
  if (!open) {
    setSelectedStory(null);
    setCurrentStoryId(null);
    setViewMode('view');
    setFeedback('');
    setUpdatedStory(null);
    setIsEditing(false);
    setEditableStory(null);
    setEditedStory(null as any);
    setShowDialogMessage('');
  }
}}>
  <DialogContent className={`w-[1200px] max-w-[1200px] sm:w-[1200px] sm:max-w-[1200px] bg-[#1a1a1a] text-white fixed top-[280px] left-1/2 -translate-x-1/2 p-4 rounded-xl shadow-lg max-h-[80vh] overflow-hidden flex flex-col ${
    viewMode === 'refine' ? 'h-[500px]' : 'h-[500px]'
  }`}>
    <DialogClose asChild>
      <button
        className="absolute top-4 right-4 z-20 text-gray-400 hover:text-white transition-colors text-xl"
        aria-label="Close dialog"
      > 
        ×
      </button>
    </DialogClose>

    <DialogHeader className="sticky top-0 bg-[#1a1a1a] z-10 border-b border-gray-700 p-4">
      <DialogTitle className="text-sm text-gray-400 flex justify-between items-center">
        {viewMode === 'refine' && updatedStory ? (
          <div className="flex-1 flex justify-between items-center">
            <span>Refined Feedback</span>
            <Button 
              variant="ghost" 
              className="text-white text-sm h-6 px-2"
              onClick={() => {
                setUpdatedStory(null);
                setFeedback('');
                setIsEditing(false);
                setEditableStory(null);
              }}
            >
              Clear All Feedback
            </Button>
          </div>
        ) : (
          <>
            {viewMode === 'refine' ? 'Refine Feedback' : 'Edit/Refine Feedback'}
            <div className="flex gap-2">
              {viewMode === 'view' && (
                <>
                  <Button 
                    className="bg-[#2B2A2A] hover:bg-[#48494B] text-[#FFFFFF] px-4 py-2 text-sm"
                    onClick={handleEditClick}
                  >
                    Edit Feedback
                  </Button>
                  <Button 
                    className="bg-[#2B2A2A] hover:bg-[#48494B] text-[#FFFFFF] px-4 py-2 text-sm"
                    onClick={handleRefineClick}
                  >
                    Refine Feedback
                  </Button>
                </>
              )}
              {(viewMode === 'edit' || viewMode === 'refine') && (
                <Button 
                  variant="ghost" 
                  className="text-white px-4 py-2 text-sm"
                  onClick={() => setViewMode('view')}
                >
                  Back
                </Button>
              )}
            </div>
          </>
        )}
      </DialogTitle>
    </DialogHeader>
    
    <div className="flex-1 overflow-y-auto p-4 pr-2">
      {selectedStory && currentStoryId && (() => {
        const currentReq = requirements.find((r) => r.id === currentStoryId);
        if (!currentReq) return null;
        return (
          <>
            {showDialogMessage && (
              <div className="mb-4 flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900 rounded-md text-green-800 dark:text-green-200">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 30.266 30.266">
                  <path d="M30.266,15.133A15.133,15.133,0,1,1,15.133,0,15.133,15.133,0,0,1,30.266,15.133ZM22.756,9.4a1.419,1.419,0,0,0-2.043.042l-6.57,8.37-3.959-3.961a1.419,1.419,0,0,0-2.005,2.005l5.005,5.007a1.419,1.419,0,0,0,2.041-.038l7.551-9.439A1.419,1.419,0,0,0,22.758,9.4Z" fill="#24d304" />
                </svg>
                {showDialogMessage}
              </div>
            )}
            
            {viewMode === 'view' && (
              <DialogDescription className="text-base text-white space-y-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-gray-400 font-semibold">User As A:</span>
                  <span
                    className={`min-w-[180px] ${
                      selectedStory.role === "Card Operator"
                        ? "text-green-600 dark:text-[#ABE2C9]"
                        : "text-blue-600 dark:text-[#5ABAD1]"
                    }`}
                  >
                    {selectedStory.role}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold">User Story ID:</span>
                  <span className="text-white ml-2">{selectedStory.usid}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold">Title:</span>
                  <span className="text-white ml-2">{selectedStory.title}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold"><br />Labels/Tags:</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedStory.tags.map((item, index) => (
                      <span
                        key={index}
                        className="bg-gray-700 text-white text-sm px-3 py-1 rounded-full border border-gray-600 hover:bg-gray-600 transition-colors"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold"><br />User Story:</span>
                  <div className="text-white">
                    {selectedStory.story}
                    <span className="ml-2">
                      <Badge className="pb-0.5 pt-0.5 text-sm font-normal rounded-sm bg-[#466ABA] text-white">
                        {selectedStory.tshirt_size}
                      </Badge>
                    </span>
                    <span className="ml-1">
                      <Badge
                        className={`pb-0.5 pt-0.5 text-sm font-normal rounded-sm ${
                          selectedStory?.priority === "High"
                            ? "bg-[#6C4343] text-white"
                            : selectedStory?.priority === "Medium"
                            ? "bg-[#695A3A] text-white"
                            : "bg-[#387189] text-white"
                        }`}
                      >
                        {selectedStory?.priority}
                      </Badge>
                    </span>
                  </div>
                </div>
                <div>
                  <br />
                  <span className="text-gray-400 font-semibold">Description:</span>
                  <span className="text-white ml-2 block mt-1">{selectedStory.description}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold"><br />Acceptance Criteria:</span>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    {selectedStory.acceptanceCriteria.map((item, index) => (
                      <li key={index} className="text-white">{item}</li>
                    ))}
                  </ul>
                </div>
              </DialogDescription>
            )}

            {viewMode === 'edit' && (
              <>
                <div className="flex-1 overflow-y-auto space-y-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">User Story ID</label>
                    <input
                      type="text"
                      value={editedStory.usid}
                      disabled
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-gray-400 cursor-not-allowed"
                    />
                  </div>
                  {editedStory.confidence !== undefined && (
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">Confidence Score</label>
                      <input
                        type="text"
                        value={editedStory.confidence.toString()}
                        disabled
                        className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-gray-400 cursor-not-allowed"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Title</label>
                    <input
                      type="text"
                      value={editedStory.title}
                      onChange={(e) => handleChange("title", e.target.value)}
                      placeholder="Title"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">User Story</label>
                    <textarea
                      value={editedStory.story}
                      onChange={(e) => handleChange("story", e.target.value)}
                      placeholder="User Story"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Description</label>
                    <textarea
                      value={editedStory.description}
                      onChange={(e) => handleChange("description", e.target.value)}
                      placeholder="Description"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Acceptance Criteria</label>
                    <textarea
                      value={editedStory.acceptanceCriteria.join("\n")}
                      onChange={(e) => handleChange("acceptanceCriteria", e.target.value.split("\n"))}
                      placeholder="Acceptance Criteria (one per line)"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Labels/Tags</label>
                    <textarea
                      value={editedStory.tags.join("\n")}
                      onChange={(e) => handleChange("tags", e.target.value.split("\n"))}
                      placeholder="Tags (one per line)"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Priority</label>
                    <input
                      type="text"
                      value={editedStory.priority}
                      onChange={(e) => handleChange("priority", e.target.value)}
                      placeholder="Priority"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">T-Shirt Size</label>
                    <input
                      type="text"
                      value={editedStory.tshirt_size}
                      onChange={(e) => handleChange("tshirt_size", e.target.value)}
                      placeholder="T-Shirt Size"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Role</label>
                    <input
                      type="text"
                      value={editedStory.role}
                      onChange={(e) => handleChange("role", e.target.value)}
                      placeholder="Role"
                      className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <DialogFooter className="bg-[#1a1a1a] border-t border-gray-700 p-4">
                  <Button variant="ghost" onClick={() => setViewMode('view')} className="mr-auto">
                    Clear
                  </Button>
                  <Button onClick={handleEditSave}>Save</Button>
                </DialogFooter>
              </>
            )}
{viewMode === 'refine' && (
  <div className="flex flex-col h-full">
    {/* Top Section - Initial Story Display */}
    {!updatedStory ? (
      <div className="flex-1 overflow-y-auto mb-4">
        <div className="p-4 border border-gray-700 rounded-md  text-sm space-y-3">
          <div>
            <span className="text-gray-400">User Story ID:</span>{" "}
            <span className="text-white">{selectedStory.usid}</span>
          </div>
          <div>
            <span className="text-gray-400">Title:</span>{" "}
            <span className="text-white">{selectedStory.title}</span>
          </div>
          <div>
            <span className="text-gray-400">Role:</span>{" "}
            <span className="text-white">{selectedStory.role}</span>
          </div>
          <div>
            <span className="text-gray-400">Story:</span>{" "}
            <span className="text-white">{selectedStory.story}</span>
          </div>
          <div>
            <span className="text-gray-400">Description:</span>{" "}
            <span className="text-white">{selectedStory.description}</span>
          </div>
          <div>
            <span className="text-gray-400">T-shirt Size:</span>{" "}
            <span className="text-white">{selectedStory.tshirt_size}</span>
          </div>
          <div>
            <span className="text-gray-400">Priority:</span>{" "}
            <span className="text-white">{selectedStory.priority}</span>
          </div>
          <div>
            <span className="text-gray-400">Acceptance Criteria:</span>
            <ul className="list-disc pl-5 text-white mt-1 space-y-1">
              {selectedStory.acceptanceCriteria.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="text-gray-400">Labels/Tags:</span>
            <ul className="list-disc pl-5 text-white mt-1 space-y-1">
              {selectedStory.tags.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    ) : null}

    {/* Updated Story Section - Only show if exists */}
    {updatedStory && (
      <div className="flex-1 overflow-y-auto mb-4">
        <div className="p-4 border border-gray-700 rounded-md  text-sm space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">Refined Story</h3>
            {/* Edit button only when not editing */}
            {/* {!isEditing && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  // Create a deep copy to ensure editableStory is properly initialized
                  setEditableStory({
                    ...updatedStory,
                    acceptanceCriteria: [...updatedStory.acceptanceCriteria],
                    tags: [...updatedStory.tags]
                  });
                }}
                className="text-yellow-400 hover:text-yellow-300 text-sm"
              >
                Edit
              </button>
            )} */}
          </div>
          
          {isEditing ? (
            <>
              <div>
  <span className="text-gray-400">User Story ID:</span>
  <input
    value={editableStory?.usid || ''}
    readOnly
    className="w-full mt-1 bg-gray-700 text-white p-2 rounded-md border border-gray-600 opacity-60 cursor-not-allowed"
  />
</div>
              <div>
                <span className="text-gray-400">Title:</span>
                <input
                  value={editableStory?.title || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return { ...prev, title: e.target.value };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                />
              </div>
              <div>
                <span className="text-gray-400">Role:</span>
                <input
                  value={editableStory?.role || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return { ...prev, role: e.target.value };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                />
              </div>
              <div>
                <span className="text-gray-400">Story:</span>
                <textarea
                  value={editableStory?.story || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return { ...prev, story: e.target.value };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                  rows={3}
                />
              </div>
              <div>
                <span className="text-gray-400">Description:</span>
                <textarea
                  value={editableStory?.description || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return { ...prev, description: e.target.value };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                  rows={3}
                />
              </div>
              <div>
                <span className="text-gray-400">T-shirt Size:</span>
                <input
                  value={editableStory?.tshirt_size || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return { ...prev, tshirt_size: e.target.value };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                />
              </div>
              <div>
                <span className="text-gray-400">Priority:</span>
                <input
                  value={editableStory?.priority || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return { ...prev, priority: e.target.value };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                />
              </div>
              <div>
                <span className="text-gray-400">Acceptance Criteria:</span>
                <textarea
                  value={editableStory?.acceptanceCriteria?.join("\n") || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        acceptanceCriteria: e.target.value.split("\n").map(item => item.trim()).filter(item => item !== '')
                      };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                  rows={8}
                />
              </div>
              <div>
                <span className="text-gray-400">Labels/Tags:</span>
                <textarea
                  value={editableStory?.tags?.join("\n") || ''}
                  onChange={(e) => {
                    setEditableStory(prev => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        tags: e.target.value.split("\n").map(item => item.trim()).filter(item => item !== '')
                      };
                    });
                  }}
                  className="w-full mt-1  text-white p-2 rounded-md border border-gray-600"
                  rows={8}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-gray-400">User Story ID:</span>{" "}
                <span className="text-white">{updatedStory.usid}</span>
              </div>
              <div>
                <span className="text-gray-400">Title:</span>{" "}
                <span className="text-white">{updatedStory.title}</span>
              </div>
              <div>
                <span className="text-gray-400">Role:</span>{" "}
                <span className="text-white">{updatedStory.role}</span>
              </div>
              <div>
                <span className="text-gray-400">Story:</span>{" "}
                <span className="text-white">{updatedStory.story}</span>
              </div>
              <div>
                <span className="text-gray-400">Description:</span>{" "}
                <span className="text-white">{updatedStory.description}</span>
              </div>
              <div>
                <span className="text-gray-400">T-shirt Size:</span>{" "}
                <span className="text-white">{updatedStory.tshirt_size}</span>
              </div>
              <div>
                <span className="text-gray-400">Priority:</span>{" "}
                <span className="text-white">{updatedStory.priority}</span>
              </div>
              <div>
                <span className="text-gray-400">Acceptance Criteria:</span>
                <ul className="list-disc pl-5 text-white mt-1 space-y-1">
                  {updatedStory.acceptanceCriteria.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-gray-400">Labels/Tags:</span>
                <ul className="list-disc pl-5 text-white mt-1 space-y-1">
                  {updatedStory.tags.map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* Feedback Input Section - Always visible in refine mode */}
    <div className="border-t border-gray-700 pt-2">
      <div className="p-2  rounded-md">
       <div className="p-2 rounded-md bg-gray-900" style={{ backgroundColor: '#2E2E2E' }}>
  <div className="flex items-center justify-between mb-1">
    <span className="text-gray-400 text-xs font-medium">Suggest Improvements</span>
    <button
      onClick={() => {
        setFeedback('');
        setUpdatedStory(null);
        setIsEditing(false);
        setEditableStory(null);
      }}
      className="text-gray-400 hover:text-white transition-colors text-lg"
      aria-label="Clear feedback"
    >
      ×
    </button>
  </div>
  <div className="relative mb-2">
    <input
      type="text"
      placeholder="Type your feedback..."
      value={feedback}
      onChange={(e) => setFeedback(e.target.value)}
      className="w-full pr-16 pl-3 py-1.5 rounded border border-gray-700 dark:border-gray-700 bg-black text-white dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
      style={{
        backgroundColor: '#000000',
        color: 'var(--input-text, #f9fafb)'
      }}
      aria-label="Feedback input"
    />
    <button
      onClick={handleVoiceInput}
      className={`absolute right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${
        listening ? "bg-red-600 dark:bg-red-600" : "bg-gray-700 dark:bg-gray-700"
      } text-white transition duration-200 ease-in-out hover:scale-105 hover:shadow-md`}
      aria-label="Voice input"
      title="Voice input"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>
    <button
      onClick={handleRefineSubmit}
      disabled={loading || !feedback.trim()}
      className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-purple-600 text-white transition duration-200 ease-in-out
        ${!loading && "hover:scale-105 hover:shadow-md"} 
        ${sendClicked ? "animate-ping" : ""}
      `}
      aria-label="Send feedback"
      title="Send"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </button>
  </div>
</div>
        
        {/* Buttons inside the input box */}
        {updatedStory && (
          <div className="flex justify-end gap-1 mt-2 pt-1 border-t border-gray-700">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditableStory(null);
                  }}
                  className="text-white hover:text-black bg-[#2E2E2E] hover:bg-[#E5E5E5] px-2 py-1.5 rounded text-xs transition-colors duration-200"
                >
                  Cancel Edit
                </button>
                <button
                  onClick={() => {
                    if (editableStory) {
                      setUpdatedStory(editableStory);
                      setIsEditing(false);
                      setEditableStory(null);
                      setShowDialogMessage("Feedback saved successfully");
                      setTimeout(() => setShowDialogMessage(""), 3000);
                    }
                  }}
                  className="text-white hover:text-black bg-[#2E2E2E] hover:bg-[#E5E5E5] px-2 py-1.5 rounded text-xs transition-colors duration-200"
                >
                  Save Edits
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditableStory({
                      ...updatedStory,
                      acceptanceCriteria: [...updatedStory.acceptanceCriteria],
                      tags: [...updatedStory.tags]
                    });
                  }}
                  className="text-white hover:text-black bg-[#2E2E2E] hover:bg-[#E5E5E5] px-2 py-1.5 rounded text-xs transition-colors duration-200"
                >
                  Edit
                </button>
                <button
                  onClick={handleRefineSave}
                  disabled={!updatedStory}
                  className="text-white hover:text-black disabled:text-white disabled:hover:text-white bg-[#2E2E2E] hover:bg-[#E5E5E5] disabled:hover:bg-[#2E2E2E] px-2 py-1.5 rounded text-xs disabled:opacity-50 transition-colors duration-200"
                >
                  Save
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
)}
          </>
        );
      })()}
    </div>
  </DialogContent>
</Dialog>
    </>
  );
}