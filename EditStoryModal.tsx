import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

type Story = {
  usid: string;
  title: string;
  role: string;
  story: string;
  description: string;
  acceptanceCriteria: string[];
  tshirt_size: string;
  priority: string;
  tags: string[];
  confidence?: number;
};

interface EditStoryModalProps {
  story: Story;
  onClose: () => void;
  onSave: (updatedStory: Story) => void;
}

export default function EditStoryModal({ story, onClose, onSave }: EditStoryModalProps) {
  const [editedStory, setEditedStory] = useState<Story>(story);

  useEffect(() => {
    setEditedStory(story);
  }, [story]);

  const handleChange = (field: keyof Story, value: string | string[]) => {
    setEditedStory((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 text-white max-w-3xl w-full max-h-[90vh] flex flex-col rounded-lg p-0">
        <DialogHeader className="sticky top-0 bg-gray-900 z-10 border-b border-gray-700 px-6 py-4">
          <DialogTitle>Edit User Story</DialogTitle>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
        <DialogFooter className="bg-gray-900 border-t border-gray-700 px-6 py-4">
          <Button onClick={() => onSave(editedStory)}>Save</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}