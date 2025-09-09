'use client';

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { BrushCleaning, ChevronDown, ChevronsUpDown, ChevronUp, CircleCheck, EllipsisVertical, FunnelX, SquarePen } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

interface Requirement {
  requirement_id: string;
  requirement_text: string;
  original_text: string;
  page_number: number | null;
  line_number: number | null;
  source_section: string;
  requirement_type: string;
  sub_category: string;
  confidence_score: number;
  stakeholders: string[];
}

interface ClassifierTabProps {
  goTovalidator: (validatedData: any[]) => void;
  classifiedData: Requirement[];
  fullClassifiedPayload: { classified_requirements: Requirement[] };
  fullExtractedPayload: { extracted_requirements: any[] };
  editingId: string | null;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  onUpdateClassifiedData: (updated: Requirement[]) => void;
}

export default function ClassifierTab({
  goTovalidator,
  classifiedData,
  fullClassifiedPayload,
  fullExtractedPayload,
  editingId,
  setEditingId,
  onUpdateClassifiedData
}: ClassifierTabProps) {
  const flattenRequirements = () => {
    const items = classifiedData;
    const result = [];

    if (Array.isArray(items)) {
      for (const item of items) {
        result.push({
          id: item.requirement_id,
          description: item.requirement_text,
          confidence: item.confidence_score,
          status: item.confidence_score > 0.8 ? "Valid" : "Invalid",
          original: item.original_text,
          source: item.source_section,
          page: item.page_number,
          line: item.line_number,
          category: item.requirement_type || "Uncategorized",
          subcategory: item.sub_category || "Uncategorized",
          stakeholders: item.stakeholders || [],
        });
      }
    } else {
      console.warn("classifiedData is not an array:", classifiedData);
    }

    return result;
  };

const [requirements, setRequirements] = useState<any[]>([]);

useEffect(() => {
  if (classifiedData && classifiedData.length > 0) {
    setRequirements(flattenRequirements());
  }
}, [classifiedData]);
  // Save requirements to sessionStorage whenever it changes
  // useEffect(() => {
  //   sessionStorage.setItem("classifiedRequirements", JSON.stringify(requirements));
  // }, [requirements]);

  // // Update requirements when classifiedData changes, only if sessionStorage is empty
  // useEffect(() => {
  //   const saved = sessionStorage.getItem("classifiedRequirements");
  //   if (!saved && classifiedData.length > 0) {
  //     setRequirements(flattenRequirements());
  //   }
  // }, [classifiedData]);

  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [subcategoryFilter, setSubCategoryFilter] = useState<string[]>([]);
  const [stakeholderFilter, setStakeholderFilter] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSubCategoryOpen, setIsSubCategoryOpen] = useState(false);
  const [isStakeholderOpen, setIsStakeholderOpen] = useState(false);

