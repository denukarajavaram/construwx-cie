import { getDatabase } from "@/lib/db/database";

type RoleWithSkillsRow = {
  id: number;
  name: string;
  description: string;
  requirements: string;
  created_at: string;
  skill_id: string | null;
  skill_name: string | null;
  competency_id: string | null;
  competency_description: string | null;
};

export async function GET() {
  const db = getDatabase();
  const { results } = await db
    .prepare(`
      SELECT roles.id, roles.name, roles.description, roles.requirements, roles.created_at,
        skills.id AS skill_id, skills.name AS skill_name,
        competencies.id AS competency_id,
        competencies.description AS competency_description
      FROM roles
      LEFT JOIN role_skills AS skills ON skills.role_id = roles.id
      LEFT JOIN skill_competencies AS competencies ON competencies.skill_id = skills.id
      ORDER BY roles.created_at DESC, roles.id DESC,
        skills.sort_order, skills.created_at,
        competencies.sort_order, competencies.created_at
    `)
    .all<RoleWithSkillsRow>();

  const roles = new Map<number, {
    id: number;
    name: string;
    description: string;
    requirements: string;
    created_at: string;
    skills: Array<{
      id: string;
      name: string;
      competencies: Array<{ id: string; description: string }>;
    }>;
  }>();

  for (const row of results) {
    if (!roles.has(row.id)) {
      roles.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description,
        requirements: row.requirements,
        created_at: row.created_at,
        skills: [],
      });
    }

    const role = roles.get(row.id);
    if (!role || !row.skill_id || !row.skill_name) continue;

    let skill = role.skills.find((item) => item.id === row.skill_id);
    if (!skill) {
      skill = { id: row.skill_id, name: row.skill_name, competencies: [] };
      role.skills.push(skill);
    }

    if (row.competency_id && row.competency_description !== null) {
      skill.competencies.push({
        id: row.competency_id,
        description: row.competency_description,
      });
    }
  }

  return Response.json({ roles: [...roles.values()] });
}

export async function POST(request: Request) {
  console.log("POST /api/roles called with request: ", request);
  
  const db = getDatabase();
  
  console.log("Database connection established", db);
  const body = await request.json() as {
    name: string;
    description: string;
    requirements: string;
  };

  console.log("Request body parsed: ", body);

  const { name, description, requirements } = body;

  const result = await db
    .prepare(`
      INSERT INTO roles (name, description, requirements)
      VALUES (?, ?, ?)
    `)
    .bind(name, description, requirements)
    .run();
  
  console.log("Insert result: ", result);
  
  return Response.json({
    success: result.success,
    id: result.meta.last_row_id,
  });
}

export async function PUT(request: Request) {
  const db = getDatabase();
  const body = (await request.json()) as {
    id?: number;
    name?: string;
    description?: string;
    requirements?: string;
  };

  const id = Number(body.id);
  const name = body.name?.trim();

  if (!Number.isInteger(id) || id <= 0 || !name) {
    return Response.json(
      { error: "A valid role id and name are required." },
      { status: 400 },
    );
  }

  const result = await db
    .prepare(`
      UPDATE roles
      SET name = ?, description = ?, requirements = ?
      WHERE id = ?
    `)
    .bind(
      name,
      body.description?.trim() ?? "",
      body.requirements?.trim() ?? "",
      id,
    )
    .run();

  if (!result.meta.changes) {
    return Response.json({ error: "Role not found." }, { status: 404 });
  }

  return Response.json({ success: true });
}
