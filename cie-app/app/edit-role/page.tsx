"use client";

import Link from "vinext/shims/link";
import { useEffect, useState } from "react";

type Role = { id: number; name: string; description: string; requirements: string };
type Competency = { id: string; description: string };
type Skill = { id: string; name: string; competencies: Competency[] };

const newId = () => crypto.randomUUID();

export default function EditRolePage() {
  const [id, setId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRole() {
      try {
        const roleId = Number(new URLSearchParams(window.location.search).get("id"));
        if (!Number.isInteger(roleId) || roleId <= 0) throw new Error("Invalid role id.");

        const [roleResponse, skillsResponse] = await Promise.all([
          fetch("/api/roles"),
          fetch(`/api/role-skills?roleId=${roleId}`),
        ]);
        if (!roleResponse.ok) throw new Error("Could not load the role.");
        if (!skillsResponse.ok) throw new Error("Could not load the role skills.");

        const roleData = (await roleResponse.json()) as { roles: Role[] };
        const skillsData = (await skillsResponse.json()) as { skills: Skill[] };
        const role = roleData.roles.find((item) => item.id === roleId);
        if (!role) throw new Error("Role not found.");

        setId(role.id);
        setName(role.name);
        setDescription(role.description ?? "");
        setRequirements(role.requirements ?? "");
        setSkills(skillsData.skills);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load the role.");
      } finally {
        setLoading(false);
      }
    }
    loadRole();
  }, []);

  function addSkill() {
    setSkills((current) => [
      ...current,
      { id: newId(), name: "", competencies: [{ id: newId(), description: "" }] },
    ]);
  }

  function updateSkill(skillId: string, value: string) {
    setSkills((current) => current.map((skill) =>
      skill.id === skillId ? { ...skill, name: value } : skill,
    ));
  }

  function removeSkill(skillId: string) {
    setSkills((current) => current.filter((skill) => skill.id !== skillId));
  }

  function addCompetency(skillId: string) {
    setSkills((current) => current.map((skill) =>
      skill.id === skillId
        ? { ...skill, competencies: [...skill.competencies, { id: newId(), description: "" }] }
        : skill,
    ));
  }

  function updateCompetency(skillId: string, competencyId: string, value: string) {
    setSkills((current) => current.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            competencies: skill.competencies.map((competency) =>
              competency.id === competencyId ? { ...competency, description: value } : competency,
            ),
          }
        : skill,
    ));
  }

  function removeCompetency(skillId: string, competencyId: string) {
    setSkills((current) => current.map((skill) =>
      skill.id === skillId && skill.competencies.length > 1
        ? { ...skill, competencies: skill.competencies.filter((item) => item.id !== competencyId) }
        : skill,
    ));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (id === null) return;
    setSaving(true);
    setError("");

    try {
      const roleResponse = await fetch("/api/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, description, requirements }),
      });
      const roleData = (await roleResponse.json()) as { error?: string };
      if (!roleResponse.ok) throw new Error(roleData.error || "Could not update the role.");

      const skillsResponse = await fetch("/api/role-skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: id, skills }),
      });
      const skillsData = (await skillsResponse.json()) as { error?: string };
      if (!skillsResponse.ok) throw new Error(skillsData.error || "Could not update the skills.");

      window.location.href = "/";
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update the role.");
      setSaving(false);
    }
  }

  return (
    <main className="role-form-page">
      <div className="form-page-header">
        <div>
          <h1>Edit Role</h1>
          <p>Define this role and the competencies required for each skill.</p>
        </div>
        <Link href="/">Back to roles</Link>
      </div>

      {loading && <p>Loading role...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && id !== null && (
        <form className="role-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <h2>Role details</h2>
            <label>Role Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label>Requirements<textarea value={requirements} onChange={(event) => setRequirements(event.target.value)} /></label>
          </section>

          <section className="form-section">
            <div className="section-heading">
              <div>
                <h2>Skills & competencies</h2>
                <p>Add each skill, then list the competencies expected for this role level.</p>
              </div>
            </div>

            {skills.length === 0 && (
              <div className="empty-skills">
                <p>No skills added yet.</p>
                <button className="secondary-button" type="button" onClick={addSkill}>Add the first skill</button>
              </div>
            )}

            <div className="skills-list">
              {skills.map((skill, skillIndex) => (
                <article className="skill-card" key={skill.id}>
                  <div className="skill-card-header">
                    <span className="skill-number">Skill {skillIndex + 1}</span>
                    <button className="danger-link" type="button" onClick={() => removeSkill(skill.id)}>Remove skill</button>
                  </div>
                  <label>
                    Skill name
                    <input value={skill.name} onChange={(event) => updateSkill(skill.id, event.target.value)} placeholder="e.g. Types of estimating" required />
                  </label>
                  <div className="competencies-heading">
                    <strong>Competencies</strong><span>Minimum 1 required</span>
                  </div>
                  <div className="competency-list">
                    {skill.competencies.map((competency, competencyIndex) => (
                      <div className="competency-row" key={competency.id}>
                        <span>{competencyIndex + 1}.</span>
                        <input
                          aria-label={`Competency ${competencyIndex + 1} for ${skill.name || `skill ${skillIndex + 1}`}`}
                          value={competency.description}
                          onChange={(event) => updateCompetency(skill.id, competency.id, event.target.value)}
                          placeholder="e.g. Rough order of magnitude (ROM)"
                          required
                        />
                        <button
                          className="icon-button"
                          type="button"
                          aria-label="Remove competency"
                          title={skill.competencies.length === 1 ? "Each skill needs at least one competency" : "Remove competency"}
                          disabled={skill.competencies.length === 1}
                          onClick={() => removeCompetency(skill.id, competency.id)}
                        >×</button>
                      </div>
                    ))}
                  </div>
                  <button className="add-competency-button" type="button" onClick={() => addCompetency(skill.id)}>+ Add competency</button>
                </article>
              ))}
            </div>

            {skills.length > 0 && (
              <button className="secondary-button add-skill-button" type="button" onClick={addSkill}>
                + Add another skill
              </button>
            )}
          </section>

          <div className="role-form-actions">
            <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Role"}</button>
            <Link href="/">Cancel</Link>
          </div>
        </form>
      )}
    </main>
  );
}
