import { apiClient } from "@/lib/auth-client";
import { normalizeApiError, toHttpError } from "@/lib/error";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/clip/new")({
  component: ClipNew,
});

function ClipNew() {
  const [data, setData] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      const response = await apiClient.api.clips.$post({
        json: {
          data: {
            messages: JSON.parse(data),
          },
        },
      });

      if (!response.ok) {
        throw toHttpError(response);
      }

      const { id } = await response.json();
      navigate({ to: `/clip/${id}` });
    } catch (error) {
      console.error("Failed to create clip", normalizeApiError(error));
    }
  };

  return (
    <div className="p-4">
      <h1 className="mb-4 font-bold text-2xl">Create New Clip</h1>
      <textarea
        value={data}
        onChange={(e) => setData(e.target.value)}
        placeholder="Paste your message content here"
        className="h-64 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        Create Clip
      </button>
    </div>
  );
}
