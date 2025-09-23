'use client';

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BrushCleaning, ChevronDown, ChevronsUpDown, ChevronUp, CircleCheck, EllipsisVertical, FunnelX, Eye } from 'lucide-react';
import { Download } from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { RotateCcw, CirclePlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfidenceBadge } from "./ConfidenceBadge";

type GherkinScenario = {
  name: string;
  steps: string[];
};

type TestCaseEntry = {
  test_id: string;
  title: string;
  precondition: string;
  steps: string[];
  expected_result: string;
  priority: string;
  tags: string[];
};

type UserStoryEntry = {
  user_story_id: string;
  user_story: string;
  acceptance_criteria: string[];
  test_cases: TestCaseEntry[];
};

type Requirement = {
  requirement_id: string;
  requirement_text: string;
  requirement_type: string;
  confidence_score: number;
  llm_check_passed: boolean;
  validation_issues: string[];
  gherkin_feature: string;
  gherkin_scenarios: GherkinScenario[];
  user_stories: UserStoryEntry[];
  test_cases: TestCaseEntry[];
};

const handleDownload = (reqs: Requirement[]) => {
  const jsonData = reqs.map(r => ({
    "REQ ID": r.requirement_id,
    "Requirement Text": r.requirement_text,
    "Requirement Type": r.requirement_type,
    "Confidence Level": r.confidence_score,
    "Validation Issues": r.validation_issues,
    "User Stories": r.user_stories.map(us => us.user_story),
    "Acceptance Criteria": r.user_stories.flatMap(us => us.acceptance_criteria),
    "Test Cases": r.test_cases,
    "Gherkin Feature": r.gherkin_feature,
    "Gherkin Scenario": r.gherkin_scenarios
  }));

  const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Traceability_Matrix.json';
  link.click();
  URL.revokeObjectURL(url);
};

interface TraceabilityTabProps {
  goToLogs: () => void;
  traceabilityData: Requirement[];
  combinedPayload: {
    classified_requirements: any[];
    validated_requirements: any[];
    user_stories: any[];
    gherkin_scenarios: any[];
    test_cases: any[];
  };
}

