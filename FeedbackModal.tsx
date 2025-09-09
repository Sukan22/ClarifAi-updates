import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState, useRef } from "react";
import { Send, Mic } from "lucide-react";

interface FeedbackModalProps {
  story: {
    usid: string;
    title: string;
    role: string;
    story: string;
    description: string;
    tshirt_size: string;
    priority: string;
    tags: string[];
    acceptanceCriteria: string[];
    [key: string]: any;
  };
  onClose: () => void;
  onUpdate: (updatedStory: any) => void;
}

export default function FeedbackModal({ story, onClose, onUpdate }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendClicked, setSendClicked] = useState(false);
  const [updatedStory, setUpdatedStory] = useState<any>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timeroutRef = useRef<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editableStory, setEditableStory] = useState<any>(null);

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    setLoading(true);
    setSendClicked(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/update-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story, feedback }),
      });

      const updated = await res.json();
      setUpdatedStory(updated.updated_story || updated);
      setEditableStory(updated.updated_story || updated);
      setFeedback("");
    } catch (err) {
      console.error("LLM update failed:", err);
    } finally {
      setLoading(false);
      setTimeout(() => setSendClicked(false), 300);
    }
  };

  const handleSave = () => {
    onUpdate({ updated_story: editableStory });
    onClose();
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
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1a1a] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Suggest Improvements</DialogTitle>
          <DialogDescription className="bg-[#1a1a1a] text-white max-h-[calc(100vh-4rem)] overflow-y-auto">
            Share feedback to refine the story using AI.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <input
            type="text"
            placeholder="Type your feedback..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full pr-20 pl-4 py-2 rounded-md border border-gray-700 bg-gray-900 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label="Feedback input"
          />
          <button
            onClick={handleVoiceInput}
            className={`absolute right-10 top-1/2 -translate-y-1/2 p-2 rounded-full ${
              listening ? "bg-red-600" : "bg-gray-700"
            } text-white transition duration-200 ease-in-out hover:scale-105 hover:shadow-md`}
            aria-label="Voice input"
            title="Voice input"
          >
            <Mic className="w-4 h-4" />
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !feedback.trim()}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-purple-600 text-white transition duration-200 ease-in-out
              ${!loading && "hover:scale-105 hover:shadow-md"} 
              ${sendClicked ? "animate-ping" : ""}
            `}
            aria-label="Send feedback"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {updatedStory && (
          <div className="mt-6 p-4 border border-gray-700 rounded-md bg-gray-900 text-sm space-y-3 max-h-[60vh] overflow-y-auto">
            {isEditing ? (
              <>
                <div>
                  <span className="text-gray-400">User Story ID:</span>
                  <input
                    value={editableStory.usid}
                    onChange={(e) =>
                      setEditableStory({ ...editableStory, usid: e.target.value })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                  />
                </div>
                <div>
                  <span className="text-gray-400">Title:</span>
                  <input
                    value={editableStory.title}
                    onChange={(e) =>
                      setEditableStory({ ...editableStory, title: e.target.value })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                  />
                </div>
                <div>
                  <span className="text-gray-400">Role:</span>
                  <input
                    value={editableStory.role}
                    onChange={(e) =>
                      setEditableStory({ ...editableStory, role: e.target.value })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                  />
                </div>
               
                <div>
                  <span className="text-gray-400">Story:</span>
                  <textarea
                    value={editableStory.story}
                    onChange={(e) =>
                      setEditableStory({ ...editableStory, story: e.target.value })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                    rows={3}
                  />
                </div>
                 <div>
                  <span className="text-gray-400">Description:</span>
                  <textarea
                    value={editableStory.description}
                    onChange={(e) =>
                      setEditableStory({ ...editableStory, description: e.target.value })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                    rows={3}
                  />
                </div>
                <div>
                  <span className="text-gray-400">T-shirt Size:</span>
                  <input
                    value={editableStory.tshirt_size}
                    onChange={(e) =>
                      setEditableStory({ ...editableStory, tshirt_size: e.target.value })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                  />
                </div>
                <div>
                  <span className="text-gray-400">Priority:</span>
                  <input
                    value={editableStory.priority}
                    onChange={(e) =>
                      setEditableStory({ ...editableStory, priority: e.target.value })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                  />
                </div>
                <div>
                  <span className="text-gray-400">Acceptance Criteria:</span>
                  <textarea
                    value={editableStory.acceptanceCriteria.join("\n")}
                    onChange={(e) =>
                      setEditableStory({
                        ...editableStory,
                        acceptanceCriteria: e.target.value.split("\n"),
                      })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                    rows={8}
                  />
                </div>
                <div>
                  <span className="text-gray-400">Labels/Tags:</span>
                  <textarea
                    value={editableStory.tags.join("\n")}
                    onChange={(e) =>
                      setEditableStory({
                        ...editableStory,
                        tags: e.target.value.split("\n"),
                      })
                    }
                    className="w-full mt-1 bg-gray-800 text-white p-2 rounded-md border border-gray-700"
                    rows={8}
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4 sticky bottom-0 bg-transparent-900 py-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setUpdatedStory(editableStory);
                      setIsEditing(false);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                  >
                    Save Edits
                  </button>
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
                <div className="flex justify-end gap-2 mt-4 sticky bottom-0 bg-transparent-900 py-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-md"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                  >
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}