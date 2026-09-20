"use client";

import { useState } from "react";

export default function AddRolePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const response = await fetch("/api/roles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description,
        requirements,
      }),
    });

    const data = await response.json();

    console.log(data);
  }

  return (
    <main>
      <h1>Add Role</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Role Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <h1>Description</h1>

        <input
          type="text"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <h1>Requirements</h1>

        <input
          type="text"
          placeholder="skills, experience, education"
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
        />

        <button type="submit">
          Save Role
        </button>
      </form>
    </main>
  );
}