const handleUpdate = (id: string, field: string, value: string) => {
  setRequirements((prev) => {
    const updated = prev.map((req) =>
      req.id === id
        ? {
            ...req,
            [field]:
              field === "stakeholders"
                ? value.split(",").map((s) => s.trim())
                : value,
          }
        : req
    );

    // Update parent payload in original format
    const updatedPayload = classifiedData.map((req) =>
      req.requirement_id === id
        ? {
            ...req,
            requirement_text:
              field === "description" ? value : req.requirement_text,
            requirement_type:
              field === "category" ? value : req.requirement_type,
            sub_category:
              field === "subcategory" ? value : req.sub_category,
            stakeholders:
              field === "stakeholders"
                ? value.split(",").map((s) => s.trim())
                : req.stakeholders,
          }
        : req
    );

    onUpdateClassifiedData(updatedPayload);

    return updated;
  });
};

  const filteredRequirements = requirements.filter((req) => {
    const meetsConfidence = req.confidence >= confidenceThreshold;
    const meetsCategory =
      categoryFilter.length === 0 || categoryFilter.includes(req.category);
    const meetsSubCategory =
      subcategoryFilter.length === 0 || subcategoryFilter.includes(req.subcategory);
    const meetsStakeholder =
      stakeholderFilter.length === 0 ||
      stakeholderFilter.some((s) => req.stakeholders.includes(s));
    const meetsId = selectedIds.length === 0 || selectedIds.includes(req.id);
    const meetsSearch =
      searchText.trim() === "" ||
      req.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      req.id.toLowerCase().includes(searchText.toLowerCase());

    return (
      meetsConfidence &&
      meetsCategory &&
      meetsSubCategory &&
      meetsStakeholder &&
      meetsId &&
      meetsSearch
    );
  });

  const totalPages = Math.ceil(filteredRequirements.length / rowsPerPage);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedRequirements = [...filteredRequirements].sort((a, b) => {
    if (!sortKey) return 0;

    const getValue = (obj: typeof a) => {
      switch (sortKey) {
        case "requirement_id":
          return obj.id;
        case "confidence_score":
          return obj.confidence;
        case "category":
          return obj.category;
        case "subcategory":
          return obj.subcategory;
        case "requirement_text":
          return obj.description;
        case "stakeholders":
          return obj.stakeholders.join(", ");
        default:
          return "";
      }
    };

    const valA = getValue(a);
    const valB = getValue(b);

    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }

    return sortOrder === "asc"
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const paginated = sortedRequirements.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const handleValidation = async () => {
    if (!fullClassifiedPayload) return;
    setIsLoading(true);
    try {
      // Compare requirements with original classifiedData to identify changes
      const editedRequirements = requirements.map((req) => {
        const original = classifiedData.find(
          (orig) => orig.requirement_id === req.id
        );
        if (!original) return null;

        // Check if any fields have been edited
        const hasChanges =
          req.description !== original.requirement_text ||
          req.category !== original.requirement_type ||
          req.subcategory !== original.sub_category ||
          JSON.stringify(req.stakeholders) !==
            JSON.stringify(original.stakeholders);

        if (hasChanges) {
          // Return edited data in the original payload format
          return {
            ...original,
            requirement_text: req.description,
            requirement_type: req.category,
            sub_category: req.subcategory,
            stakeholders: req.stakeholders,
          };
        }
        return original; // Return original if no changes
      }).filter((req) => req !== null); // Filter out any null entries

      const payload = {
        classified_requirements: editedRequirements,
      };

      const response = await fetch("http://127.0.0.1:8000/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Validation failed");
      const validatedData = await response.json();
      goTovalidator(validatedData);
    } catch (err) {
      console.error("Validation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!fullExtractedPayload) return;
    setIsRegenerating(true);
    try {
      const response = await fetch("http://127.0.0.1:8000/classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fullExtractedPayload),
      });
      if (!response.ok) throw new Error("Classification failed");
      const data = await response.json();
      setIsRegenerating(false);
      setShowSuccessMessage(true);
      const timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    } catch (err) {
      console.error("Classification error:", err);
      setIsRegenerating(false);
    }
  };

  const totalValidators = requirements.length;
  const uniqueCategories = [...new Set(requirements.map((req) => req.category))];
  const uniqueSubCategories = [
    ...new Set(requirements.map((req) => req.subcategory)),
  ];
  const uniqueStakeholders = useMemo(() => {
    const all = requirements.flatMap((r) => r.stakeholders);
    return [...new Set(all)].sort();
  }, [requirements]);

  const toggleId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <>
      <div className="p-2 gap-2 bg-[#f6f6f6] dark:bg-[#181818] text-black dark:text-white rounded-lg">
        <div className="flex flex-row items-center border-b border-gray-700 px-1 py-1 mt-[-2px]">
          <div>
            <h1 className="text-[16px] font-semibold">Classifier List</h1>
            <p className="text-[12px] text-gray-400">
              Validate {totalValidators} Requirements
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center mt-2">
          <Input
            placeholder="Filter tasks..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-1/4"
          />

          <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="border border-dashed border-gray-400 px-4 py-2 rounded-lg"
              >
                <CirclePlus className="w-4 h-4" /> Category
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 bg-gray-900 border-gray-700 text-white p-4 rounded-lg shadow-xl">
              <ScrollArea className="h-30 w-full pr-2">
                <div className="flex flex-col gap-2">
                  {uniqueCategories.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={categoryFilter.includes(cat)}
                        onCheckedChange={() => {
                          setCategoryFilter((prev) =>
                            prev.includes(cat)
                              ? prev.filter((item) => item !== cat)
                              : [...prev, cat]
                          );
                        }}
                      />
                      <span className="text-white font-medium">{cat}</span>
                    </label>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Popover open={isSubCategoryOpen} onOpenChange={setIsSubCategoryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="border border-dashed border-gray-400 px-4 py-2 rounded-lg"
              >
                <CirclePlus className="w-4 h-4" /> SubCategory
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 bg-gray-900 border-gray-700 text-white p-4 rounded-lg shadow-xl">
              <ScrollArea className="h-30 w-full pr-2">
                <div className="flex flex-col gap-2">
                  {uniqueSubCategories.map((cat) => (
                    <label
                      key={cat}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={subcategoryFilter.includes(cat)}
                        onCheckedChange={() => {
                          setSubCategoryFilter((prev) =>
                            prev.includes(cat)
                              ? prev.filter((item) => item !== cat)
                              : [...prev, cat]
                          );
                        }}
                      />
                      <span className="text-white font-medium">{cat}</span>
                    </label>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Popover open={isStakeholderOpen} onOpenChange={setIsStakeholderOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="border border-dashed border-gray-400 px-4 py-2 rounded-lg"
              >
                <CirclePlus className="w-4 h-4" /> Stakeholder
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2 bg-gray-900 border-gray-700 text-white">
              <ScrollArea className="h-30 w-full pr-2">
                <div className="flex flex-col gap-2">
                  {uniqueStakeholders.map((stakeh) => (
                    <label
                      key={stakeh}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={stakeholderFilter.includes(stakeh)}
                        onCheckedChange={() => {
                          setStakeholderFilter((prev) =>
                            prev.includes(stakeh)
                              ? prev.filter((item) => item !== stakeh)
                              : [...prev, stakeh]
                          );
                        }}
                      />
                      <span className="text-white font-medium">{stakeh}</span>
                    </label>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="border border-dashed border-gray-400 px-4 py-2 rounded-lg flex items-center gap-2 text-black dark:text-white"
              >
                <CirclePlus className="w-4 h-4" /> Req Id
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-25 bg-gray-900 border-gray-700 text-white p-4 rounded-lg shadow-xl">
              <ScrollArea className="h-34 w-full pr-2">
                <div className="flex flex-col gap-2">
                  {requirements.map((req) => (
                    <label
                      key={req.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`checkbox-${req.id}`}
                        checked={selectedIds.includes(req.id)}
                        onCheckedChange={() => toggleId(req.id)}
                      />
                      <span className="text-white font-medium">{req.id}</span>
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="ml-auto text-sm text-black dark:text-white border border-dashed border-gray-400 px-2 py-2"
              >
                Clear Options
                <span>
                  <EllipsisVertical />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg text-sm">
              <DropdownMenuItem
                onClick={() => {
                  setCategoryFilter([]);
                  setSubCategoryFilter([]);
                  setStakeholderFilter([]);
                  setSearchText("");
                  setConfidenceThreshold(0);
                  setSelectedIds([]);
                }}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <RotateCcw className="mr-1 w-4 h-4" /> Clear Filters
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSortKey(null);
                  setSortOrder("asc");
                }}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <FunnelX className="mr-1 w-4 h-4" /> Clear Sort
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCategoryFilter([]);
                  setSubCategoryFilter([]);
                  setStakeholderFilter([]);
                  setSearchText("");
                  setConfidenceThreshold(0);
                  setSelectedIds([]);
                  setSortKey(null);
                  setSortOrder("asc");
                }}
                className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <BrushCleaning className="mr-1 w-4 h-4" /> Clear All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(categoryFilter.length > 0 ||
          subcategoryFilter.length > 0 ||
          stakeholderFilter.length > 0 ||
          selectedIds.length > 0 ||
          confidenceThreshold > 0 ||
          sortKey !== null) && (
          <div className="flex flex-wrap gap-2 px-1 py-1 mb-2 text-xs text-black dark:text-white">
            {categoryFilter.length > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                Category: {categoryFilter.join(", ")}
              </div>
            )}
            {subcategoryFilter.length > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                SubCategory: {subcategoryFilter.join(", ")}
              </div>
            )}
            {stakeholderFilter.length > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                Stakeholders: {stakeholderFilter.join(", ")}
              </div>
            )}
            {selectedIds.length > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                Req IDs: {selectedIds.join(", ")}
              </div>
            )}
            {confidenceThreshold > 0 && (
              <div className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                Confidence ≥ {confidenceThreshold.toFixed(1)}
              </div>
            )}
            {sortKey && (
              <div className="bg-blue-200 dark:bg-blue-700 px-2 py-1 rounded-full">
                Sorted by {sortKey} ({sortOrder})
              </div>
            )}
          </div>
        )}

        <Table>
          <TableHeader className="bg-transparent text-sm text-white">
            <TableRow>
              <TableHead
                className="text-left cursor-pointer w-[100px]"
                onClick={() => toggleSort("requirement_id")}
              >
                <div className="flex items-center gap-1">
                  REQ ID{" "}
                  {sortKey === "requirement_id" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="text-left cursor-pointer w-[120px]"
                onClick={() => toggleSort("category")}
              >
                <div className="flex items-center gap-1">
                  Category
                  {sortKey === "category" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="text-left cursor-pointer w-[120px]"
                onClick={() => toggleSort("subcategory")}
              >
                <div className="flex items-center gap-1">
                  SubCategory
                  {sortKey === "subcategory" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="text-left cursor-pointer w-[120px]"
                onClick={() => toggleSort("confidence_score")}
              >
                <div className="flex items-center gap-1">
                  Confidence{" "}
                  {sortKey === "confidence_score" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="text-left cursor-pointer w-[150px]"
                onClick={() => toggleSort("stakeholders")}
              >
                <div className="flex items-center gap-1">
                  Stakeholder{" "}
                  {sortKey === "stakeholders" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="text-left cursor-pointer w-[200px]"
                onClick={() => toggleSort("requirement_text")}
              >
                <div className="flex items-center gap-1">
                  Description{" "}
                  {sortKey === "requirement_text" ? (
                    sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                    )
                  ) : (
                    <ChevronsUpDown className="w-4 h-4 text-black dark:text-white mt-0.5" />
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>
        <ScrollArea className="overflow-y-hidden h-[250px] mt-2 scrollbar-thin">
          <Table className="h-[100px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
            <TableBody>
              {paginated.map((req, index) => (
                <TableRow
                  key={req.id}
                  className={`text-black dark:text-white text-sm rounded-lg overflow-hidden ${
                    index % 2 === 0
                      ? "bg-[#d0d0d0] dark:bg-[#181818]"
                      : "bg-[#ececec] dark:bg-[#2a2a2a]"
                  }`}
                >
                  <TableCell className="px-4 w-[120px]">{req.id}</TableCell>
                  <TableCell className="px-4 w-[80px]">
                    {editingId === req.id ? (
                      <select
                        value={req.category}
                        onChange={(e) =>
                          handleUpdate(req.id, "category", e.target.value)
                        }
                        className="border rounded p-1 bg-black text-black dark:text-white"
                      >
                        <option value="Functional">Functional</option>
                        <option value="Non-Functional">Non-Functional</option>
                      </select>
                    ) : (
                      req.category
                    )}
                  </TableCell>
                  <TableCell className="px-4 w-[80px]">
                    {editingId === req.id ? (
                      <input
                        type="text"
                        value={req.subcategory}
                        onChange={(e) =>
                          handleUpdate(req.id, "subcategory", e.target.value)
                        }
                        className="border rounded p-1 w-full text-black dark:text-white"
                      />
                    ) : (
                      req.subcategory
                    )}
                  </TableCell>
                  <TableCell className="px-2 w-[120px]">
                    <Badge
                      className={`p-1 text-xs rounded-md ${
                        req.confidence > 0.5
                          ? "bg-[#0B6058] text-[#5AB4B2]"
                          : req.confidence < 0.5
                          ? "bg-[#8E6B74] text-[#83263A]"
                          : "bg-[#86713D] text-[#F7CB9B]"
                      }`}
                    >
                      {req.confidence.toFixed(2)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-2 w-[120px] whitespace-normal break-words">
                    {editingId === req.id ? (
                      <input
                        type="text"
                        value={req.stakeholders.join(", ")}
                        onChange={(e) =>
                          handleUpdate(req.id, "stakeholders", e.target.value)
                        }
                        className="border rounded p-1 w-full dark:text-white text-black"
                      />
                    ) : (
                      req.stakeholders.join(", ")
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal break-words w-[250px] max-w-xs">
                    {editingId === req.id ? (
                      <input
                        type="text"
                        value={req.description}
                        onChange={(e) =>
                          handleUpdate(req.id, "description", e.target.value)
                        }
                        className="border rounded p-1 w-full dark:text-white text-black"
                      />
                    ) : (
                      req.description
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === req.id ? (
                      <Button
                        className="bg-grey-500 text-white px-2 py-1"
                        onClick={() => setEditingId(null)}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        className="bg-blue-600 text-white px-2 py-1"
                        onClick={() => setEditingId(req.id)}
                      >
                        <SquarePen />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar />
        </ScrollArea>
      </div>

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

      <div className="flex justify-between items-center gap-2 mt-2">
        <div className="min-w-[300px] h-[24px] flex items-center">
          {showSuccessMessage && (
            <span className="flex flex-row gap-2 text-sm rounded-md items-center">
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
              Generated classified data
            </span>
          )}
        </div>

        <div className="flex gap-1">
          <Button
            className="bg-white dark:bg-[#0D0D0D] h-8 rounded-md text-black dark:text-white border border-gray-400"
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
            className="bg-black dark:bg-white h-8 rounded-md text-white dark:text-black"
            disabled={isLoading}
            onClick={handleValidation}
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
                Validating...
              </span>
            ) : (
              "Validate"
            )}
          </Button>
        </div>
      </div>
    </>
  );
}