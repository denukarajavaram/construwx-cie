import { getDatabase } from "@/lib/db/database";

type SkillInput = {
  id?: string;
  name?: string;
  competencies?: Array<{ id?: string; description?: string }>;
};

type SkillRow = {
  skill_id: string;
  skill_name: string;
  competency_id: string | null;
  competency_description: string | null;
};

function parseRoleId(value: unknown) {
  const roleId = Number(value);
  return Number.isInteger(roleId) && roleId > 0 ? roleId : null;
}

export async function GET(request: Request) {
  const roleId = parseRoleId(new URL(request.url).searchParams.get("roleId"));
  if (roleId === null) {
    return Response.json({ error: "A valid role id is required." }, { status: 400 });
  }

  const { results } = await getDatabase()
    .prepare(`
      SELECT skills.id AS skill_id, skills.name AS skill_name,
        competencies.id AS competency_id,
        competencies.description AS competency_description
      FROM role_skills AS skills
      LEFT JOIN skill_competencies AS competencies ON competencies.skill_id = skills.id
      WHERE skills.role_id = ?
      ORDER BY skills.sort_order, skills.created_at,
        competencies.sort_order, competencies.created_at
    `)
    .bind(roleId)
    .all<SkillRow>();

  const skills = new Map<string, {
    id: string;
    name: string;
    competencies: Array<{ id: string; description: string }>;
  }>();

  for (const row of results) {
    if (!skills.has(row.skill_id)) {
      skills.set(row.skill_id, { id: row.skill_id, name: row.skill_name, competencies: [] });
    }
    if (row.competency_id && row.competency_description !== null) {
      skills.get(row.skill_id)?.competencies.push({
        id: row.competency_id,
        description: row.competency_description,
      });
    }
  }

  return Response.json({ skills: [...skills.values()] });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { roleId?: number; skills?: SkillInput[] };
  const roleId = parseRoleId(body.roleId);
  if (roleId === null || !Array.isArray(body.skills)) {
    return Response.json({ error: "A valid role id and skills list are required." }, { status: 400 });
  }

  const skills = body.skills.map((skill) => ({
    id: skill.id || crypto.randomUUID(),
    name: skill.name?.trim() ?? "",
    competencies: (skill.competencies ?? []).map((competency) => ({
      id: competency.id || crypto.randomUUID(),
      description: competency.description?.trim() ?? "",
    })),
  }));

  const invalid = skills.some((skill) =>
    !skill.name || skill.competencies.length === 0 ||
    skill.competencies.some((competency) => !competency.description),
  );
  if (invalid) {
    return Response.json(
      { error: "Every skill needs a name and at least one competency." },
      { status: 400 },
    );
  }

  const db = getDatabase();
  const role = await db.prepare("SELECT id FROM roles WHERE id = ?").bind(roleId).first();
  if (!role) return Response.json({ error: "Role not found." }, { status: 404 });

  const statements: D1PreparedStatement[] = [
    db.prepare("DELETE FROM role_skills WHERE role_id = ?").bind(roleId),
  ];

  skills.forEach((skill, skillIndex) => {
    statements.push(
      db.prepare("INSERT INTO role_skills (id, role_id, name, sort_order) VALUES (?, ?, ?, ?)")
        .bind(skill.id, roleId, skill.name, skillIndex),
    );
    skill.competencies.forEach((competency, competencyIndex) => {
      statements.push(
        db.prepare("INSERT INTO skill_competencies (id, skill_id, description, sort_order) VALUES (?, ?, ?, ?)")
          .bind(competency.id, skill.id, competency.description, competencyIndex),
      );
    });
  });

  await db.batch(statements);
  return Response.json({ success: true });
}
