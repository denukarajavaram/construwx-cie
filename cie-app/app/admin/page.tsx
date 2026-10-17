"use client";

import Link from "vinext/shims/link";
import { useEffect, useState } from "react";

type Role = {
  id: number;
  name: string;
  description: string;
  skills: Array<{
    id: string;
    name: string;
    competencies: Array<{ id: string; description: string }>;
  }>;
};

export default function Home() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function deleteRole(role: Role) {
    if (deletingId !== null) return;
    if (!window.confirm('Delete "' + role.name + '" and all its skills and competencies?')) return;
    setDeletingId(role.id);
    setDeleteError("");
    try {
      const response = await fetch("/api/roles?id=" + role.id, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || "Could not delete the role.");
      }
      setRoles((current) => current.filter((item) => item.id !== role.id));
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not delete the role.");
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    async function loadRoles() {
      try {
        const response = await fetch("/api/roles");

        if (!response.ok) {
          throw new Error("Could not load roles");
        }

        const data = (await response.json()) as { roles: Role[] };
        setRoles(data.roles);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Could not load roles",
        );
      } finally {
        setLoading(false);
      }
    }

    loadRoles();
  }, []);

  return (
    <main className="roles-page">
      <div className="roles-header">
        <div>
          <h1>Roles</h1>
          <p>All roles currently saved in the database.</p>
        </div>
        <Link className="add-role-link" href="/admin/add-role">
          Add Role
        </Link>
      </div>

      {deleteError && <p className="error-message" role="alert">{deleteError}</p>}
      {loading && <p>Loading roles...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && roles.length === 0 && (
        <p>No roles have been added yet.</p>
      )}

      {!loading && !error && roles.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Skills &amp; Competencies</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.description || "—"}</td>
                  <td>
                    {role.skills.length === 0 ? (
                      <span className="empty-cell">No skills added</span>
                    ) : (
                      <div className="role-skills-summary">
                        {role.skills.map((skill) => (
                          <div className="role-skill-summary" key={skill.id}>
                            <strong>{skill.name}</strong>
                            <ul>
                              {skill.competencies.map((competency) => (
                                <li key={competency.id}>{competency.description}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="role-row-actions">
                    <Link className="edit-role-link" href={`/admin/edit-role?id=${role.id}`}>
                      Edit
                    </Link>
                    <button className="delete-role-button" type="button" disabled={deletingId !== null} aria-label={'Delete ' + role.name} onClick={() => void deleteRole(role)}>
                      {deletingId === role.id ? "Deleting..." : "Delete"}
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