export default function TraceabilityTab({ goToLogs, traceabilityData, combinedPayload }: TraceabilityTabProps) {
  const [requirements, setRequirements] = useState<Requirement[]>(traceabilityData);
  const [requirementTypeFilter, setRequirementTypeFilter] = useState<string[]>([]);
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const selectedReqsForDownload = requirements.filter((req) => checkedMap[req.requirement_id]);
  const isDownloadEnabled = Object.values(checkedMap).some(Boolean);

  const toggleDownloadCheckbox = (id: string) => {
    setCheckedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [showSuccess, setShowSuccess] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSuccess(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const toggleSelectAllDownloadCheckboxes = (checked: boolean) => {
    const newMap: Record<string, boolean> = {};
    requirements.forEach((req) => {
      newMap[req.requirement_id] = checked;
    });
    setCheckedMap(newMap);
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [typeFilter, setTypeFilter] = useState("All");

  const filteredRequirements = requirements.filter((req) => {
    const meetsId = selectedIds.length === 0 || selectedIds.includes(req.requirement_id);
    const meetsType = typeFilter === "All" || req.requirement_type === typeFilter;
    const meetsSearch =
      searchText.trim() === "" ||
      req.requirement_text.toLowerCase().includes(searchText.toLowerCase()) ||
      req.requirement_type.toLowerCase().includes(searchText.toLowerCase()) ||
      req.requirement_id.toLowerCase().includes(searchText.toLowerCase()) ||
      req.user_stories?.some(us =>
        us.user_story?.toLowerCase().includes(searchText.toLowerCase()) ||
        us.acceptance_criteria?.some(ac =>
          ac.toLowerCase().includes(searchText.toLowerCase())
        ) ||
        req.test_cases?.some(tc =>
          JSON.stringify(tc).toLowerCase().includes(searchText.toLowerCase())
        )
      ) ||
      req.validation_issues.some(issue => issue.toLowerCase().includes(searchText.toLowerCase())) ||
      req.gherkin_feature.toLowerCase().includes(searchText.toLowerCase()) ||
      req.gherkin_scenarios.some((scenario: { name: string; steps: string[] }) =>
        scenario.name.toLowerCase().includes(searchText.toLowerCase()) ||
        scenario.steps.some((step: string) =>
          step.toLowerCase().includes(searchText.toLowerCase())
        )
      ) || req.confidence_score.toString().includes(searchText.toLowerCase());
    return meetsId && meetsSearch && meetsType;
  });

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const totalPages = Math.ceil(filteredRequirements.length / rowsPerPage);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedRequirements = [...filteredRequirements].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const aVal = a[key as keyof typeof a] || "";
    const bVal = b[key as keyof typeof b] || "";
    const comparison = aVal.toString().localeCompare(bVal.toString());
    return direction === "asc" ? comparison : -comparison;
  });

  const uniqueTypes = [...new Set(requirements.map((req) => req.requirement_type))];

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegenerate = async () => {
    if (!combinedPayload) return;
    setIsLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/test_cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(combinedPayload),
      });
      if (!response.ok) throw new Error("Validation failed");
      const data = await response.json();
      setRequirements(data.traceability || traceabilityData);
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setIsLoading(false);
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    }
  };

  const selectedVisibleCount = filteredRequirements.filter(req => checkedMap[req.requirement_id]).length;

  return (
    <>
      <div className="p-2 gap-2 h-93 bg-[#f6f6f6] dark:bg-[#181818] text-black dark:text-white rounded-lg">
        <div className="flex flex-row justify-between border-b border-gray-700">
          <div className="flex flex-col">
            <h1 className="text-[16px] font-semibold">Traceability</h1>
            <p className="text-[12px] text-gray-400">Validate {requirements.length} Requirements</p>
          </div>
          <Button
            className="bg-white text-black dark:bg-white dark:text-black text-xs rounded-md border border-gray-500"
            onClick={() => handleDownload(selectedReqsForDownload)}
            disabled={!isDownloadEnabled}
          >
            <Download className="w-2 h-2" /> Traceability Matrix
          </Button>
        </div>

        <div className="flex gap-2 items-center mt-2">
          <Input
            placeholder="Filter tasks..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-1/4"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="border border-dashed border-gray-400 px-4 py-2 rounded-lg flex items-center gap-2 text-black dark:text-white"
              >
                <CirclePlus className="w-4 h-4" /> Req Id
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-27 bg-gray-900 border-gray-700 text-white p-4 rounded-lg shadow-xl">
              <ScrollArea className="h-34 w-full pr-2">
                <div className="flex flex-col gap-2">
                  {requirements.map((req) => (
                    <label key={req.requirement_id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`checkbox-${req.requirement_id}`}
                        checked={selectedIds.includes(req.requirement_id)}
                        onCheckedChange={() => toggleId(req.requirement_id)}
                      />
                      <span className="text-white font-medium">{req.requirement_id}</span>
                    </label>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Popover open={isTypeOpen} onOpenChange={setIsTypeOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="border border-dashed border-gray-400 px-4 py-2 rounded-lg">
                <CirclePlus className="w-4 h-4" /> Category
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0 bg-gray-900 border-gray-700 text-white">
              <Command>
                <CommandGroup>
                  {["All", ...uniqueTypes].map((option) => (
                    <CommandItem
                      key={option}
                      onSelect={() => { setTypeFilter(option); setIsTypeOpen(false); }}
                      className={typeFilter === option ? "bg-gray-700 text-white" : ""}
                    >
                      {option}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="ml-auto text-sm text-black dark:text-white border border-dashed border-gray-500 px-3 py-2">
                Clear Options <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40 text-black dark:text-white border border-gray-700">
              <DropdownMenuItem onClick={() => {
                setSearchText("");
                setSelectedIds([]);
                setTypeFilter("All");
              }}>
                <RotateCcw className="mr-1 w-4 h-4" /> Clear Filters
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortConfig(null)}>
                <FunnelX /> Clear Sort
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setSearchText("");
                setSelectedIds([]);
                setSortConfig(null);
                setTypeFilter("All");
                setCheckedMap({});
              }}>
                <BrushCleaning /> Clear All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(selectedIds.length > 0 || searchText !== "" || sortConfig !== null) && (
          <div className="flex flex-wrap gap-2 px-1 py-1 mb-2 text-xs text-black dark:text-white">
            {selectedIds.length > 0 && (
              <div className="bg-purple-800 text-white px-2 py-1 rounded-full">
                Req IDs: {selectedIds.join(", ")}
              </div>
            )}
            {searchText !== "" && (
              <div className="bg-green-800 text-white px-2 py-1 rounded-full">
                Search: "{searchText}"
              </div>
            )}
            {sortConfig && (
              <div className="bg-blue-800 text-white px-2 py-1 rounded-full">
                Sorted by {sortConfig.key} ({sortConfig.direction})
              </div>
            )}
          </div>
        )}

        <div className="w-full h-60 flex flex-col">
          <div className="border flex flex-col overflow-hidden scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 rounded-lg">
            <Table className="min-w-[2200px] text-sm text-left text-white">
              <TableHeader className="sticky top-0 z-10 bg-white dark:bg-[#111111] text-black dark:text-white">
                <TableRow>
                  <TableHead onClick={() => handleSort("requirement_id")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      REQ ID
                      {sortConfig?.key === "requirement_id" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("requirement_text")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      Requirement Text
                      {sortConfig?.key === "requirement_text" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("requirement_type")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      Requirement Type
                      {sortConfig?.key === "requirement_type" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("confidence_score")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      Confidence Level
                      {sortConfig?.key === "confidence_score" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("validation_issues")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      Validation Issues
                      {sortConfig?.key === "validation_issues" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("user_stories")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      User Stories
                      {sortConfig?.key === "user_stories" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-2">
                    Test Cases
                  </TableHead>
                  <TableHead onClick={() => handleSort("acceptance_criteria")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      Acceptance Criteria
                      {sortConfig?.key === "acceptance_criteria" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("gherkin_feature")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      Gherkin Feature
                      {sortConfig?.key === "gherkin_feature" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort("gherkin_scenarios")} className="px-4 py-2 cursor-pointer">
                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                      Gherkin Scenario
                      {sortConfig?.key === "gherkin_scenarios" ? (
                        sortConfig.direction === "asc" ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        className="bg-white border border-gray-500 dark:border dark:border-gray-900 dark:bg-[#414143] dark:text-black"
                        checked={
                          requirements.length > 0 &&
                          Object.values(checkedMap).length === requirements.length &&
                          Object.values(checkedMap).every(Boolean)
                        }
                        onCheckedChange={(checked) => toggleSelectAllDownloadCheckboxes(!!checked)}
                      />
                      Extract Requirements
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedRequirements
                  .slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
                  .map((req, index) => (
                    <TableRow
                      key={req.requirement_id}
                      className={`text-black dark:text-white text-sm rounded-lg overflow-hidden ${
                        index % 2 === 0 ? 'bg-[#d0d0d0] dark:bg-[#181818]' : 'bg-[#ececec] dark:bg-[#2a2a2a]'
                      }`}
                    >
                      <TableCell className="px-4 py-2 align-top">{req.requirement_id}</TableCell>
                      <TableCell className="px-4 py-2 align-top whitespace-normal break-words max-w-xs">{req.requirement_text}</TableCell>
                      <TableCell className="px-4 py-2 align-top">{req.requirement_type}</TableCell>
                      <TableCell className="px-4 py-2 align-top">
                        <ConfidenceBadge confidence={req.confidence_score} />
                      </TableCell>
                      <TableCell className="px-4 py-2 align-top whitespace-normal break-words max-w-xs">
                        {req.validation_issues.length > 0 ? req.validation_issues.join(", ") : "The requirement is clearly defined and testable."}
                      </TableCell>
                      <TableCell className="px-4 py-2 align-top whitespace-normal break-words max-w-xs">
                        {req.user_stories?.map((us, i) => (
                          <div key={i} className="mb-2">
                            <div className="font-medium">{us.user_story_id}: {us.user_story}</div>
                            {us.acceptance_criteria.length > 0 && (
                              <ul className="list-disc pl-4 text-sm">
                                {us.acceptance_criteria.map((ac, idx) => (
                                  <li key={idx}>{ac}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </TableCell>
                    <TableCell className="px-4 py-2 align-top whitespace-normal break-words max-w-md">
  {req.test_cases?.length > 0 ? (
    <div className="text-sm">
      {req.test_cases.map((testCase, index) => (
        <div key={index} className="mb-4 border-b pb-2 last:border-b-0">
          <div className="font-medium text-sm mb-1">
            {testCase.test_id}: {testCase.title}
          </div>
          <div className="text-sm">
            <strong>Precondition:</strong> {testCase.precondition}
          </div>
          <div className="text-sm mt-1">
            <strong>Steps:</strong>
            <ol className="list-decimal pl-5">
              {testCase.steps.map((step, stepIndex) => (
                <li key={stepIndex} className="text-sm">{step}</li>
              ))}
            </ol>
          </div>
          <div className="text-sm mt-1">
            <strong>Expected Result:</strong> {testCase.expected_result}
          </div>
          <div className="text-sm mt-1">
            <strong>Priority:</strong> {testCase.priority}
          </div>
          <div className="text-sm mt-1">
            <strong>Tags:</strong> {testCase.tags.join(", ")}
          </div>
        </div>
      ))}
    </div>
  ) : (
    "No test cases available."
  )}
</TableCell>
                      <TableCell className="px-4 py-2 align-top whitespace-normal break-words max-w-xs">
                        {req.user_stories?.flatMap(us => us.acceptance_criteria).length > 0 ? (
                          <ul className="list-disc pl-4 text-sm">
                            {req.user_stories.flatMap(us => us.acceptance_criteria).map((ac, idx) => (
                              <li key={idx}>{ac}</li>
                            ))}
                          </ul>
                        ) : (
                          "No acceptance criteria available."
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-2 align-top whitespace-normal break-words max-w-xs">{req.gherkin_feature}</TableCell>
                      <TableCell className="px-4 py-2 align-top whitespace-normal break-words max-w-xs">
                        {req.gherkin_scenarios?.map((scenario, index) => (
                          <div key={index} className="mb-2">
                            <div className="font-medium">{scenario.name}</div>
                            <ul className="list-disc pl-4 text-sm text-[#bababa]">
                              {scenario.steps.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="align-top px-4 py-2">
                        <div className="flex">
                          <Checkbox
                            className="border border-gray-500 dark:border-gray-900 dark:bg-[#414143] dark:text-black"
                            checked={!!checkedMap[req.requirement_id]}
                            onCheckedChange={() => toggleDownloadCheckbox(req.requirement_id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex justify-between items-center h-9 border-b border-gray-700 text-sm bg-[#f6f6f6] dark:bg-black text-black dark:text-white">
          <div className="text-black dark:text-gray-400 m-1.5">
            {`${selectedVisibleCount} of ${filteredRequirements.length} row(s) selected.`}
          </div>
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
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50">&laquo;</button>
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50">&lsaquo;</button>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50">&rsaquo;</button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 rounded border border-gray-600 disabled:opacity-50">&raquo;</button>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center gap-2 mt-2">
          <div className="min-h-[24px] flex items-center">
            {showSuccess && (
              <span className="flex flex-row gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 30.266 30.266" className="mt-1">
                  <path d="M30.266,15.133A15.133,15.133,0,1,1,15.133,0,15.133,15.133,0,0,1,30.266,15.133ZM22.756,9.4a1.419,1.419,0,0,0-2.043.042l-6.57,8.37-3.959-3.961a1.419,1.419,0,0,0-2.005,2.005l5.005,5.007a1.419,1.419,0,0,0,2.041-.038l7.551-9.439A1.419,1.419,0,0,0,22.758,9.4Z" fill="#24d304" />
                </svg>
                Traceability generated Successfully!
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-white dark:bg-[#0D0D0D] text-black dark:text-white border border-gray-400"
              disabled={filteredRequirements.length === 0 || isLoading}
              onClick={handleRegenerate}
            >
              {isLoading ? (
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
          </div>
        </div>
      </div>
    </>
  );
}